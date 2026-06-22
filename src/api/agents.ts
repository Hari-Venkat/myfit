/**
 * MyFit AI Coach Agent Logic
 * Implements Recovery, Nutrition, Workout, Consistency, and Weekly Planner Agents
 * Powered by Groq (LLaMA 3.3 70B)
 */

import Groq from "groq-sdk";
import { db } from "../db/sqliteSim.js";
import {
  UserProfile,
  HealthMetricLog,
  WorkoutSession,
  WeeklyPlan,
  DailyAIBriefing,
  ChatMessage,
  ExerciseItem
} from "../types.js";

let groqClient: Groq | null = null;

const GROQ_MODEL = "llama-3.3-70b-versatile";

export function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is missing. Get one at https://console.groq.com");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// Keep backward-compatible export name
export const getGeminiClient = getGroqClient;

async function chatCompletion(prompt: string, systemPrompt?: string): Promise<string> {
  const groq = getGroqClient();
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "{}";
}

async function chatCompletionText(prompt: string, systemPrompt?: string): Promise<string> {
  const groq = getGroqClient();
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "";
}

// Helper to format date in YYYY-MM-DD
export function getLocalDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ==========================================
// 1. RECOVERY AGENT
// ==========================================
export async function runRecoveryAgent(
  sleepDuration: number,
  sleepQuality: number,
  prevWorkoutIntensity: 'Low' | 'Moderate' | 'High' | null,
  stepsToday: number
): Promise<{ score: number; explanation: string }> {
  try {
    db.logTelemetry('Recovery Agent', 'Initiating recovery calculation', {
      sleepDuration,
      sleepQuality,
      prevWorkoutIntensity,
      stepsToday
    }, null);

    const prompt = `
YOU ARE THE "MYFIT RECOVERY AGENT" (A certified elite sports recovery specialist).
Analyze the athlete's raw physical data and output a precise recovery score (0 to 100) and recovery explanation.

Athlete Data:
- Daily Sleep Duration: ${sleepDuration} hours
- Daily Sleep Quality: ${sleepQuality}/100
- Previous Workout Intensity: ${prevWorkoutIntensity || 'None / Rest Day'}
- Steps Completed: ${stepsToday} steps

Formulate the score scientifically:
- Sleep Under 5 hours or Sleep Quality under 40 drastically penalizes recovery (score will fall into 0-39 range)
- Good sleep (7.5+ hours, 80+ quality) and light active recovery steps yields high scores (80-100 range)
- Moderate load yields 60-79
- Heavy load or poor sleep yields 40-59

Respond strictly in JSON format:
{
  "score": number (0-100),
  "explanation": "Professional coaching explanation citing sleep cycles and cardiovascular loads (2-3 sentences)"
}`;

    const text = await chatCompletion(prompt);
    const result = JSON.parse(text.trim());
    db.logTelemetry('Recovery Agent', 'Completed recovery calculation', null, result);
    return result;
  } catch (error: any) {
    console.error("Recovery Agent Error:", error);
    let score = 70;
    if (sleepDuration < 5) score = 35;
    else if (sleepDuration < 7) score = 55;
    else if (sleepQuality > 80) score = 90;

    const explanation = `Fallback Evaluation: Sleep duration is ${sleepDuration} hours with ${sleepQuality}% quality. Active recovery steps monitored at ${stepsToday}. Ready for structured metabolic loading.`;
    return { score, explanation };
  }
}

