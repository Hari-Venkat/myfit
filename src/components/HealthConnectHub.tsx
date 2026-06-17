import React, { useState, useEffect } from 'react';
import {
  Activity,
  Moon,
  Heart,
  Droplet,
  Settings,
  RefreshCw,
  ShieldAlert,
  FileCheck,
  Zap,
  Link,
  Unlink,
  CloudDownload,
  CheckCircle2
} from 'lucide-react';

interface HealthConnectHubProps {
  onSyncComplete: (record: any) => void;
  userWeight: number;
}

export default function HealthConnectHub({ onSyncComplete, userWeight }: HealthConnectHubProps) {
  const [mode, setMode] = useState<'google' | 'manual'>('google');
  const [googleFitStatus, setGoogleFitStatus] = useState<{ connected: boolean; connectedAt: string | null; expired: boolean }>({
    connected: false, connectedAt: null, expired: true
  });
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Manual input state
  const [inputs, setInputs] = useState({
    steps: 6200,
    activeCaloriesBurned: 240,
    sleepDuration: 7.5,
    sleepQuality: 82,
    waterIntake: 1.8,
    proteinGrams: 85,
    caloriesConsumed: 1800,
    weight: userWeight || 82,
    heartRateAverage: 65
  });
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    checkGoogleFitStatus();
    // Listen for OAuth popup callback
    const handler = (e: MessageEvent) => {
      if (e.data === 'google-fit-connected') {
        checkGoogleFitStatus();
        setConnectingGoogle(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const checkGoogleFitStatus = async () => {
    try {
      const res = await fetch('/api/google-fit/status');
      const data = await res.json();
      setGoogleFitStatus(data);
      if (data.connected) setMode('google');
    } catch { /* ignore */ }
  };

  const connectGoogleFit = async () => {
    setConnectingGoogle(true);
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setConnectingGoogle(false);
        return;
      }
      // Open OAuth in a popup
      window.open(data.authUrl, 'google-fit-auth', 'width=500,height=700,left=200,top=100');
    } catch {
      setConnectingGoogle(false);
    }
  };

  const disconnectGoogleFit = async () => {
    await fetch('/api/google-fit/disconnect', { method: 'POST' });
    setGoogleFitStatus({ connected: false, connectedAt: null, expired: true });
  };

  const syncFromGoogleFit = async () => {
    setGoogleSyncing(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/google-fit/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        onSyncComplete(data.record);
        setSuccessMsg('Google Fit data synced!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        alert(data.error || 'Sync failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGoogleSyncing(false);
    }
  };

  const handleSliderChange = (key: keyof typeof inputs, val: number) => {
    setInputs(prev => ({ ...prev, [key]: val }));
  };

  const executeManualSync = async () => {
    setSyncing(true);
    setSuccessMsg('');
    try {
      const response = await fetch('/api/health-connect/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs)
      });
      if (response.ok) {
        const data = await response.json();
        onSyncComplete(data.record);
        setSuccessMsg('Manual data synced!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const loadPresetPackage = (pkg: 'tired' | 'beast' | 'cardio' | 'regular') => {
    setSuccessMsg('');
    const presets = {
      tired: { steps: 7200, activeCaloriesBurned: 350, sleepDuration: 4.2, sleepQuality: 35, waterIntake: 1.2, proteinGrams: 55, caloriesConsumed: 1500, weight: userWeight || 82, heartRateAverage: 78 },
      beast: { steps: 12500, activeCaloriesBurned: 580, sleepDuration: 8.8, sleepQuality: 92, waterIntake: 3.5, proteinGrams: 140, caloriesConsumed: 2800, weight: userWeight || 82, heartRateAverage: 58 },
      cardio: { steps: 16800, activeCaloriesBurned: 720, sleepDuration: 7.0, sleepQuality: 80, waterIntake: 3.8, proteinGrams: 110, caloriesConsumed: 2200, weight: userWeight || 82, heartRateAverage: 63 },
      regular: { steps: 6200, activeCaloriesBurned: 240, sleepDuration: 7.5, sleepQuality: 82, waterIntake: 1.8, proteinGrams: 85, caloriesConsumed: 1800, weight: userWeight || 82, heartRateAverage: 65 }
    };
    setInputs(presets[pkg]);
  };

  return (
    <div className="h-full bg-white text-slate-800 overflow-y-auto px-4 py-4 font-sans scrollbar-none">

      {/* Title */}
      <div className="flex items-center gap-2.5 mb-4 border-b border-gray-100 pb-3">
        <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0 border border-emerald-100">
          <Heart className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase">Health Connect</h2>
          <span className="text-[10px] text-emerald-600 font-mono font-bold uppercase">Sync Your Health Data</span>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-gray-200">
        <button
          onClick={() => setMode('google')}
          className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${mode === 'google' ? 'bg-white text-emerald-700 border border-gray-200 shadow-sm' : 'text-slate-500'}`}
        >
          <CloudDownload className="w-3.5 h-3.5" /> Google Fit
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${mode === 'manual' ? 'bg-white text-emerald-700 border border-gray-200 shadow-sm' : 'text-slate-500'}`}
        >
          <Settings className="w-3.5 h-3.5" /> Manual Entry
        </button>
      </div>

      {/* GOOGLE FIT MODE */}
      {mode === 'google' && (
        <div className="space-y-4">
          {/* Connection Status Card */}
          <div className={`p-4 rounded-2xl border ${googleFitStatus.connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${googleFitStatus.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-bold text-slate-800">
                  {googleFitStatus.connected ? 'Google Fit Connected' : 'Not Connected'}
                </span>
              </div>
              {googleFitStatus.connected && (
                <button
                  onClick={disconnectGoogleFit}
                  className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Unlink className="w-3 h-3" /> Disconnect
                </button>
              )}
            </div>

            {googleFitStatus.connected ? (
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Your Google Fit account is linked. Sync to pull today's steps, calories, heart rate, sleep, and weight data automatically.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Connect your Google account to automatically import steps, calories, heart rate, sleep, and weight from Google Fit.
              </p>
            )}
          </div>

          {/* Connect / Sync Button */}
          {!googleFitStatus.connected ? (
            <button
              onClick={connectGoogleFit}
              disabled={connectingGoogle}
              className="w-full bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-sm disabled:opacity-50"
            >
              <Link className="w-4 h-4" />
              {connectingGoogle ? 'Opening Google Sign-in...' : 'Connect Google Fit'}
            </button>
          ) : (
            <button
              onClick={syncFromGoogleFit}
              disabled={googleSyncing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${googleSyncing ? 'animate-spin' : ''}`} />
              {googleSyncing ? 'Syncing from Google Fit...' : 'Sync from Google Fit'}
            </button>
          )}

          {/* What data we pull */}
          <div className="bg-slate-50 border border-gray-200 rounded-2xl p-3 space-y-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono block">Data We Import</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Activity, label: 'Steps & Distance', color: 'text-emerald-600' },
                { icon: Heart, label: 'Heart Rate', color: 'text-rose-500' },
                { icon: Moon, label: 'Sleep Sessions', color: 'text-indigo-600' },
                { icon: Zap, label: 'Calories Burned', color: 'text-amber-600' },
                { icon: Settings, label: 'Body Weight', color: 'text-slate-600' },
                { icon: Droplet, label: 'Water (manual)', color: 'text-sky-500' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                  <item.icon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Water, protein & calorie intake are not tracked by Google Fit sensors. Use Manual Entry or log via the dashboard.
          </p>
        </div>
      )}

      {/* MANUAL MODE */}
      {mode === 'manual' && (
        <div className="space-y-4">
          {/* Preset Packages */}
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Quick Presets</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => loadPresetPackage('tired')} className="text-[11px] text-left bg-slate-50 hover:bg-slate-100 p-2.5 border border-gray-200 hover:border-amber-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div>
                  <span className="text-slate-800 block font-bold leading-none">Poor Sleep</span>
                  <span className="text-[9px] text-amber-600 font-mono font-bold">4.2h sleep</span>
                </div>
              </button>
              <button onClick={() => loadPresetPackage('beast')} className="text-[11px] text-left bg-slate-50 hover:bg-slate-100 p-2.5 border border-gray-200 hover:border-emerald-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-slate-800 block font-bold leading-none">Elite Recovery</span>
                  <span className="text-[9px] text-emerald-600 font-mono font-bold">92 quality</span>
                </div>
              </button>
              <button onClick={() => loadPresetPackage('cardio')} className="text-[11px] text-left bg-slate-50 hover:bg-slate-100 p-2.5 border border-gray-200 hover:border-sky-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                <Activity className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <div>
                  <span className="text-slate-800 block font-bold leading-none">High Cardio</span>
                  <span className="text-[9px] text-sky-600 font-mono font-bold">16.8k steps</span>
                </div>
              </button>
              <button onClick={() => loadPresetPackage('regular')} className="text-[11px] text-left bg-slate-50 hover:bg-slate-100 p-2.5 border border-gray-200 hover:border-gray-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                <FileCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <div>
                  <span className="text-slate-800 block font-bold leading-none">Standard</span>
                  <span className="text-[9px] text-slate-500 font-mono font-bold">Balanced</span>
                </div>
              </button>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-3 bg-slate-50/50 border border-gray-200 rounded-2xl p-3.5">
            {([
              { key: 'sleepDuration' as const, label: 'Sleep Duration', icon: Moon, color: 'text-indigo-600', min: 3, max: 12, step: 0.1, suffix: 'hrs', format: undefined as ((v: number) => string) | undefined },
              { key: 'sleepQuality' as const, label: 'Sleep Quality', icon: Activity, color: 'text-indigo-600', min: 20, max: 100, step: 1, suffix: '%', format: undefined },
              { key: 'steps' as const, label: 'Steps', icon: Activity, color: 'text-emerald-600', min: 1000, max: 20000, step: 100, suffix: '', format: (v: number) => v.toLocaleString() },
              { key: 'activeCaloriesBurned' as const, label: 'Calories Burned', icon: Heart, color: 'text-rose-600', min: 50, max: 1200, step: 10, suffix: 'kcal', format: undefined },
              { key: 'waterIntake' as const, label: 'Water', icon: Droplet, color: 'text-sky-600', min: 0, max: 5, step: 0.05, suffix: 'L', format: (v: number) => v.toFixed(2) },
              { key: 'weight' as const, label: 'Weight', icon: Settings, color: 'text-slate-500', min: 40, max: 155, step: 0.5, suffix: 'kg', format: undefined }
            ]).map(({ key, label, icon: Icon, color, min, max, step, suffix, format }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-700 font-bold flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} /> {label}
                  </span>
                  <span className="text-slate-900 font-mono font-extrabold text-xs">
                    {format ? format(inputs[key]) : inputs[key]} {suffix}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={inputs[key]}
                  onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                  className="w-full accent-emerald-600 h-1 bg-gray-200 rounded-lg cursor-pointer"
                />
              </div>
            ))}
          </div>

          <button
            onClick={executeManualSync}
            disabled={syncing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Health Data'}
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold py-2.5 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}
    </div>
  );
}
