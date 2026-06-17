import React, { useState } from 'react';
import { UserProfile, DailyAIBriefing, HealthMetricLog } from '../types.js';
import { 
  Heart, 
  Flame, 
  Droplet, 
  Activity, 
  Trophy, 
  TrendingDown, 
  Dumbbell, 
  Moon, 
  Zap, 
  Sparkles, 
  Maximize2,
  UtensilsCrossed,
  CheckCircle2
} from 'lucide-react';

interface DashboardScreenProps {
  user: UserProfile;
  briefing: DailyAIBriefing | null;
  latestMetrics: HealthMetricLog | null;
  onLogCompletedWorkout: () => void;
  onAddWater: (amount: number) => void;
  onGoToProfile: () => void;
  isLoading: boolean;
}

export default function DashboardScreen({
  user,
  briefing,
  latestMetrics,
  onLogCompletedWorkout,
  onAddWater,
  onGoToProfile,
  isLoading
}: DashboardScreenProps) {
  const [workoutLogged, setWorkoutLogged] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

  const handleCompleteWorkout = async () => {
    setCompleteLoading(true);
    try {
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const response = await fetch('/api/workout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayName: todayName,
          focusName: briefing?.workoutRecommendation?.title || 'Hypertrophy Training',
          durationMinutes: 45,
          intensity: 'Moderate'
        })
      });
      if (response.ok) {
        setWorkoutLogged(true);
        onLogCompletedWorkout();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompleteLoading(false);
    }
  };

  const getRecoveryColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 border-emerald-300 ring-emerald-200';
    if (score >= 60) return 'text-sky-600 border-sky-300 ring-sky-200';
    if (score >= 40) return 'text-amber-600 border-amber-300 ring-amber-200';
    return 'text-rose-600 border-rose-300 ring-rose-200';
  };

  const getRecoveryBg = (score: number) => {
    if (score >= 80) return 'from-emerald-50 to-emerald-100/30';
    if (score >= 60) return 'from-sky-50 to-sky-100/30';
    if (score >= 40) return 'from-amber-50 to-amber-100/30';
    return 'from-rose-50 to-rose-100/30';
  };

  return (
    <div id="dashboard-view" className="flex-1 flex flex-col h-full bg-[#F0F2F5] overflow-y-auto px-4 py-5 font-sans scrollbar-none">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <span className="text-[10px] text-slate-500 font-mono tracking-widest font-black uppercase">GOOD MORNING DEVELOPER</span>
          <h2 className="text-xl font-bold text-[#1A1C1E] tracking-tight">{user.name} 👋</h2>
        </div>
        <button
          onClick={onGoToProfile}
          className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm cursor-pointer hover:bg-emerald-700 transition-colors"
        >
          {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <span className="relative flex h-8 w-8 mb-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-8 w-8 bg-emerald-600"></span>
          </span>
          <p className="text-sm text-slate-500 font-mono">Syncing SQLite & ADK State...</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* RECOVERY SCORE ROW */}
          <div className={`p-4 rounded-3xl bg-gradient-to-br ${getRecoveryBg(briefing?.recoveryScore || 75)} border border-gray-100 flex items-center gap-5 shadow-sm text-[#1A1C1E]`}>
            
            {/* Dial */}
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className={`absolute inset-1 rounded-full border-2 border-dashed ${getRecoveryColor(briefing?.recoveryScore || 75)}/40 animate-spin-slow`} />
              <div className="flex flex-col items-center justify-center">
                <span className={`text-2xl font-black ${getRecoveryColor(briefing?.recoveryScore || 75)}`}>
                  {briefing?.recoveryScore || '--'}
                </span>
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">RECOVERY</span>
              </div>
            </div>

            {/* Explanation text */}
            <div className="space-y-1 pr-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold font-mono text-emerald-600 uppercase tracking-widest">Recovery Agent</p>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {briefing?.recoveryScore && briefing.recoveryScore >= 80 ? "Primed for Progress" : 
                 briefing?.recoveryScore && briefing.recoveryScore >= 60 ? "Balanced Capacity" : 
                 briefing?.recoveryScore && briefing.recoveryScore >= 40 ? "Deload Advisable" : "Strict Core Rest Needed"}
              </h3>
              <p className="text-xs leading-relaxed text-slate-700">
                {briefing?.recoveryExplanation || "Awaiting device metrics synchronization to run kinesiologic sleep latency analyses."}
              </p>
            </div>
          </div>

          {/* ADAPTIVE WORKOUT RECOMMENDATION WIDGET */}
          <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm space-y-3 text-slate-800">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 font-mono">Today's Workout Target</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-50 px-2 py-0.5 rounded border border-gray-250">
                Adaptive Agent
              </span>
            </div>

            {briefing?.workoutRecommendation ? (
              <div className="space-y-3 pt-0.5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{briefing.workoutRecommendation.title}</h4>
                  <p className="text-xs text-slate-500 leading-normal mb-2.5">{briefing.workoutRecommendation.description}</p>
                </div>

                {/* Exercises Checklist */}
                <div className="bg-slate-50 border border-gray-100 rounded-2xl p-2.5 space-y-2">
                  {briefing.workoutRecommendation.exercises.map((exe, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-gray-200 flex items-center justify-center font-mono text-[9px] text-slate-600 bg-white shrink-0">
                          {i+1}
                        </div>
                        <span className="text-slate-750 font-semibold">{exe.name}</span>
                      </div>
                      <span className="text-slate-600 font-mono text-[10px]">
                        {exe.sets}s x {exe.reps}r {exe.weightLbs ? `@ ${exe.weightLbs} lbs` : '(Bodyweight)'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Workout Complete Button */}
                {!workoutLogged ? (
                  <button
                    id="log-workout-btn"
                    onClick={handleCompleteWorkout}
                    disabled={completeLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl ease-in-out transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/10"
                  >
                    {completeLoading ? "Logging in SQLite..." : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Log Completed Workout
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs font-bold animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> Workout Logged & Sync Completed 🟢
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Onboarding missing or awaiting Health Sync to evaluate specific exercises.</p>
            )}
          </div>

          {/* METRIC BENTO GRIDS */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Steps Trackers */}
            <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 min-h-[120px] text-slate-800">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest font-mono">Steps Trend</span>
                <div className="p-1 bg-emerald-50 rounded text-emerald-600">
                  <Activity className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 font-mono leading-none">
                  {latestMetrics?.steps?.toLocaleString() || '0'}
                </p>
                <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, ((latestMetrics?.steps || 0) / 10000) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Goal: 10,000 steps</span>
            </div>

            {/* Expended Energy calories */}
            <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 min-h-[120px] text-slate-800">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest font-mono">Active Burned</span>
                <div className="p-1 bg-rose-50 rounded text-rose-600">
                  <Flame className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 font-mono leading-none">
                  {latestMetrics?.activeCaloriesBurned || '0'}{' '}
                  <span className="text-xs text-slate-500 font-normal">kcal</span>
                </p>
                <p className="text-[10px] text-slate-500 leading-normal mt-1.5 font-mono">Calculated load: Moderate</p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Health Connect Direct</span>
            </div>

            {/* Sleep depth metrics */}
            <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 min-h-[120px] text-slate-800">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest font-mono">Circadian Sleep</span>
                <div className="p-1 bg-indigo-50 rounded text-indigo-600">
                  <Moon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 font-mono leading-none">
                  {latestMetrics?.sleepDuration || '0'}{' '}
                  <span className="text-xs text-slate-500 font-normal">hrs</span>
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  <span className="text-[10px] text-slate-600 font-mono">Quality: {latestMetrics?.sleepQuality || '0'}/100</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Synced: Daily brief refresh</span>
            </div>

            {/* Hydration tracking panel */}
            <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 min-h-[120px] text-slate-800">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest font-mono">Hydration logs</span>
                <div className="p-1 bg-sky-50 rounded text-sky-600">
                  <Droplet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 font-mono leading-none">
                  {latestMetrics?.waterIntake?.toFixed(2) || '0.00'}{' '}
                  <span className="text-xs text-slate-500 font-normal">Liters</span>
                </p>
                <div className="flex gap-1.5 mt-1">
                  <button
                    id="log-water-btn-250"
                    onClick={() => onAddWater(0.25)}
                    className="text-[9px] bg-sky-50 hover:bg-sky-100 border border-sky-100 px-1.5 py-1 text-sky-700 font-bold rounded cursor-pointer"
                  >
                    +250ml
                  </button>
                  <button
                    id="log-water-btn-500"
                    onClick={() => onAddWater(0.50)}
                    className="text-[9px] bg-sky-50 hover:bg-sky-100 border border-sky-100 px-1.5 py-1 text-sky-700 font-bold rounded cursor-pointer"
                  >
                    +500ml
                  </button>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Goal: {briefing?.nutritionTarget?.waterTargetLiters || '3.0'} L</span>
            </div>
          </div>

          {/* DYNAMIC NUTRITION TARGET BOARD */}
          <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm space-y-3 text-[#1A1C1E]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 font-mono">Nutrition Target Splits</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-50 px-2 py-0.5 rounded border border-gray-200">
                Macro Agent
              </span>
            </div>

            {briefing?.nutritionTarget ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-slate-50 border border-gray-100 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-500 block font-mono font-bold uppercase tracking-wider">ENERGY</span>
                    <span className="text-xs font-black text-slate-800 font-mono">{briefing.nutritionTarget.caloriesTarget} kcal</span>
                  </div>
                  <div className="bg-slate-50 border border-gray-100 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-500 block font-mono font-bold uppercase tracking-wider">PROTEIN</span>
                    <span className="text-xs font-black text-emerald-600 font-mono">{briefing.nutritionTarget.proteinTargetGrams} g</span>
                  </div>
                  <div className="bg-slate-50 border border-gray-100 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-500 block font-mono font-bold uppercase tracking-wider">WATER</span>
                    <span className="text-xs font-black text-sky-600 font-mono">{briefing.nutritionTarget.waterTargetLiters} L</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Run a custom Android Health Sync to calculate calorie/protein targets.</p>
            )}
          </div>

          {/* PROGRESS OR ESTIMATION TRACKING TIMELINE */}
          <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm flex justify-between items-center text-slate-800">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-600 uppercase font-mono tracking-wider font-bold">Goal tracking</span>
                <Trophy className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h4 className="text-xs text-slate-900 font-semibold font-sans">Weight progress target</h4>
              <p className="text-[10px] text-slate-500 leading-normal">
                Estimated Goal Date: <span className="text-indigo-600 font-mono font-bold">Sept 12, 2026</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-500 font-mono">Starting: {user.weight}kg</span>
              <p className="text-base font-black text-slate-900 font-mono leading-none mt-1">
                Goal: {user.goalWeight || user.weight}kg
              </p>
              <div className="flex items-center gap-1 mt-1 justify-end text-[9px] text-emerald-600 font-mono">
                <TrendingDown className="w-3 h-3" />
                <span>Active Tracked</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC MOTIVATION FOOTER - Amber alert box style */}
          <div className="rounded-2xl border border-amber-100 p-4 bg-amber-50 text-[11px] text-amber-900 font-medium italic text-center text-amber-950">
            "{briefing?.motivationalInsight || "Progress is a sequence of managed recovery cycles. Keep syncing and trust the progressive overload mechanics."}"
          </div>

        </div>
      )}
    </div>
  );
}
