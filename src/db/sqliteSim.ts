import * as fs from 'fs';
import * as path from 'path';
import {
  UserProfile,
  HealthMetricLog,
  WorkoutSession,
  WeeklyPlan,
  DailyAIBriefing,
  ChatMessage,
  AgentTelemetryLogs
} from '../types.js';

export interface GoogleFitTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  connected_at: string;
}

// Define the full DB Structure
export interface SQLiteDatabaseSchema {
  users: UserProfile[];
  health_logs: HealthMetricLog[];
  completed_workouts: WorkoutSession[];
  weekly_plans: WeeklyPlan[];
  daily_briefings: DailyAIBriefing[];
  chat_messages: ChatMessage[];
  telemetry_logs: AgentTelemetryLogs[];
  google_fit_tokens: GoogleFitTokens | null;
}

const KV_KEY = 'myfit_db';
const isVercel = !!process.env.KV_REST_API_URL;

// Dynamic import for @vercel/kv (only used in production)
let kvModule: any = null;
async function getKV() {
  if (!kvModule) {
    kvModule = await import('@vercel/kv');
  }
  return kvModule.kv;
}

function getDefaultSchema(): SQLiteDatabaseSchema {
  return {
    users: [],
    health_logs: [],
    completed_workouts: [],
    weekly_plans: [],
    daily_briefings: [],
    chat_messages: [],
    telemetry_logs: [],
    google_fit_tokens: null
  };
}

const DB_PATH = path.join(process.cwd(), 'src', 'db', 'sqlite_myfit.json');

export class SQLiteConnection {
  private schema: SQLiteDatabaseSchema;
  private kvInitialized: boolean = false;

  constructor() {
    this.schema = getDefaultSchema();
    if (!isVercel) {
      this.initializeLocal();
    }
  }