// ==========================================
// 2. NUTRITION AGENT
// ==========================================
export async function runNutritionAgent(
  user: UserProfile,
  latestLog: HealthMetricLog | null
): Promise<{
  caloriesTarget: number;
  proteinTargetGrams: number;
  waterTargetLiters: number;
  explanation: string;
  mealSuggestions: string[];
}> {
  try {
    const currentWeight = latestLog?.weight || user.weight;
    const caloriesBurnedValue = latestLog?.activeCaloriesBurned || 300;

    db.logTelemetry('Nutrition Agent', 'Computing nutrition macro split', {
      userGoal: user.fitnessGoal,
      currentWeight,
      targetWeight: user.goalWeight || currentWeight,
      caloriesBurned: caloriesBurnedValue
    }, null);

    const prompt = `
YOU ARE THE "MYFIT NUTRITION AGENT" (A licensed functional nutritionist).
Calculate custom caloric, protein, and water targets based on real user data, and suggest active metabolic whole-foods.

User Context:
- Name: ${user.name}
- Age: ${user.age}
- Gender: ${user.gender}
- Weight: ${currentWeight} kg (Target: ${user.goalWeight || currentWeight} kg)
- Goal: ${user.fitnessGoal}
- Active Calories Burned Today: ${caloriesBurnedValue} kcal

Formulas:
- Basal Metabolic Rate (BMR): ~10 * weight (kg) + 6.25 * Height(175) - 5 * Age
- Active calories burned must be factored in (e.g. increase protein and calorie allowance)
- Weight Loss: Subtractive caloric deficit of 300-500 kcal from total expenditure
- Muscle Gain: Surfeit of 200-400 kcal above maintenance, higher protein (2.0g - 2.2g per kg)
- Water: Baseline 35ml/kg + 0.5L for every 300 kcal burned.

Respond strictly in JSON format:
{
  "caloriesTarget": number (integer calories, e.g. 2150),
  "proteinTargetGrams": number (integer protein in grams),
  "waterTargetLiters": number (decimal water, e.g. 3.2),
  "explanation": "Brief explanation of how the goal is supported by these macros",
  "mealSuggestions": ["Meal 1 description", "Meal 2 description", "Snack suggestion"]
}`;

    const text = await chatCompletion(prompt);
    const result = JSON.parse(text.trim());
    db.logTelemetry('Nutrition Agent', 'Completed nutrition analysis', null, result);
    return result;
  } catch (error: any) {
    console.error("Nutrition Agent Error:", error);
    const isGain = user.fitnessGoal === 'Muscle Gain';
    const isLoss = user.fitnessGoal === 'Weight Loss' || user.fitnessGoal === 'Fat Loss';
    const baseCals = isGain ? 2600 : isLoss ? 1800 : 2100;
    const weight = user.weight;

    return {
      caloriesTarget: baseCals,
      proteinTargetGrams: Math.round(isGain ? weight * 2.1 : weight * 1.6),
      waterTargetLiters: 3.3,
      explanation: `Calculated baseline nutritional balance for ${user.fitnessGoal} target supporting progressive overload recovery.`,
      mealSuggestions: [
        "Breakfast: Greek yogurt (200g) with blueberries, chia seeds, and dynamic organic honey.",
        "Lunch: Seared salmon salad with baby spinach, sweet potato cubes, and cold-pressed olive oil.",
        "Dinner: Grilled lean turkey breast with white jasmine rice and steamed leafy broccoli."
      ]
    };
  }
}

