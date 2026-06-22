import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/sqliteSim.js';
import { 
  generateDailyBriefing, 
  getLocalDateString, 
  runRecoveryAgent, 
  runNutritionAgent, 
  runWorkoutAgent, 
  runConsistencyAgent, 
  runWeeklyPlannerAgent,
  chatCompletionText
} from './src/api/agents.js';
import { UserProfile, HealthMetricLog, WorkoutSession } from './src/types.js';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Logging Middleware
  app.use((req, res, next) => {
    console.log(`[MyFit API] ${req.method} ${req.url}`);
    next();
  });

  // Load KV data for Vercel (no-op locally)
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      await db.loadFromKV();
    }
    next();
  });

  // ==========================================
  // API ROUTE DEFINITIONS
  // ==========================================

  // 1. Health & Server Status Endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      databasePath: path.join(process.cwd(), 'src', 'db', 'sqlite_myfit.json'),
      currentTime: new Date().toISOString(),
      groqConfigured: !!process.env.GROQ_API_KEY
    });
  });

  // 2. User Profile (Onboarding) Endpoints
  app.get('/api/user/profile', (req, res) => {
    try {
      const profile = db.getUser();
      res.json({ profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/user/profile', (req, res) => {
    try {
      const existing = db.getUser();
      if (!existing) {
        return res.status(400).json({ error: 'No profile found. Please onboard first.' });
      }
      const { name, age, gender, height, weight, goalWeight, fitnessGoal, daysPerWeek, workoutStyle } = req.body;
      const updated: UserProfile = {
        ...existing,
        name: name ?? existing.name,
        age: age !== undefined ? Number(age) : existing.age,
        gender: gender ?? existing.gender,
        height: height !== undefined ? Number(height) : existing.height,
        weight: weight !== undefined ? Number(weight) : existing.weight,
        goalWeight: goalWeight !== undefined ? (goalWeight ? Number(goalWeight) : undefined) : existing.goalWeight,
        fitnessGoal: fitnessGoal ?? existing.fitnessGoal,
        daysPerWeek: daysPerWeek !== undefined ? Number(daysPerWeek) : existing.daysPerWeek,
        workoutStyle: workoutStyle ?? existing.workoutStyle
      };
      db.saveUser(updated);
      res.json({ profile: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/user/onboard', (req, res) => {
    try {
      const { name, age, gender, height, weight, goalWeight, fitnessGoal, daysPerWeek, workoutStyle } = req.body;
      
      if (!name || !age || !gender || !height || !weight || !fitnessGoal || !daysPerWeek || !workoutStyle) {
        return res.status(400).json({ error: 'Missing mandatory onboarding fields' });
      }

      const newProfile: UserProfile = {
        id: Math.random().toString(36).substring(7),
        name,
        age: Number(age),
        gender,
        height: Number(height),
        weight: Number(weight),
        goalWeight: goalWeight ? Number(goalWeight) : undefined,
        fitnessGoal,
        daysPerWeek: Number(daysPerWeek),
        workoutStyle,
        onboarded: true,
        createdAt: new Date().toISOString()
      };

      db.saveUser(newProfile);
      
      // Auto-generate seed health metrics for onboarding today with real weight
      const todayDate = getLocalDateString();
      const baseMetrics: HealthMetricLog = {
        id: Math.random().toString(36).substring(7),
        date: todayDate,
        steps: 6200,
        activeCaloriesBurned: 240,
        sleepDuration: 7.5,
        sleepQuality: 82,
        waterIntake: 1.8,
        proteinGrams: 85,
        caloriesConsumed: 1800,
        weight: Number(weight),
        heartRateAverage: 62,
        synchronizedAt: new Date().toISOString()
      };
      db.insertOrUpdateHealthLog(baseMetrics);

      // Trigger automatic weekly planner generation
      runWeeklyPlannerAgent(newProfile, 85, baseMetrics, null).then(plan => {
        db.saveWeeklyPlan(plan);
      });

      res.status(200).json({ status: 'success', profile: newProfile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/user/reset', (req, res) => {
    try {
      db.clearUser();
      res.json({ status: 'success', message: 'User profile and health databases cleared successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Health Connect Sync Endpoint
  app.get('/api/health-connect/logs', (req, res) => {
    try {
      const logs = db.getHealthLogs();
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/health-connect/sync', (req, res) => {
    try {
      const { steps, activeCaloriesBurned, sleepDuration, sleepQuality, waterIntake, proteinGrams, caloriesConsumed, weight, heartRateAverage } = req.body;
      const todayDate = getLocalDateString();
      const profile = db.getUser();

      if (!profile) {
        return res.status(400).json({ error: 'User must be onboarded before syncing health connect data' });
      }

      const syncRecord: HealthMetricLog = {
        id: Math.random().toString(36).substring(7),
        date: todayDate,
        steps: steps !== undefined ? Number(steps) : 5000,
        activeCaloriesBurned: activeCaloriesBurned !== undefined ? Number(activeCaloriesBurned) : 200,
        sleepDuration: sleepDuration !== undefined ? Number(sleepDuration) : 7.0,
        sleepQuality: sleepQuality !== undefined ? Number(sleepQuality) : 70,
        waterIntake: waterIntake !== undefined ? Number(waterIntake) : 1.5,
        proteinGrams: proteinGrams !== undefined ? Number(proteinGrams) : 75,
        caloriesConsumed: caloriesConsumed !== undefined ? Number(caloriesConsumed) : 1600,
        weight: weight !== undefined ? Number(weight) : profile.weight,
        heartRateAverage: heartRateAverage ? Number(heartRateAverage) : undefined,
        synchronizedAt: new Date().toISOString()
      };

      db.insertOrUpdateHealthLog(syncRecord);
      
      // Clear today's briefing to force regeneration on next request using raw synced values
      const briefs = db.getHealthLogs(); // Trigger a cache refresh
      // Regenerate daily brief in background with new metrics
      generateDailyBriefing(profile, todayDate);

      res.json({ status: 'success', record: syncRecord });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Daily AI Mindful Coaching Briefing
  app.get('/api/daily-briefing', async (req, res) => {
    try {
      const profile = db.getUser();
      if (!profile) {
        return res.json({ briefing: null, reason: 'Profile not onboarded' });
      }

      const todayDate = getLocalDateString();
      const briefing = await generateDailyBriefing(profile, todayDate);
      res.json({ briefing });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 5. Weekly Periodization Planner
  app.get('/api/weekly-plan', (req, res) => {
    try {
      const plan = db.getWeeklyPlan();
      res.json({ plan });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/weekly-plan/regenerate', async (req, res) => {
    try {
      const profile = db.getUser();
      if (!profile) {
        return res.status(400).json({ error: 'Profile not onboarded' });
      }

      const todayDate = getLocalDateString();
      const latestLog = db.getHealthLogByDate(todayDate);
      
      // Calculate current recovery index
      const completedHistory = db.getCompletedWorkouts();
      const prevIntensity = completedHistory.length > 0 ? completedHistory[0].intensity : null;
      
      const recResult = await runRecoveryAgent(
        latestLog?.sleepDuration || 7.5,
        latestLog?.sleepQuality || 80,
        prevIntensity,
        latestLog?.steps || 6000
      );

      const plan = await runWeeklyPlannerAgent(profile, recResult.score, latestLog || null, null);
      db.saveWeeklyPlan(plan);

      // Force daily brief update as well
      const briefing = await generateDailyBriefing(profile, todayDate);

      res.json({ plan, briefing });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 6. Workout Logger
  app.post('/api/workout/complete', async (req, res) => {
    try {
      const { dayName, focusName, durationMinutes, intensity } = req.body;
      const todayDate = getLocalDateString();
      const profile = db.getUser();

      if (!profile) {
        return res.status(400).json({ error: 'Profile not onboarded' });
      }

      const workoutSession: WorkoutSession = {
        id: Math.random().toString(36).substring(7),
        date: todayDate,
        dayOfWeek: dayName,
        focusName,
        completed: true,
        intensity: intensity || 'Moderate',
        durationMinutes: Number(durationMinutes || 45),
        exercises: [],
        loggedAt: new Date().toISOString()
      };

      db.logWorkoutCompletion(workoutSession);

      // Update weekly plan completion status
      const weeklyPlan = db.getWeeklyPlan();
      if (weeklyPlan && weeklyPlan.days[dayName]) {
        weeklyPlan.days[dayName].completed = true;
        db.saveWeeklyPlan(weeklyPlan);
      }

      // Generate coaching metrics in Consistency Agent
      const allCompleted = db.getCompletedWorkouts();
      const consResult = await runConsistencyAgent(profile, allCompleted);

      // Trigger daily brief refresh to motivate
      const briefing = await generateDailyBriefing(profile, todayDate);

      res.json({ status: 'success', statistics: consResult, briefing });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 7. Gemini AI Fitness Coach Chat Proxy
  app.post('/api/coach/chat', async (req, res) => {
    try {
      const { text, history } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Message body cannot be empty' });
      }

      const profile = db.getUser();
      if (!profile) {
        return res.status(400).json({ error: 'Please onboarding your MyFit Profile first before consulting the AI Coach' });
      }

      const todayDate = getLocalDateString();
      const latestMetrics = db.getHealthLogByDate(todayDate);
      const workouts = db.getCompletedWorkouts();
      const weeklyPlan = db.getWeeklyPlan();
      const briefing = db.getDailyBriefing(todayDate);

      db.logTelemetry('System Coordinator', 'Injecting health data structures for Chat Context', { message: text }, null);

      // Assemble physical and statistical metadata
      const promptContext = `
You are the **MyFit AI Personal Fitness Coach** (An elite certified fitness coach, sports nutritionist, and structural kinesiologist).
Your user is dynamic and relies on you. You have DIRECT visual access to his synchronized Android Health Connect metric profile database.
Always format your answers in markdown. Be highly targeted, motivational, direct, and explain your training recommendation using real biometric science.
Never hallucinate or invent health metrics. Respond strictly based on the real metrics below. Keep explanations accessible but elite.

User Diagnostic Profile:
- Name: ${profile.name}
- Age: ${profile.age} | Gender: ${profile.gender}
- Height: ${profile.height} cm | Weight: ${profile.weight} kg
- Fitness Target Goal: ${profile.fitnessGoal} (Days desired to lift: ${profile.daysPerWeek} times/week, Split Style: ${profile.workoutStyle})

Synchronized Health Connect Metrics (Today):
- Date: ${todayDate}
- Steps Monitored: ${latestMetrics?.steps || 3500} steps
- Sleep Duration: ${latestMetrics?.sleepDuration || 6.5} hours
- Sleep Quality: ${latestMetrics?.sleepQuality || 70}%
- Hydration Logged: ${latestMetrics?.waterIntake || 1.2} L
- Protein consumed: ${latestMetrics?.proteinGrams || 65} g
- Active calories expended: ${latestMetrics?.activeCaloriesBurned || 150} kcal
- Current Weight Trend: ${latestMetrics?.weight || profile.weight} kg
- Heart Rate Average: ${latestMetrics?.heartRateAverage || 'No Heart Rate Tracked'} bpm

Calculated Recovery index: ${briefing?.recoveryScore || 'Calculating...'} / 100
Recovery Explanation: ${briefing?.recoveryExplanation || 'Analyzing current circadian rhythm parameters.'}

Active Weekly Training Plan Grid:
${weeklyPlan ? Object.keys(weeklyPlan.days).map(d => `- ${d}: ${weeklyPlan.days[d].type} (${weeklyPlan.days[d].completed ? "Completed 🟢" : "Pending ✖"}) - Postponed/Rescheduled shifts: ${weeklyPlan.days[d].rescheduledReason || 'None'}`).join('\n') : "No plan loaded."}

Workout Assigned Today: ${briefing?.workoutRecommendation?.title || 'Mobility Flow'}
Workout Details: ${briefing?.workoutRecommendation?.description || 'Stretching and active walks.'}
Assigned Exercises: ${briefing?.workoutRecommendation?.exercises?.map((e: any) => `- ${e.name}: ${e.sets} sets x ${e.reps} reps (at ${e.weightLbs || 'BW'} lbs)`).join(', ') || 'Yoga stretch.'}

Completed Sessions Total Logged: ${workouts.length} workouts completed.

User Question: "${text}"

Provide a highly functional, encouraging, and bio-coherent answer. State precise facts first.`;

      const responseText = await chatCompletionText(promptContext, "You are a friendly, experienced personal trainer. Under no circumstances should you generate fake metrics. If specific data is missing, explain that you are waiting for active Health Connect sync. Keep formatting readable and visual.") || "I apologize, I couldn't formulate a response. Please check your Health Connect sync.";
      
      const coachMessage = {
        id: Math.random().toString(36).substring(7),
        sender: 'coach' as const,
        text: responseText,
        timestamp: new Date().toISOString(),
        usedMetrics: {
          steps: latestMetrics?.steps || 0,
          sleep: latestMetrics?.sleepDuration || 0,
          recoveryScore: briefing?.recoveryScore || 0,
          activeCalories: latestMetrics?.activeCaloriesBurned || 0,
          nutrition: `Protein: ${latestMetrics?.proteinGrams || 0}g, Calories: ${latestMetrics?.caloriesConsumed || 0}kcal`
        }
      };

      // Save user message and coach response in db
      db.insertChatMessage({
        id: Math.random().toString(36).substring(7),
        sender: 'user',
        text,
        timestamp: new Date().toISOString()
      });
      db.insertChatMessage(coachMessage);

      // Return response
      res.json({ message: coachMessage });
    } catch (error: any) {
      console.error("Coach Chat Error:", error);
      // Return a friendly coach message instead of an error so the UI doesn't break
      const fallbackMessage = {
        id: Math.random().toString(36).substring(7),
        sender: 'coach' as const,
        text: error.status === 429
          ? "I'm currently experiencing high demand. Please wait about 30 seconds and try again. The Gemini API rate limit has been reached."
          : "Sorry, I encountered an issue processing your request. Please try again in a moment.",
        timestamp: new Date().toISOString()
      };
      res.json({ message: fallbackMessage });
    }
  });

  app.get('/api/coach/chat/history', (req, res) => {
    try {
      const history = db.getChatMessages();
      res.json({ history });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/coach/chat/clear', (req, res) => {
    try {
      db.clearChatHistory();
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 8. Google Fit OAuth & Data Sync
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
  const GOOGLE_REDIRECT_URI = () => {
    const base = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
    return `${base}/api/auth/google/callback`;
  };

  const GOOGLE_FIT_SCOPES = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.nutrition.read',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/user.birthday.read'
  ].join(' ');

  // Check connection status
  app.get('/api/google-fit/status', (req, res) => {
    const tokens = db.getGoogleFitTokens();
    res.json({
      connected: !!tokens,
      connectedAt: tokens?.connected_at || null,
      expired: tokens ? Date.now() > tokens.expires_at : true
    });
  });

  // Start OAuth flow
  app.get('/api/auth/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured. Add it to your environment variables.' });
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI())}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(GOOGLE_FIT_SCOPES)}` +
      `&access_type=offline` +
      `&prompt=consent`;
    res.json({ authUrl });
  });

  // OAuth callback
  app.get('/api/auth/google/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI(),
          grant_type: 'authorization_code'
        })
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.status(400).send(`OAuth error: ${tokenData.error_description || tokenData.error}`);
      }
      db.saveGoogleFitTokens({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        connected_at: new Date().toISOString()
      });
      // Redirect back to the app's health tab
      res.send(`<html><body><script>window.close(); window.opener && window.opener.postMessage('google-fit-connected','*');</script><p>Connected! You can close this window.</p></body></html>`);
    } catch (error: any) {
      res.status(500).send(`Token exchange failed: ${error.message}`);
    }
  });

  // Refresh access token if expired
  async function getValidAccessToken(): Promise<string | null> {
    const tokens = db.getGoogleFitTokens();
    if (!tokens) return null;

    if (Date.now() < tokens.expires_at - 60000) {
      return tokens.access_token;
    }

    // Refresh the token
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token'
        })
      });
      const data = await refreshRes.json();
      if (data.error) return null;

      db.saveGoogleFitTokens({
        ...tokens,
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in * 1000)
      });
      return data.access_token;
    } catch {
      return null;
    }
  }

  // Fetch personal details from Google (name, age, height, weight)
  app.get('/api/google-fit/profile', async (req, res) => {
    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        return res.status(401).json({ error: 'Google not connected. Please connect first.' });
      }

      const result: { name?: string; age?: number; height?: number; weight?: number } = {};

      // Fetch name and birthday from Google People API
      const peopleRes = await fetch(
        'https://people.googleapis.com/v1/people/me?personFields=names,birthdays',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const peopleData = await peopleRes.json();
      console.log('[Google Profile] People API response:', JSON.stringify(peopleData, null, 2));

      if (peopleData.names && peopleData.names.length > 0) {
        result.name = peopleData.names[0].displayName;
      }

      if (peopleData.birthdays && peopleData.birthdays.length > 0) {
        const bday = peopleData.birthdays.find((b: any) => b.date?.year) || peopleData.birthdays[0];
        if (bday?.date?.year) {
          const today = new Date();
          const birthDate = new Date(bday.date.year, (bday.date.month || 1) - 1, bday.date.day || 1);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          result.age = age;
        }
      }

      // Fetch height from Google Fit
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 86400000;
      const heightRes = await fetch(
        'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            aggregateBy: [{ dataTypeName: 'com.google.height' }],
            bucketByTime: { durationMillis: 30 * 86400000 },
            startTimeMillis: thirtyDaysAgo,
            endTimeMillis: now
          })
        }
      );
      const heightData = await heightRes.json();
      for (const bucket of (heightData.bucket || [])) {
        for (const dataset of (bucket.dataset || [])) {
          for (const point of (dataset.point || [])) {
            for (const val of (point.value || [])) {
              if (val.fpVal) {
                result.height = Math.round(val.fpVal * 100); // meters to cm
              }
            }
          }
        }
      }

      // Fetch weight from Google Fit
      const weightRes = await fetch(
        'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            aggregateBy: [{ dataTypeName: 'com.google.weight' }],
            bucketByTime: { durationMillis: 30 * 86400000 },
            startTimeMillis: thirtyDaysAgo,
            endTimeMillis: now
          })
        }
      );
      const weightData = await weightRes.json();
      for (const bucket of (weightData.bucket || [])) {
        for (const dataset of (bucket.dataset || [])) {
          for (const point of (dataset.point || [])) {
            for (const val of (point.value || [])) {
              if (val.fpVal) {
                result.weight = Math.round(val.fpVal * 10) / 10; // kg with 1 decimal
              }
            }
          }
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('Google profile fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch data from Google Fit and sync to our DB
  app.post('/api/google-fit/sync', async (req, res) => {
    try {
      const profile = db.getUser();
      if (!profile) {
        return res.status(400).json({ error: 'Profile not onboarded' });
      }

      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        return res.status(401).json({ error: 'Google Fit not connected or token expired. Please reconnect.' });
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startMillis = startOfDay.getTime();
      const endMillis = now.getTime();

      // Aggregate request for steps, calories, heart rate
      const aggregateBody = {
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.calories.expended' },
          { dataTypeName: 'com.google.heart_rate.bpm' },
          { dataTypeName: 'com.google.weight' }
        ],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMillis,
        endTimeMillis: endMillis
      };

      const fitRes = await fetch(
        'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(aggregateBody)
        }
      );

      const fitData = await fitRes.json();
      if (fitData.error) {
        return res.status(400).json({ error: fitData.error.message });
      }

      // Parse the aggregated data
      let steps = 0;
      let caloriesBurned = 0;
      let heartRateAvg = 0;
      let weightKg = profile.weight;
      let heartRateCount = 0;

      for (const bucket of (fitData.bucket || [])) {
        for (const dataset of (bucket.dataset || [])) {
          for (const point of (dataset.point || [])) {
            const typeName = point.dataTypeName;
            for (const val of (point.value || [])) {
              if (typeName === 'com.google.step_count.delta') {
                steps += val.intVal || 0;
              } else if (typeName === 'com.google.calories.expended') {
                caloriesBurned += val.fpVal || 0;
              } else if (typeName === 'com.google.heart_rate.bpm') {
                heartRateAvg += val.fpVal || 0;
                heartRateCount++;
              } else if (typeName === 'com.google.weight') {
                weightKg = val.fpVal || weightKg;
              }
            }
          }
        }
      }

      if (heartRateCount > 0) {
        heartRateAvg = Math.round(heartRateAvg / heartRateCount);
      }

      // Fetch sleep data separately (last night)
      const sleepStart = startMillis - 43200000; // 12 hours before start of day
      const sleepRes = await fetch(
        `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(sleepStart).toISOString()}&endTime=${startOfDay.toISOString()}&activityType=72`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      const sleepData = await sleepRes.json();

      let sleepDuration = 0;
      for (const session of (sleepData.session || [])) {
        const start = parseInt(session.startTimeMillis);
        const end = parseInt(session.endTimeMillis);
        sleepDuration += (end - start) / 3600000; // convert to hours
      }

      // Get existing log to preserve manual entries (water, protein, nutrition)
      const todayDate = getLocalDateString();
      const existingLog = db.getHealthLogByDate(todayDate);

      const syncRecord: HealthMetricLog = {
        id: Math.random().toString(36).substring(7),
        date: todayDate,
        steps,
        activeCaloriesBurned: Math.round(caloriesBurned),
        sleepDuration: Math.round(sleepDuration * 10) / 10 || existingLog?.sleepDuration || 7,
        sleepQuality: sleepDuration >= 7 ? 85 : sleepDuration >= 6 ? 70 : sleepDuration >= 5 ? 50 : 30,
        waterIntake: existingLog?.waterIntake || 0,
        proteinGrams: existingLog?.proteinGrams || 0,
        caloriesConsumed: existingLog?.caloriesConsumed || 0,
        weight: Math.round(weightKg * 10) / 10,
        heartRateAverage: heartRateAvg || existingLog?.heartRateAverage || undefined,
        synchronizedAt: new Date().toISOString()
      };

      db.insertOrUpdateHealthLog(syncRecord);
      generateDailyBriefing(profile, todayDate);

      res.json({ status: 'success', record: syncRecord, source: 'google_fit' });
    } catch (error: any) {
      console.error('Google Fit sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Disconnect Google Fit
  app.post('/api/google-fit/disconnect', (req, res) => {
    db.clearGoogleFitTokens();
    res.json({ status: 'success' });
  });

  // 9. Agent Telemetry Logs & Database Schema DIAGNOSTICS Viewers
  app.get('/api/telemetry/logs', (req, res) => {
    try {
      const logs = db.getTelemetryLogs();
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/telemetry/db-explorer', (req, res) => {
    try {
      const tables = db.getDatabaseTables();
      res.json({ tables });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // VITE & STATIC FILES ASSET HOSTING MIDDLEWARE
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Local dev server
if (!process.env.VERCEL) {
  startServer().then(app => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[MyFit Server] Active and running on http://localhost:${PORT}`);
    });
  });
}

// Export for Vercel serverless
export default startServer();
