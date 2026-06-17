import React, { useState } from 'react';
import { WeeklyPlan } from '../types.js';
import { 
  Calendar, 
  Dumbbell, 
  Moon, 
  Share2, 
  RefreshCw, 
  ChevronRight, 
  Info,
  CheckCircle,
  AlertTriangle,
  Flame
} from 'lucide-react';

interface PlannerScreenProps {
  plan: WeeklyPlan | null;
  onRegeneratePlan: () => Promise<void>;
  isRegenerating: boolean;
}

export default function PlannerScreen({ plan, onRegeneratePlan, isRegenerating }: PlannerScreenProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>('Monday');

  const daysOrdered = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleDayExpansion = (day: string) => {
    setExpandedDay(prev => prev === day ? null : day);
  };

  const getDayTypeStatsOrColors = (type: string, completed: boolean) => {
    if (completed) return 'border-emerald-200 bg-white text-emerald-800';
    if (type === 'Rest' || type === 'Recovery') return 'border-gray-150 bg-white text-slate-500';
    return 'border-indigo-150 bg-white text-indigo-700';
  };

  const getDayStatusLabel = (type: string, completed: boolean, shifted: string) => {
    if (completed) return { text: 'COMPLETED', color: 'bg-emerald-50 text-emerald-700 border-emerald-150' };
    if (shifted && shifted !== 'Standard Split Allocation' && shifted !== 'Baseline Schedule Active') {
      return { text: 'ADJUSTED 💡', color: 'bg-amber-5 text-amber-700 border-amber-150' };
    }
    if (type === 'Rest') return { text: 'REST', color: 'bg-slate-50 text-slate-500 border-gray-200' };
    if (type === 'Recovery') return { text: 'ACTIVE RECOVERY', color: 'bg-sky-50 text-sky-700 border-sky-150' };
    return { text: 'PENDING', color: 'bg-indigo-5 text-indigo-700 border-indigo-150' };
  };

  return (
    <div id="planner-view" className="flex-1 flex flex-col h-full bg-[#F0F2F5] px-4 py-5 font-sans overflow-y-auto scrollbar-none">
      
      {/* HEADER ROW */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-[10px] text-slate-500 font-mono tracking-widest font-black uppercase">7-DAY MICROCYCLE PERIODIZATION</span>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Weekly Planner <Calendar className="w-5 h-5 text-indigo-600" />
          </h2>
        </div>
        <button
          id="regenerate-plan-btn"
          onClick={onRegeneratePlan}
          disabled={isRegenerating}
          className="text-[9px] uppercase tracking-wider font-bold font-mono text-indigo-700 hover:text-indigo-800 bg-indigo-50 border border-indigo-150 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? "Planning..." : "Re-Plan"}
        </button>
      </div>

      {/* ADAPTIVE WARNING EXPLANATION BANNER */}
      {plan?.adaptiveNotes && (
        <div className="mb-5 bg-gradient-to-r from-amber-50 to-amber-100/40 border border-amber-150 text-amber-900 rounded-2xl p-3.5 text-xs flex gap-3 items-start shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-extrabold tracking-tight uppercase text-[9px] tracking-widest text-[#B45309] font-mono">
              Adaptive Scheduling Engine Alert
            </h4>
            <p className="leading-relaxed text-slate-800 font-medium">
              {plan.adaptiveNotes}
            </p>
          </div>
        </div>
      )}

      {/* PLAN DAYS CARD STACK */}
      {!plan ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Calendar className="w-8 h-8 text-slate-400 animate-pulse" />
          <p className="text-xs text-slate-500 font-mono">No periodized plans located in SQLite store. Synchronize your biometrics to initiate.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          {daysOrdered.map((dayName) => {
            const dayData = plan.days[dayName];
            if (!dayData) return null;

            const isExpanded = expandedDay === dayName;
            const isRest = dayData.type === 'Rest' || dayData.type === 'Recovery';
            const cardTheme = getDayTypeStatsOrColors(dayData.type, dayData.completed);
            const statusLabel = getDayStatusLabel(dayData.type, dayData.completed, dayData.rescheduledReason || '');

            return (
              <div 
                key={dayName} 
                className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${cardTheme}`}
              >
                {/* Header line clicked to expand */}
                <div 
                  id={`planner-day-row-${dayName}`}
                  onClick={() => toggleDayExpansion(dayName)}
                  className="p-3.5 flex justify-between items-center cursor-pointer select-none bg-white hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${isRest ? 'bg-slate-100 text-slate-500' : dayData.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {isRest ? <Moon className="w-4 h-4" /> : <Dumbbell className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 leading-tight font-sans">{dayName}</h3>
                      <span className="text-[10px] text-slate-505 font-mono block">
                        Split Focus: <strong className="text-slate-700 font-bold">{dayData.type}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${statusLabel.color}`}>
                      {statusLabel.text}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-95' : ''}`} />
                  </div>
                </div>

                {/* Sub-exercises layout (collapsible) */}
                {isExpanded && (
                  <div className="px-4 py-3.5 bg-slate-50/70 border-t border-gray-150 space-y-3.5 animate-fade-in text-xs">
                    {/* ADK reschedule alert detail flag */}
                    {dayData.rescheduledReason && dayData.rescheduledReason !== 'Standard Split Allocation' && dayData.rescheduledReason !== 'Baseline Schedule Active' && (
                      <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-900 leading-relaxed flex gap-2 font-medium">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-amber-955 font-bold">Micro-Shift Adjustment: </strong>
                          {dayData.rescheduledReason}
                        </div>
                      </div>
                    )}

                    {/* Exercise items list */}
                    <div className="space-y-2.5">
                      <div className="text-[9px] text-slate-500 uppercase font-mono tracking-widest font-black border-b border-gray-200 pb-1">
                        Prescribed Movements
                      </div>
                      {dayData.exercises && dayData.exercises.length > 0 ? (
                        dayData.exercises.map((exe) => (
                          <div key={exe.id} className="flex justify-between items-center text-slate-700 bg-white p-2.5 rounded-xl border border-gray-150">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold shrink-0 shadow-inner">
                                {exe.weightLbs ? `${exe.weightLbs} lbs` : 'BW'}
                              </span>
                              <span className="font-bold text-slate-800">{exe.name}</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 shrink-0 font-medium">
                              {exe.sets}s x {exe.reps}r
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 italic">No specific exercises generated. Free restorative sleep cycle.</p>
                      )}
                    </div>

                    {/* Completion indicators */}
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-[10px] text-slate-500 font-mono font-semibold">
                        Generated by Workout Agent
                      </span>
                      {dayData.completed ? (
                        <div className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Checked Complete
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-450 italic font-mono">Pending active completion</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
