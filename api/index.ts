import 'dotenv/config';
import express from 'express';
import { db } from '../src/db/sqliteSim.js';
import {
  generateDailyBriefing,
  getLocalDateString,
  runRecoveryAgent,
  runWeeklyPlannerAgent,
  getGeminiClient
} from '../src/api/agents.js';
import { UserProfile, HealthMetricLog, WorkoutSession } from '../src/types.js';

const app = express();
app.use(express.json());

// Load KV data before every API request
app.use(async (_req, _res, next) => {
  await db.loadFromKV();
  next();
});

// ==========================================
// 1. User Onboard & Profile
// ==========================================
app.get('/api/user/profile', (req, res) => {
  try {
    const profile = db.getUser();
    res.json({ profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/onboard', (req, res) => {
  try {
    const { name, age, gender, height, weight, goalWeight, fitnessGoal, daysPerWeek, workoutStyle } = req.body;
    const profile: UserProfile = {
      id: Math.random().toString(36).substring(7),
      name, age, gender, height, weight, goalWeight,
      fitnessGoal, daysPerWeek, workoutStyle,
      onboarded: true,
      createdAt: new Date().toISOString()
    };
    db.saveUser(profile);
    res.json({ profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/profile', (req, res) => {
  try {
    const existing = db.getUser();
    if (!existing) return res.status(404).json({ error: 'No profile found' });
    const updated = { ...existing, ...req.body };
    db.saveUser(updated);
    res.json({ profile: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/reset', (req, res) => {
  try {
    db.clearUser();
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. Health Connect Sync
// ==========================================
app.post('/api/health-connect/sync', (req, res) => {
  try {
    const todayDate = getLocalDateString();
    const existingLog = db.getHealthLogByDate(todayDate);
    const record: HealthMetricLog = {
      id: existingLog?.id || Math.random().toString(36).substring(7),
      date: todayDate,
      steps: req.body.steps ?? existingLog?.steps ?? 0,
      activeCaloriesBurned: req.body.activeCaloriesBurned ?? existingLog?.activeCaloriesBurned ?? 0,
      sleepDuration: req.body.sleepDuration ?? existingLog?.sleepDuration ?? 7,
      sleepQuality: req.body.sleepQuality ?? existingLog?.sleepQuality ?? 70,
      waterIntake: req.body.waterIntake ?? existingLog?.waterIntake ?? 0,
      proteinGrams: req.body.proteinGrams ?? existingLog?.proteinGrams ?? 0,
      caloriesConsumed: req.body.caloriesConsumed ?? existingLog?.caloriesConsumed ?? 0,
      weight: req.body.weight ?? existingLog?.weight ?? 75,
      heartRateAverage: req.body.heartRateAverage ?? existingLog?.heartRateAverage,
      synchronizedAt: new Date().toISOString()
    };
    db.insertOrUpdateHealthLog(record);
    res.json({ record });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health-connect/logs', (req, res) => {
  try {
    const logs = db.getHealthLogs();
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. Daily Briefing
// ==========================================
app.get('/api/daily-briefing', async (req, res) => {
  try {
    const profile = db.getUser();
    if (!profile) return res.json({ briefing: null, reason: 'Profile not onboarded' });
    const todayDate = getLocalDateString();
    const briefing = await generateDailyBriefing(profile, todayDate);
    res.json({ briefing });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. Weekly Plan
// ==========================================
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
    if (!profile) return res.status(400).json({ error: 'Profile not onboarded' });
    const todayDate = getLocalDateString();
    const latestLog = db.getHealthLogByDate(todayDate);
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
    const briefing = await generateDailyBriefing(profile, todayDate);
    res.json({ plan, briefing });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. Workout Logger
// ==========================================
app.post('/api/workout/complete', async (req, res) => {
  try {
    const { dayName, focusName, durationMinutes, intensity } = req.body;
    const todayDate = getLocalDateString();
    const profile = db.getUser();
    if (!profile) return res.status(400).json({ error: 'Profile not onboarded' });
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
    const plan = db.getWeeklyPlan();
    if (plan && plan.days[dayName]) {
      plan.days[dayName].completed = true;
      db.saveWeeklyPlan(plan);
    }
    res.json({ status: 'success', session: workoutSession });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. AI Coach Chat
// ==========================================
app.post('/api/coach/chat', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Message body cannot be empty' });
    const profile = db.getUser();
    if (!profile) return res.status(400).json({ error: 'Please onboard first' });

    const todayDate = getLocalDateString();
    const latestMetrics = db.getHealthLogByDate(todayDate);
    const workouts = db.getCompletedWorkouts();
    const weeklyPlan = db.getWeeklyPlan();
    const briefing = db.getDailyBriefing(todayDate);

    const promptContext = `
You are the **MyFit AI Personal Fitness Coach**.
User: ${profile.name}, Age: ${profile.age}, ${profile.height}cm, ${profile.weight}kg
Goal: ${profile.fitnessGoal}, Split: ${profile.workoutStyle}, ${profile.daysPerWeek}x/week
Today (${todayDate}): Steps: ${latestMetrics?.steps || 0}, Sleep: ${latestMetrics?.sleepDuration || 0}h, Recovery: ${briefing?.recoveryScore || 'N/A'}/100
Workout today: ${briefing?.workoutRecommendation?.title || 'None assigned'}
Completed workouts: ${workouts.length}

User Question: "${text}"

Respond with actionable fitness advice based on the data above. Use markdown formatting.`;

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: promptContext,
    });

    const responseText = response.text || "Sorry, I couldn't process your request right now.";
    const coachMessage = {
      id: Math.random().toString(36).substring(7),
      sender: 'coach' as const,
      text: responseText,
      timestamp: new Date().toISOString()
    };
    db.insertChatMessage({ id: Math.random().toString(36).substring(7), sender: 'user', text, timestamp: new Date().toISOString() });
    db.insertChatMessage(coachMessage);
    res.json({ message: coachMessage });
  } catch (error: any) {
    console.error("Coach Chat Error:", error?.message || error, "Status:", error?.status);
    const errorDetail = error?.message || String(error);
    let userMessage: string;
    if (error.status === 429) {
      userMessage = "I'm experiencing high demand. Please wait 30 seconds and try again.";
    } else if (errorDetail.includes('API_KEY') || errorDetail.includes('api key') || error.status === 400 || error.status === 403) {
      userMessage = `API configuration error: ${errorDetail}`;
    } else {
      userMessage = `Sorry, I encountered an issue: ${errorDetail}`;
    }
    const fallbackMessage = {
      id: Math.random().toString(36).substring(7),
      sender: 'coach' as const,
      text: userMessage,
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

// ==========================================
// 7. Google Fit OAuth & Sync
// ==========================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = () => {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
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

app.get('/api/google-fit/status', (req, res) => {
  const tokens = db.getGoogleFitTokens();
  res.json({
    connected: !!tokens,
    connectedAt: tokens?.connected_at || null,
    expired: tokens ? Date.now() > tokens.expires_at : true
  });
});

app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured.' });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI())}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(GOOGLE_FIT_SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent`;
  res.json({ authUrl });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing authorization code');
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
    if (tokenData.error) return res.status(400).send(`OAuth error: ${tokenData.error_description || tokenData.error}`);
    db.saveGoogleFitTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      connected_at: new Date().toISOString()
    });
    res.send(`<html><body><script>window.close(); window.opener && window.opener.postMessage('google-fit-connected','*');</script><p>Connected! You can close this window.</p></body></html>`);
  } catch (error: any) {
    res.status(500).send(`Token exchange failed: ${error.message}`);
  }
});

async function getValidAccessToken(): Promise<string | null> {
  const tokens = db.getGoogleFitTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 60000) return tokens.access_token;
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
    db.saveGoogleFitTokens({ ...tokens, access_token: data.access_token, expires_at: Date.now() + (data.expires_in * 1000) });
    return data.access_token;
  } catch { return null; }
}

app.get('/api/google-fit/profile', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(401).json({ error: 'Google not connected.' });
    const result: { name?: string; age?: number; height?: number; weight?: number } = {};

    const peopleRes = await fetch('https://people.googleapis.com/v1/people/me?personFields=names,birthdays', { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const peopleData = await peopleRes.json();
    if (peopleData.names?.length > 0) result.name = peopleData.names[0].displayName;
    if (peopleData.birthdays?.length > 0) {
      const bday = peopleData.birthdays.find((b: any) => b.date?.year) || peopleData.birthdays[0];
      if (bday?.date?.year) {
        const today = new Date();
        const birthDate = new Date(bday.date.year, (bday.date.month || 1) - 1, bday.date.day || 1);
        let age = today.getFullYear() - birthDate.getFullYear();
        if (today.getMonth() - birthDate.getMonth() < 0 || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;
        result.age = age;
      }
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    for (const dataType of ['com.google.height', 'com.google.weight']) {
      const fitRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ aggregateBy: [{ dataTypeName: dataType }], bucketByTime: { durationMillis: 30 * 86400000 }, startTimeMillis: thirtyDaysAgo, endTimeMillis: now })
      });
      const fitData = await fitRes.json();
      for (const bucket of (fitData.bucket || [])) {
        for (const dataset of (bucket.dataset || [])) {
          for (const point of (dataset.point || [])) {
            for (const val of (point.value || [])) {
              if (val.fpVal && dataType === 'com.google.height') result.height = Math.round(val.fpVal * 100);
              if (val.fpVal && dataType === 'com.google.weight') result.weight = Math.round(val.fpVal * 10) / 10;
            }
          }
        }
      }
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/google-fit/sync', async (req, res) => {
  try {
    const profile = db.getUser();
    if (!profile) return res.status(400).json({ error: 'Profile not onboarded' });
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(401).json({ error: 'Google Fit not connected.' });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const aggregateBody = {
      aggregateBy: [
        { dataTypeName: 'com.google.step_count.delta' },
        { dataTypeName: 'com.google.calories.expended' },
        { dataTypeName: 'com.google.heart_rate.bpm' },
        { dataTypeName: 'com.google.weight' }
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: startOfDay.getTime(),
      endTimeMillis: now.getTime()
    };

    const fitRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(aggregateBody)
    });
    const fitData = await fitRes.json();
    if (fitData.error) return res.status(400).json({ error: fitData.error.message });

    let steps = 0, caloriesBurned = 0, heartRateAvg = 0, weightKg = profile.weight, heartRateCount = 0;
    for (const bucket of (fitData.bucket || [])) {
      for (const dataset of (bucket.dataset || [])) {
        for (const point of (dataset.point || [])) {
          for (const val of (point.value || [])) {
            if (point.dataTypeName === 'com.google.step_count.delta') steps += val.intVal || 0;
            else if (point.dataTypeName === 'com.google.calories.expended') caloriesBurned += val.fpVal || 0;
            else if (point.dataTypeName === 'com.google.heart_rate.bpm') { heartRateAvg += val.fpVal || 0; heartRateCount++; }
            else if (point.dataTypeName === 'com.google.weight') weightKg = val.fpVal || weightKg;
          }
        }
      }
    }
    if (heartRateCount > 0) heartRateAvg = Math.round(heartRateAvg / heartRateCount);

    const todayDate = getLocalDateString();
    const existingLog = db.getHealthLogByDate(todayDate);
    const syncRecord: HealthMetricLog = {
      id: existingLog?.id || Math.random().toString(36).substring(7),
      date: todayDate,
      steps, activeCaloriesBurned: Math.round(caloriesBurned),
      sleepDuration: existingLog?.sleepDuration || 7,
      sleepQuality: 70,
      waterIntake: existingLog?.waterIntake || 0,
      proteinGrams: existingLog?.proteinGrams || 0,
      caloriesConsumed: existingLog?.caloriesConsumed || 0,
      weight: Math.round(weightKg * 10) / 10,
      heartRateAverage: heartRateAvg || undefined,
      synchronizedAt: new Date().toISOString()
    };
    db.insertOrUpdateHealthLog(syncRecord);
    res.json({ status: 'success', record: syncRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/google-fit/disconnect', (req, res) => {
  db.clearGoogleFitTokens();
  res.json({ status: 'success' });
});

// ==========================================
// 8. Telemetry
// ==========================================
app.get('/api/telemetry/logs', (req, res) => {
  res.json({ logs: db.getTelemetryLogs() });
});

app.get('/api/telemetry/db-explorer', (req, res) => {
  res.json({ tables: db.getDatabaseTables() });
});

export default app;