// ==========================================
// 3. WORKOUT AGENT
// ==========================================
export async function runWorkoutAgent(
  user: UserProfile,
  recoveryScore: number,
  todayFocus: string
): Promise<{
  title: string;
  description: string;
  exercises: ExerciseItem[];
}> {
  try {
    db.logTelemetry('Workout Agent', 'Assembling custom structural resistance plan', {
      userGoal: user.fitnessGoal,
      workoutStyle: user.workoutStyle,
      recoveryScore,
      focus: todayFocus
    }, null);

    const prompt = `
YOU ARE THE "MYFIT WORKOUT AGENT" (A CSCS Strength & Conditioning specialist).
Build the custom workout prescription for TODAY based on the user's goals, recovery index, and schedule split focus.

User Context:
- Goal: ${user.fitnessGoal}
- Workout Split Style: ${user.workoutStyle}
- Target Schedule Focus for Today: ${todayFocus}
- Current Recovery Score: ${recoveryScore}/100

Safety Rules:
- If Recovery Score is under 40: Dictate an active recovery workout (mobility, stretching, outdoor walk). No heavy lifting.
- If Recovery Score is 40-59: Mild weight, lower volume (RPE 6), focus on mobility and posture.
- If Recovery Score is 60+: Normal strength prescription.

Exercises must match the TodayFocus (e.g., if "Push" => Chest/Shoulders/Triceps. if "Legs" => Quads/Hamstrings/Calves).

IMPORTANT: Always use SPECIFIC real exercise names (e.g., "Barbell Bench Press", "Incline Dumbbell Press", "Barbell Back Squat", "Romanian Deadlift", "Lat Pulldown", "Seated Cable Row"). NEVER use generic names like "Compound Core Movement" or "Isolation Accessory".

Respond strictly in JSON format:
{
  "title": "Title of the Workout",
  "description": "Specific coaching cue / focus target for today (1-2 sentences)",
  "exercises": [
    { "name": "Exercise Name", "sets": number, "reps": number, "weightLbs": number (or 0 for bodyweight) }
  ]
}`;

    const text = await chatCompletion(prompt);
    const result = JSON.parse(text.trim());
    db.logTelemetry('Workout Agent', 'Generated daily workout session', null, result);
    return result;
  } catch (error: any) {
    console.error("Workout Agent Error:", error);
    const isRecovery = recoveryScore < 40;
    return {
      title: isRecovery ? "Active Mobile Flow" : `${todayFocus} Hypertrophy Phase`,
      description: isRecovery
        ? "Low CNS strain: Focus entirely on restoring length-tension relationships and blood-flow oxygenation."
        : `Targeting concentric muscle failure during ${todayFocus} sequence, maintaining high stability.`,
      exercises: isRecovery ? [
        { id: "e1", name: "Dynamic Hip Flexor Stretch", sets: 3, reps: 10, weightLbs: 0 },
        { id: "e2", name: "Cat-Cow & Thoracic Rotations", sets: 3, reps: 12, weightLbs: 0 },
        { id: "e3", name: "Low-Intensity Walking", sets: 1, reps: 20, weightLbs: 0 }
      ] : todayFocus.toLowerCase().includes('push') ? [
        { id: "e1", name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
        { id: "e2", name: "Overhead Dumbbell Press", sets: 3, reps: 12, weightLbs: 45 },
        { id: "e3", name: "Tricep Cable Pushdown", sets: 3, reps: 15, weightLbs: 25 }
      ] : todayFocus.toLowerCase().includes('pull') ? [
        { id: "e1", name: "Barbell Bent-Over Row", sets: 4, reps: 8, weightLbs: 135 },
        { id: "e2", name: "Lat Pulldown", sets: 3, reps: 12, weightLbs: 90 },
        { id: "e3", name: "Dumbbell Bicep Curl", sets: 3, reps: 15, weightLbs: 25 }
      ] : todayFocus.toLowerCase().includes('leg') ? [
        { id: "e1", name: "Barbell Back Squat", sets: 4, reps: 8, weightLbs: 185 },
        { id: "e2", name: "Romanian Deadlift", sets: 3, reps: 12, weightLbs: 135 },
        { id: "e3", name: "Leg Press", sets: 3, reps: 15, weightLbs: 200 }
      ] : todayFocus.toLowerCase().includes('upper') ? [
        { id: "e1", name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
        { id: "e2", name: "Seated Cable Row", sets: 3, reps: 12, weightLbs: 90 },
        { id: "e3", name: "Lateral Dumbbell Raise", sets: 3, reps: 15, weightLbs: 20 }
      ] : todayFocus.toLowerCase().includes('lower') ? [
        { id: "e1", name: "Barbell Back Squat", sets: 4, reps: 8, weightLbs: 185 },
        { id: "e2", name: "Walking Lunges", sets: 3, reps: 12, weightLbs: 50 },
        { id: "e3", name: "Calf Raises", sets: 3, reps: 15, weightLbs: 100 }
      ] : todayFocus.toLowerCase().includes('chest & back') ? [
        { id: "e1", name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
        { id: "e2", name: "Weighted Pull-Up", sets: 4, reps: 8, weightLbs: 25 },
        { id: "e3", name: "Incline Dumbbell Press", sets: 3, reps: 12, weightLbs: 55 },
        { id: "e4", name: "Barbell Bent-Over Row", sets: 3, reps: 12, weightLbs: 135 }
      ] : todayFocus.toLowerCase().includes('shoulders & arms') ? [
        { id: "e1", name: "Overhead Barbell Press", sets: 4, reps: 8, weightLbs: 95 },
        { id: "e2", name: "Barbell Curl", sets: 3, reps: 12, weightLbs: 65 },
        { id: "e3", name: "Skull Crushers", sets: 3, reps: 12, weightLbs: 55 },
        { id: "e4", name: "Lateral Dumbbell Raise", sets: 3, reps: 15, weightLbs: 20 }
      ] : todayFocus.toLowerCase() === 'chest' ? [
        { id: "e1", name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
        { id: "e2", name: "Incline Dumbbell Press", sets: 3, reps: 12, weightLbs: 55 },
        { id: "e3", name: "Cable Chest Fly", sets: 3, reps: 15, weightLbs: 30 }
      ] : todayFocus.toLowerCase() === 'back' ? [
        { id: "e1", name: "Barbell Deadlift", sets: 4, reps: 6, weightLbs: 225 },
        { id: "e2", name: "Lat Pulldown", sets: 3, reps: 12, weightLbs: 90 },
        { id: "e3", name: "Seated Cable Row", sets: 3, reps: 12, weightLbs: 90 }
      ] : todayFocus.toLowerCase() === 'shoulders' ? [
        { id: "e1", name: "Overhead Barbell Press", sets: 4, reps: 8, weightLbs: 95 },
        { id: "e2", name: "Lateral Dumbbell Raise", sets: 3, reps: 15, weightLbs: 20 },
        { id: "e3", name: "Face Pulls", sets: 3, reps: 15, weightLbs: 30 }
      ] : todayFocus.toLowerCase() === 'arms' ? [
        { id: "e1", name: "Barbell Curl", sets: 4, reps: 10, weightLbs: 65 },
        { id: "e2", name: "Tricep Dips", sets: 3, reps: 12, weightLbs: 0 },
        { id: "e3", name: "Hammer Curl", sets: 3, reps: 12, weightLbs: 30 },
        { id: "e4", name: "Overhead Tricep Extension", sets: 3, reps: 12, weightLbs: 40 }
      ] : [
        { id: "e1", name: "Barbell Deadlift", sets: 4, reps: 8, weightLbs: 185 },
        { id: "e2", name: "Dumbbell Shoulder Press", sets: 3, reps: 12, weightLbs: 45 },
        { id: "e3", name: "Plank Hold", sets: 3, reps: 30, weightLbs: 0 }
      ]
    };
  }
}

// ==========================================
// 4. CONSISTENCY AGENT
// ==========================================
export async function runConsistencyAgent(
  user: UserProfile,
  completedLogs: WorkoutSession[]
): Promise<{
  adherencePercentage: number;
  consecutiveStreak: number;
  coachingInsight: string;
}> {
  try {
    db.logTelemetry('Consistency Agent', 'Calculating adherence statistics', {
      userGoalDays: user.daysPerWeek,
      logsCount: completedLogs.length
    }, null);

    const targetDays = user.daysPerWeek;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastWeekWorkouts = completedLogs.filter(log => new Date(log.date) >= oneWeekAgo);

    const countThisWeek = lastWeekWorkouts.length;
    const adherence = Math.min(100, Math.round((countThisWeek / targetDays) * 100));

    let streak = 0;
    const sortedCompleted = [...completedLogs].sort((a,b) => b.date.localeCompare(a.date));

    const todayStr = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const hasTodayOrYesterday = sortedCompleted.some(w => w.date === todayStr || w.date === yesterdayStr);
    if (hasTodayOrYesterday) {
      streak = sortedCompleted.length;
    }

    let coachingInsight = "";
    if (adherence >= 100) {
      coachingInsight = "Excellent momentum! You met 100% of your structural frequency. Recovery intervals should be defended fiercely to avoid overuse.";
    } else if (adherence >= 75) {
      coachingInsight = "Solid work! Missed sessions are normal during high stress. Retain compound volume on the active days to secure progression.";
    } else {
      coachingInsight = "Consistency indicators suggest high schedule friction. Consider lowering frequency target to 3 days to establish structural consistency first.";
    }

    const result = {
      adherencePercentage: adherence,
      consecutiveStreak: streak || Math.min(completedLogs.length, 3),
      coachingInsight
    };

    db.logTelemetry('Consistency Agent', 'Completed consistency evaluation', null, result);
    return result;
  } catch (error: any) {
    console.error("Consistency Agent Error:", error);
    return {
      adherencePercentage: 80,
      consecutiveStreak: 2,
      coachingInsight: "Adherence is stabilizing. Focus on complete movement cycles without stress spikes."
    };
  }
}

function getFallbackExercises(dayName: string, type: string) {
  const t = type.toLowerCase();
  const exercises: Record<string, { name: string; sets: number; reps: number; weightLbs: number }[]> = {
    push: [
      { name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
      { name: "Overhead Dumbbell Press", sets: 3, reps: 12, weightLbs: 45 },
      { name: "Tricep Cable Pushdown", sets: 3, reps: 15, weightLbs: 25 }
    ],
    pull: [
      { name: "Barbell Bent-Over Row", sets: 4, reps: 8, weightLbs: 135 },
      { name: "Lat Pulldown", sets: 3, reps: 12, weightLbs: 90 },
      { name: "Dumbbell Bicep Curl", sets: 3, reps: 15, weightLbs: 25 }
    ],
    legs: [
      { name: "Barbell Back Squat", sets: 4, reps: 8, weightLbs: 185 },
      { name: "Romanian Deadlift", sets: 3, reps: 12, weightLbs: 135 },
      { name: "Leg Press", sets: 3, reps: 15, weightLbs: 200 }
    ],
    upper: [
      { name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
      { name: "Seated Cable Row", sets: 3, reps: 12, weightLbs: 90 },
      { name: "Lateral Dumbbell Raise", sets: 3, reps: 15, weightLbs: 20 }
    ],
    lower: [
      { name: "Barbell Back Squat", sets: 4, reps: 8, weightLbs: 185 },
      { name: "Walking Lunges", sets: 3, reps: 12, weightLbs: 50 },
      { name: "Calf Raises", sets: 3, reps: 15, weightLbs: 100 }
    ],
    chest: [
      { name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
      { name: "Incline Dumbbell Press", sets: 3, reps: 12, weightLbs: 55 },
      { name: "Cable Chest Fly", sets: 3, reps: 15, weightLbs: 30 }
    ],
    back: [
      { name: "Barbell Deadlift", sets: 4, reps: 6, weightLbs: 225 },
      { name: "Lat Pulldown", sets: 3, reps: 12, weightLbs: 90 },
      { name: "Seated Cable Row", sets: 3, reps: 12, weightLbs: 90 }
    ],
    shoulders: [
      { name: "Overhead Barbell Press", sets: 4, reps: 8, weightLbs: 95 },
      { name: "Lateral Dumbbell Raise", sets: 3, reps: 15, weightLbs: 20 },
      { name: "Face Pulls", sets: 3, reps: 15, weightLbs: 30 }
    ],
    arms: [
      { name: "Barbell Curl", sets: 4, reps: 10, weightLbs: 65 },
      { name: "Tricep Dips", sets: 3, reps: 12, weightLbs: 0 },
      { name: "Hammer Curl", sets: 3, reps: 12, weightLbs: 30 },
      { name: "Overhead Tricep Extension", sets: 3, reps: 12, weightLbs: 40 }
    ],
    'chest & back': [
      { name: "Barbell Bench Press", sets: 4, reps: 8, weightLbs: 135 },
      { name: "Weighted Pull-Up", sets: 4, reps: 8, weightLbs: 25 },
      { name: "Incline Dumbbell Press", sets: 3, reps: 12, weightLbs: 55 },
      { name: "Barbell Bent-Over Row", sets: 3, reps: 12, weightLbs: 135 }
    ],
    'shoulders & arms': [
      { name: "Overhead Barbell Press", sets: 4, reps: 8, weightLbs: 95 },
      { name: "Barbell Curl", sets: 3, reps: 12, weightLbs: 65 },
      { name: "Skull Crushers", sets: 3, reps: 12, weightLbs: 55 },
      { name: "Lateral Dumbbell Raise", sets: 3, reps: 15, weightLbs: 20 }
    ],
    'full body': [
      { name: "Barbell Deadlift", sets: 4, reps: 6, weightLbs: 185 },
      { name: "Dumbbell Shoulder Press", sets: 3, reps: 12, weightLbs: 45 },
      { name: "Goblet Squat", sets: 3, reps: 12, weightLbs: 50 }
    ]
  };

  const matched = exercises[t] || exercises['full body'];
  return matched.map((e, i) => ({ id: `${dayName}-e${i + 1}`, ...e, completed: false }));
}

// ==========================================
// 5. WEEKLY PLANNER / ADAPTIVE SCHEDULER AGENT
// ==========================================
export async function runWeeklyPlannerAgent(
  user: UserProfile,
  recoveryScore: number,
  yesterdayLog: HealthMetricLog | null,
  currentPlan: WeeklyPlan | null
): Promise<WeeklyPlan> {
  try {
    db.logTelemetry('Weekly Planner Agent', 'Executing Adaptive Scheduling logic', {
      userGoal: user.fitnessGoal,
      workoutStyle: user.workoutStyle,
      recoveryScore,
      sleepLastNight: yesterdayLog?.sleepDuration || 8
    }, null);

    const currentBriefText = currentPlan
      ? JSON.stringify(currentPlan)
      : "No currently assigned plans.";

    const prompt = `
YOU ARE THE "MYFIT WEEKLY PLANNER AGENT" (Expert in athletic structural periodization).
Deploy adaptive scheduling rules to produce a custom 7-day layout starting from Monday.

Context:
- User Goal: ${user.fitnessGoal}
- Days Per Week Desired: ${user.daysPerWeek}
- Preferred Workout Style: ${user.workoutStyle}
- Athlete's Current Recovery Score: ${recoveryScore}/100
- Sleep Duration Last Night: ${yesterdayLog?.sleepDuration || 8} hours
- Active Existing Plan: ${currentBriefText}

Adaptive periodization guidelines:
1. IF Recovery Score is lower than 60, or sleep is under 5.0 hours: The plan MUST adapt! Delay/postpone any intense compound physical workloads (e.g. Legs or Heavy Lower/Push) and insert a "Recovery" or "Rest" block for today (Monday or active day). Push the workout to the subsequent days.
2. Ensure you never schedule more than 2 high-intensity lift days in direct succession.
3. Align target lift count with desired days per week (${user.daysPerWeek}). If they want 4 days, ensure there are 4 workouts, and 3 recovery/rest days.

Respond strictly in JSON format:
{
  "weekStartDate": "YYYY-MM-DD",
  "days": {
    "Monday": { "type": "Push|Pull|Legs|Upper|Lower|Full Body|Recovery|Rest", "completed": false, "rescheduledReason": "None (If not shifted), otherwise write explanation of the adaptive shift" },
    "Tuesday": { "type": "...", "completed": false, "rescheduledReason": "..." },
    "Wednesday": { "type": "...", "completed": false, "rescheduledReason": "..." },
    "Thursday": { "type": "...", "completed": false, "rescheduledReason": "..." },
    "Friday": { "type": "...", "completed": false, "rescheduledReason": "..." },
    "Saturday": { "type": "...", "completed": false, "rescheduledReason": "..." },
    "Sunday": { "type": "Rest", "completed": false, "rescheduledReason": "..." }
  },
  "adaptiveNotes": "Direct brief coaching explanation to the client highlighting the recovery-based microcycle shift"
}`;

    const text = await chatCompletion(prompt);
    const parsed = JSON.parse(text.trim());

    const daysWithDetails: any = {};
    const daysArr = [
      { name: 'Monday', type: parsed.days.Monday.type },
      { name: 'Tuesday', type: parsed.days.Tuesday.type },
      { name: 'Wednesday', type: parsed.days.Wednesday.type },
      { name: 'Thursday', type: parsed.days.Thursday.type },
      { name: 'Friday', type: parsed.days.Friday.type },
      { name: 'Saturday', type: parsed.days.Saturday.type },
      { name: 'Sunday', type: parsed.days.Sunday.type }
    ];

    for (const d of daysArr) {
      const isLift = d.type !== 'Rest' && d.type !== 'Recovery';
      const reason = parsed.days[d.name].rescheduledReason || "Standard Split Allocation";
      const completedState = currentPlan?.days[d.name]?.completed || false;

      daysWithDetails[d.name] = {
        dayName: d.name,
        type: d.type,
        icon: isLift ? "dumbbell" : "moon",
        completed: completedState,
        rescheduledReason: reason,
        exercises: isLift ? getFallbackExercises(d.name, d.type) : [
          { id: `${d.name}-e1`, name: "Deep Mobilization Yoga Stretches", sets: 1, reps: 15, weightLbs: 0, completed: false },
          { id: `${d.name}-e2`, name: "Steady-State Zone 1 Walk", sets: 1, reps: 20, weightLbs: 0, completed: false }
        ]
      };
    }

    const finalPlan: WeeklyPlan = {
      id: currentPlan?.id || Math.random().toString(36).substring(7),
      userId: user.id,
      weekStartDate: parsed.weekStartDate || getLocalDateString(),
      days: daysWithDetails,
      generatedAt: new Date().toISOString(),
      adaptiveNotes: parsed.adaptiveNotes
    };

    db.logTelemetry('Weekly Planner Agent', 'Completed adaptive periodization routing', null, finalPlan);
    return finalPlan;
  } catch (error: any) {
    console.error("Weekly Planner Agent Error:", error);
    const daysWithDetailsFallback: any = {};
    const dTypes = ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Recovery', 'Rest'];
    const dNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    dNames.forEach((name, idx) => {
      const type = dTypes[idx];
      const isLift = type !== 'Rest' && type !== 'Recovery';
      daysWithDetailsFallback[name] = {
        dayName: name,
        type,
        icon: isLift ? "dumbbell" : "moon",
        completed: false,
        rescheduledReason: "Baseline Schedule Active",
        exercises: [
          { id: `${name}-e1`, name: "Generic Isometric Squat Hold", sets: 3, reps: 10, weightLbs: 0 }
        ]
      };
    });

    return {
      id: "fallback-plan-id",
      userId: user.id,
      weekStartDate: getLocalDateString(),
      days: daysWithDetailsFallback,
      generatedAt: new Date().toISOString(),
      adaptiveNotes: "Failsafe schedule loaded. Keep training structured and allow recovery cycles to integrate."
    };
  }
}

// ==========================================
// CENTRAL SYSTEM COORDINATOR / DAILY BRIEFING
// ==========================================
export async function generateDailyBriefing(user: UserProfile, todayDate: string): Promise<DailyAIBriefing> {
  const existing = db.getDailyBriefing(todayDate);
  if (existing) return existing;

  db.logTelemetry('System Coordinator', 'Generating Daily AI Briefing Package', { userId: user.id, date: todayDate }, null);

  let todayLog = db.getHealthLogByDate(todayDate);
  if (!todayLog) {
    todayLog = {
      id: Math.random().toString(36).substring(7),
      date: todayDate,
      steps: 4200,
      activeCaloriesBurned: 180,
      sleepDuration: 7.2,
      sleepQuality: 75,
      waterIntake: 1.5,
      proteinGrams: 90,
      caloriesConsumed: 1600,
      weight: user.weight,
      heartRateAverage: 65,
      synchronizedAt: new Date().toISOString()
    };
    db.insertOrUpdateHealthLog(todayLog);
  }

  const history = db.getCompletedWorkouts();
  const prevIntensity = history.length > 0 ? history[0].intensity : null;

  const recovery = await runRecoveryAgent(
    todayLog.sleepDuration,
    todayLog.sleepQuality,
    prevIntensity,
    todayLog.steps
  );

  const activePlan = db.getWeeklyPlan();
  const adjustedPlan = await runWeeklyPlannerAgent(user, recovery.score, todayLog, activePlan);
  db.saveWeeklyPlan(adjustedPlan);

  const daysSorted = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = daysSorted[new Date(todayDate).getDay()];
  const todayFocusType = adjustedPlan.days[dayName]?.type || 'Full Body';

  const workout = await runWorkoutAgent(user, recovery.score, todayFocusType);
  const nutrition = await runNutritionAgent(user, todayLog);

  const motivationalInsight = recovery.score >= 80
    ? "Central nervous system is optimized. This is your green-light zone to break personal records safely."
    : "Physiological fatigue elements are monitored. Prioritize clean movement pattern velocities today.";

  const briefing: DailyAIBriefing = {
    date: todayDate,
    recoveryScore: recovery.score,
    recoveryExplanation: recovery.explanation,
    workoutRecommendation: workout,
    nutritionTarget: nutrition,
    weeklyPlanAdjustment: adjustedPlan.adaptiveNotes,
    motivationalInsight,
    generatedAt: new Date().toISOString()
  };

  db.saveDailyBriefing(briefing);
  db.logTelemetry('System Coordinator', 'Completed Daily AI Briefing Package Generation', null, briefing);
  return briefing;
}

// Export chatCompletionText for use in coach chat endpoints
export { chatCompletionText };
