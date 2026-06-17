/**
 * Shared Type Definitions for MyFit - Your AI Fitness Coach
 */

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  height: number; // in cm
  weight: number; // in kg
  goalWeight?: number; // in kg
  fitnessGoal: 'Weight Loss' | 'Fat Loss' | 'Muscle Gain' | 'Maintain Weight' | 'General Fitness';
  daysPerWeek: number; // 3, 4, 5, 6
  workoutStyle: 'Push Pull Legs' | 'Upper Lower' | 'Full Body' | 'Bro Split' | 'Arnold Split' | 'Custom';
  onboarded: boolean;
  createdAt: string;
}

export interface HealthMetricLog {
  id: string;
  date: string; // YYYY-MM-DD
  steps: number;
  activeCaloriesBurned: number;
  sleepDuration: number; // hours
  sleepQuality: number; // 1-100 score
  waterIntake: number; // in Liters
  proteinGrams: number;
  caloriesConsumed: number;
  weight: number; // in kg
  heartRateAverage?: number; // bpm
  synchronizedAt: string;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Monday, Tuesday, etc.
  focusName: string; // e.g. "Push", "Legs", "Recovery"
  exercises: ExerciseItem[];
  completed: boolean;
  intensity: 'Low' | 'Moderate' | 'High';
  durationMinutes: number;
  loggedAt?: string;
  skipped?: boolean;
}

export interface ExerciseItem {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightLbs?: number;
  completed?: boolean;
}

export interface WeeklyPlan {
  id: string;
  userId: string;
  weekStartDate: string; // YYYY-MM-DD (typically Monday)
  days: {
    [key: string]: {
      dayName: string; // "Monday", "Tuesday", etc.
      type: 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Lower' | 'Full Body' | 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Chest & Back' | 'Shoulders & Arms' | 'Recovery' | 'Rest';
      icon: string;
      exercises: ExerciseItem[];
      customInstruction?: string;
      rescheduledReason?: string;
      completed: boolean;
      skipped?: boolean;
    };
  };
  generatedAt: string;
  adaptiveNotes?: string;
}

export interface DailyAIBriefing {
  date: string; // YYYY-MM-DD
  recoveryScore: number;
  recoveryExplanation: string;
  workoutRecommendation: {
    title: string;
    description: string;
    exercises: ExerciseItem[];
  };
  nutritionTarget: {
    caloriesTarget: number;
    proteinTargetGrams: number;
    waterTargetLiters: number;
    explanation: string;
    mealSuggestions: string[];
  };
  weeklyPlanAdjustment?: string;
  motivationalInsight: string;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
  usedMetrics?: {
    steps: number;
    sleep: number;
    recoveryScore: number;
    activeCalories: number;
    nutrition: string;
  };
}

export interface AgentTelemetryLogs {
  timestamp: string;
  agentName: 'Recovery Agent' | 'Nutrition Agent' | 'Workout Agent' | 'Consistency Agent' | 'Weekly Planner Agent' | 'System Coordinator';
  action: string;
  inputData: any;
  outputData: any;
}