  private initializeLocal() {
    try {
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        this.schema = JSON.parse(fileContent);
      } else {
        this.saveLocal();
      }
    } catch (e) {
      console.error("Failed to initialize local database:", e);
    }
  }

  private saveLocal() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.schema, null, 2), 'utf-8');
    } catch (e) {
      console.error("Failed to persist local database:", e);
    }
  }

  // Load from KV (called before reads in Vercel mode)
  public async loadFromKV() {
    if (!isVercel) return;
    try {
      const kv = await getKV();
      const data = await kv.get(KV_KEY);
      if (data) {
        this.schema = data as SQLiteDatabaseSchema;
      }
      this.kvInitialized = true;
    } catch (e) {
      console.error("KV load error:", e);
    }
  }

  // Save to KV (called after writes in Vercel mode)
  private async saveToKV() {
    if (!isVercel) return;
    try {
      const kv = await getKV();
      await kv.set(KV_KEY, this.schema);
    } catch (e) {
      console.error("KV save error:", e);
    }
  }

  private save() {
    if (isVercel) {
      this.saveToKV();
    } else {
      this.saveLocal();
    }
  }

  private initialize() {
    if (!isVercel) {
      this.initializeLocal();
    }
    // For Vercel, loadFromKV() must be called explicitly before route handlers
  }

  // --- Users Queries (UserProfile Table) ---
  public getUser(): UserProfile | null {
    if (!isVercel) this.initialize();
    return this.schema.users.length > 0 ? this.schema.users[0] : null;
  }

  public saveUser(profile: UserProfile): void {
    if (!isVercel) this.initialize();
    this.schema.users = [profile]; // Single user concept since it's an applet
    this.save();
  }

  public clearUser(): void {
    if (!isVercel) this.initialize();
    this.schema.users = [];
    this.schema.health_logs = [];
    this.schema.completed_workouts = [];
    this.schema.weekly_plans = [];
    this.schema.daily_briefings = [];
    this.schema.chat_messages = [];
    this.schema.telemetry_logs = [];
    this.save();
  }

  // --- Health Metric Logs Queries (Health logs SQL Table) ---
  public getHealthLogs(): HealthMetricLog[] {
    if (!isVercel) this.initialize();
    return [...this.schema.health_logs].sort((a, b) => b.date.localeCompare(a.date));
  }

  public getHealthLogByDate(date: string): HealthMetricLog | null {
    if (!isVercel) this.initialize();
    return this.schema.health_logs.find(log => log.date === date) || null;
  }

  public insertOrUpdateHealthLog(log: HealthMetricLog): void {
    if (!isVercel) this.initialize();
    const idx = this.schema.health_logs.findIndex(item => item.date === log.date);
    if (idx !== -1) {
      this.schema.health_logs[idx] = { ...this.schema.health_logs[idx], ...log, synchronizedAt: new Date().toISOString() };
    } else {
      this.schema.health_logs.push(log);
    }
    this.save();
  }

  // --- Workouts Queries (Workouts SQL Table) ---
  public getCompletedWorkouts(): WorkoutSession[] {
    if (!isVercel) this.initialize();
    return [...this.schema.completed_workouts].sort((a, b) => b.date.localeCompare(a.date));
  }

  public logWorkoutCompletion(session: WorkoutSession): void {
    if (!isVercel) this.initialize();
    this.schema.completed_workouts.push({
      ...session,
      id: Math.random().toString(36).substring(7),
      loggedAt: new Date().toISOString(),
      completed: true
    });
    this.save();
  }

  // --- Weekly Plans Queries (WeeklyPlans SQL Table) ---
  public getWeeklyPlan(): WeeklyPlan | null {
    if (!isVercel) this.initialize();
    return this.schema.weekly_plans.length > 0 ? this.schema.weekly_plans[0] : null;
  }

  public saveWeeklyPlan(plan: WeeklyPlan): void {
    if (!isVercel) this.initialize();
    this.schema.weekly_plans = [plan];
    this.save();
  }

  // --- Daily AI Briefings Queries (DailyBriefings SQL Table) ---
  public getDailyBriefing(date: string): DailyAIBriefing | null {
    if (!isVercel) this.initialize();
    return this.schema.daily_briefings.find(brief => brief.date === date) || null;
  }

  public saveDailyBriefing(briefing: DailyAIBriefing): void {
    if (!isVercel) this.initialize();
    const idx = this.schema.daily_briefings.findIndex(b => b.date === briefing.date);
    if (idx !== -1) {
      this.schema.daily_briefings[idx] = briefing;
    } else {
      this.schema.daily_briefings.push(briefing);
    }
    this.save();
  }

  // --- Chat Messages Queries (ChatMessages SQL Table) ---
  public getChatMessages(): ChatMessage[] {
    if (!isVercel) this.initialize();
    return this.schema.chat_messages;
  }

  public insertChatMessage(msg: ChatMessage): void {
    if (!isVercel) this.initialize();
    this.schema.chat_messages.push(msg);
    this.save();
  }

  public clearChatHistory(): void {
    if (!isVercel) this.initialize();
    this.schema.chat_messages = [];
    this.save();
  }

  // --- Telemetry Logs Queries (TelemetryLogs SQL Table / ADK Framework) ---
  public getTelemetryLogs(): AgentTelemetryLogs[] {
    if (!isVercel) this.initialize();
    return [...this.schema.telemetry_logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public logTelemetry(agentName: AgentTelemetryLogs['agentName'], action: string, inputData: any, outputData: any): void {
    if (!isVercel) this.initialize();
    this.schema.telemetry_logs.push({
      timestamp: new Date().toISOString(),
      agentName,
      action,
      inputData,
      outputData
    });
    // Cap at 100 logs
    if (this.schema.telemetry_logs.length > 100) {
      this.schema.telemetry_logs.shift();
    }
    this.save();
  }

  // --- Google Fit Tokens ---
  public getGoogleFitTokens(): GoogleFitTokens | null {
    if (!isVercel) this.initialize();
    return this.schema.google_fit_tokens || null;
  }

  public saveGoogleFitTokens(tokens: GoogleFitTokens): void {
    if (!isVercel) this.initialize();
    this.schema.google_fit_tokens = tokens;
    this.save();
  }

  public clearGoogleFitTokens(): void {
    if (!isVercel) this.initialize();
    this.schema.google_fit_tokens = null;
    this.save();
  }

  // Export full schema representation for the visual developer visualizer!
  public getDatabaseTables() {
    if (!isVercel) this.initialize();
    return [
      {
        name: 'UserProfile (Table: users)',
        columns: ['id (TEXT)', 'name (TEXT)', 'age (INTEGER)', 'gender (TEXT)', 'height (INTEGER)', 'weight (DECIMAL)', 'fitness_goal (TEXT)', 'days_per_week (INTEGER)', 'workout_style (TEXT)', 'onboarded (BOOLEAN)'],
        rows: this.schema.users
      },
      {
        name: 'HealthMetricLog (Table: health_data)',
        columns: ['id (TEXT)', 'date (TEXT)', 'steps (INTEGER)', 'active_calories (INTEGER)', 'sleep_duration (DECIMAL)', 'sleep_quality (INTEGER)', 'water_intake (DECIMAL)', 'protein_grams (INTEGER)', 'calories_consumed (INTEGER)', 'weight (DECIMAL)'],
        rows: this.schema.health_logs
      },
      {
        name: 'WorkoutLog (Table: completed_workouts)',
        columns: ['id (TEXT)', 'date (TEXT)', 'day_of_week (TEXT)', 'focus_name (TEXT)', 'duration_minutes (INTEGER)', 'intensity (TEXT)', 'completed (BOOLEAN)'],
        rows: this.schema.completed_workouts.map(w => ({
          id: w.id,
          date: w.date,
          dayOfWeek: w.dayOfWeek,
          focusName: w.focusName,
          durationMinutes: w.durationMinutes,
          intensity: w.intensity,
          completed: w.completed
        }))
      },
      {
        name: 'WeeklyPlan (Table: weekly_plans)',
        columns: ['id (TEXT)', 'userId (TEXT)', 'week_start_date (TEXT)', 'generated_at (TEXT)', 'adaptive_notes (TEXT)'],
        rows: this.schema.weekly_plans.map(p => ({
          id: p.id,
          userId: p.userId,
          weekStartDate: p.weekStartDate,
          generatedAt: p.generatedAt,
          days_summary: Object.keys(p.days).map(d => `${d}: ${p.days[d].type} (${p.days[d].completed ? 'Done' : 'Pending'})`).join(', ')
        }))
      },
      {
        name: 'DailyBriefing (Table: daily_briefings)',
        columns: ['date (TEXT)', 'recovery_score (INTEGER)', 'workout_rec (TEXT)', 'calories_target (INTEGER)', 'protein_target (INTEGER)', 'water_target (DECIMAL)'],
        rows: this.schema.daily_briefings.map(b => ({
          date: b.date,
          recoveryScore: b.recoveryScore,
          workout_rec: b.workoutRecommendation?.title,
          calories_target: b.nutritionTarget?.caloriesTarget,
          protein_target: b.nutritionTarget?.proteinTargetGrams,
          water_target: b.nutritionTarget?.waterTargetLiters
        }))
      }
    ];
  }
}

export const db = new SQLiteConnection();
