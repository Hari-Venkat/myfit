import React, { useState } from 'react';
import { UserProfile } from '../types.js';
import { Dumbbell, ShieldCheck, Activity, Heart, ArrowRight, Sparkles, Download } from 'lucide-react';

interface OnboardingScreenProps {
  onOnboardComplete: (profile: UserProfile) => void;
}

export default function OnboardingScreen({ onOnboardComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0); // 0 = landing page
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    height: '',
    weight: '',
    goalWeight: '',
    fitnessGoal: 'Weight Loss' as UserProfile['fitnessGoal'],
    daysPerWeek: '4',
    workoutStyle: 'Push Pull Legs' as UserProfile['workoutStyle']
  });

  const [permissions, setPermissions] = useState({
    steps: false,
    sleep: false,
    activeCalories: false,
    nutrition: false,
    weight: false,
    heartRate: false
  });

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced'>('idle');

  const handleSyncGoogle = async () => {
    setImporting(true);
    try {
      // Check if Google is connected
      const statusRes = await fetch('/api/google-fit/status');
      const status = await statusRes.json();

      if (!status.connected) {
        // Start OAuth flow
        const authRes = await fetch('/api/auth/google');
        const authData = await authRes.json();
        if (authData.authUrl) {
          const popup = window.open(authData.authUrl, 'google-auth', 'width=500,height=600');
          await new Promise<void>((resolve) => {
            const handler = (e: MessageEvent) => {
              if (e.data === 'google-fit-connected') {
                window.removeEventListener('message', handler);
                resolve();
              }
            };
            window.addEventListener('message', handler);
            const interval = setInterval(() => {
              if (popup?.closed) {
                clearInterval(interval);
                window.removeEventListener('message', handler);
                resolve();
              }
            }, 500);
          });
        }
      }

      // Fetch profile from Google
      const profileRes = await fetch('/api/google-fit/profile');
      if (!profileRes.ok) {
        throw new Error('Failed to fetch profile from Google');
      }
      const googleProfile = await profileRes.json();

      setFormData(prev => ({
        ...prev,
        ...(googleProfile.name ? { name: googleProfile.name } : {}),
        ...(googleProfile.age ? { age: String(googleProfile.age) } : {}),
        ...(googleProfile.height ? { height: String(googleProfile.height) } : {}),
        ...(googleProfile.weight ? { weight: String(googleProfile.weight) } : {})
      }));

      // Auto-select all permissions since they connected Google Fit
      setPermissions({
        steps: true, sleep: true, activeCalories: true,
        nutrition: true, weight: true, heartRate: true
      });

      setSyncStatus('synced');

      // Move to step 1 (profile form) with pre-filled data
      setStep(1);
    } catch (e) {
      console.error('Sync error:', e);
      alert('Could not sync with Google. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllPermissions = () => {
    setPermissions({
      steps: true,
      sleep: true,
      activeCalories: true,
      nutrition: true,
      weight: true,
      heartRate: true
    });
  };

  const handleNextStep = () => {
    if (step === 1 && !formData.name.trim()) {
      alert("Please enter your name");
      return;
    }
    if (step === 1 && (!formData.age || !formData.height || !formData.weight)) {
      alert("Please fill in age, height and weight");
      return;
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: Number(formData.age),
          height: Number(formData.height),
          weight: Number(formData.weight),
          goalWeight: formData.goalWeight ? Number(formData.goalWeight) : undefined,
          daysPerWeek: Number(formData.daysPerWeek)
        })
      });

      if (!response.ok) {
        throw new Error("Failed to submit onboarding profiles");
      }

      // If Google Fit was synced, pull health data now
      if (syncStatus === 'synced') {
        await fetch('/api/google-fit/sync', { method: 'POST' }).catch(() => {});
      }

      const data = await response.json();
      onOnboardComplete(data.profile);
    } catch (e) {
      console.error(e);
      alert("Error on onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="onboarding-panel" className="flex flex-col h-full bg-[#F0F2F5] text-slate-800 overflow-y-auto px-6 py-6 font-sans">
      
      {/* Brand Icon & Heading */}
      <div className="flex items-center gap-3 justify-center mb-8">
        <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-500/10">
          <Dumbbell className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 font-sans">MyFit</h1>
          <p className="text-[10px] text-emerald-600 font-mono tracking-widest font-black uppercase">YOUR AI FITNESS COACH</p>
        </div>
      </div>

      {/* STEP 0: LANDING PAGE */}
      {step === 0 && (
        <div className="flex-1 flex flex-col justify-between animate-fade-in">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6">
              <Activity className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome to MyFit</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-[260px] leading-relaxed">
              Sync your Google Fit account to auto-import your profile, or set up manually.
            </p>

            <button
              onClick={handleSyncGoogle}
              disabled={importing}
              className="w-full bg-white border-2 border-emerald-500 hover:bg-emerald-50 text-emerald-700 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer text-sm shadow-sm disabled:opacity-50 mb-3"
            >
              {importing ? (
                "Connecting to Google..."
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Sync with Google Fit
                </>
              )}
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              Set up manually
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-4">
            Your data stays on your device. We never share your health information.
          </p>
        </div>
      )}

      {/* Progress Circles */}
      {step >= 1 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-emerald-600 scale-110 shadow' : 'bg-gray-300'}`} />
          <div className="w-10 h-[2px] bg-gray-300" />
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-emerald-600 scale-110 shadow' : 'bg-gray-300'}`} />
          {syncStatus !== 'synced' && (
            <>
              <div className="w-10 h-[2px] bg-gray-300" />
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-emerald-600 scale-110 shadow' : 'bg-gray-300'}`} />
            </>
          )}
        </div>
      )}

      {/* STEP 1: PERSONAL BIOMETRICS */}
      {step === 1 && (
        <div className="flex-1 flex flex-col justify-between animate-fade-in">
          <div>
            <h2 className="text-xl font-bold mb-1 text-slate-800">Create Your Profile</h2>
            <p className="text-sm text-slate-500 mb-6">Let's register your starting bio-metrics to tailor calories and weights.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">What is your Name?</label>
                <input
                  id="onboard-name-input"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                  className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all font-sans shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Age</label>
                  <input
                    id="onboard-age-input"
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
                  <select
                    id="onboard-gender-select"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-Binary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Height (cm)</label>
                  <input
                    id="onboard-height-input"
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Weight (kg)</label>
                  <input
                    id="onboard-weight-input"
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            id="onboard-step1-btn"
            onClick={handleNextStep}
            className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 2: FITNESS GOALS & FREQUENCY */}
      {step === 2 && (
        <div className="flex-1 flex flex-col justify-between animate-fade-in">
          <div>
            <h2 className="text-xl font-bold mb-1 text-slate-800">Define Fitness Goals</h2>
            <p className="text-sm text-slate-500 mb-6">Choose your parameters for the ADK Planner & Nutrition engines.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fitness Goal</label>
                <div className="grid grid-cols-1 gap-2">
                  {(['Weight Loss', 'Fat Loss', 'Muscle Gain', 'Maintain Weight', 'General Fitness'] as UserProfile['fitnessGoal'][]).map((g) => (
                    <button
                      id={`goal-${g.replace(' ', '-')}`}
                      key={g}
                      onClick={() => setFormData(prev => ({ ...prev, fitnessGoal: g }))}
                      className={`text-left px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none flex justify-between items-center ${formData.fitnessGoal === g ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' : 'bg-white border-gray-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span>{g}</span>
                      {formData.fitnessGoal === g && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {formData.fitnessGoal !== 'Maintain Weight' && formData.fitnessGoal !== 'General Fitness' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Target Weight (kg)</label>
                  <input
                    id="onboard-goal-weight-input"
                    type="number"
                    name="goalWeight"
                    value={formData.goalWeight}
                    onChange={handleInputChange}
                    placeholder="Enter your ideal weight"
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Workouts / Week</label>
                  <select
                    id="onboard-days-select"
                    name="daysPerWeek"
                    value={formData.daysPerWeek}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  >
                    <option value="3">3 Days</option>
                    <option value="4">4 Days</option>
                    <option value="5">5 Days</option>
                    <option value="6">6 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Workout Schedule</label>
                  <select
                    id="onboard-style-select"
                    name="workoutStyle"
                    value={formData.workoutStyle}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-600 transition-all font-sans shadow-sm"
                  >
                    <option value="Push Pull Legs">Push Pull Legs</option>
                    <option value="Upper Lower">Upper Lower</option>
                    <option value="Full Body">Full Body</option>
                    <option value="Bro Split">Bro Split</option>
                    <option value="Arnold Split">Arnold Split</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              id="onboard-step2-back-btn"
              onClick={handlePrevStep}
              className="flex-1 bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm shadow-sm"
            >
              Back
            </button>
            <button
              id="onboard-step2-next-btn"
              onClick={syncStatus === 'synced' ? handleSubmit : handleNextStep}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:bg-emerald-600/50"
            >
              {syncStatus === 'synced' ? (loading ? "Initializing..." : <>Complete Setup <Sparkles className="w-4 h-4" /></>) : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ANDROID HEALTH CONNECT INTEGRATION */}
      {step === 3 && (
        <div className="flex-1 flex flex-col justify-between animate-fade-in">
          <div>
            <h2 className="text-xl font-bold mb-1 text-slate-800">Android Health Connect</h2>
            <p className="text-sm text-slate-500 mb-6">Connect your device datastore. We require read access to construct genuine ADK analysis.</p>

            {/* Permission Scopes */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-gray-150 pb-2">
                <span className="text-[9px] font-black text-slate-500 font-mono tracking-wider uppercase">REQUIRED WRITE & READ SCOPES</span>
                <button
                  id="onboard-select-all-btn"
                  onClick={selectAllPermissions}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold font-mono cursor-pointer"
                >
                  ALLOW ALL
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'steps', title: 'Steps & Distance Counters', icon: Activity },
                  { key: 'sleep', title: 'Sleep Session Latencies', icon: Heart },
                  { key: 'activeCalories', title: 'Active Expended Calories', icon: Activity },
                  { key: 'nutrition', title: 'Macronutrients & Water logs', icon: Sparkles },
                  { key: 'weight', title: 'Body Mass Metrics Timeline', icon: ShieldCheck },
                  { key: 'heartRate', title: 'Cardiovascular Heart Rates', icon: Heart }
                ].map((item) => {
                  const Icon = item.icon;
                  const isChecked = permissions[item.key as keyof typeof permissions];
                  return (
                    <div
                      key={item.key}
                      onClick={() => togglePermission(item.key as keyof typeof permissions)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-emerald-5 border-emerald-300 text-slate-800 font-bold' : 'bg-slate-50 border-gray-200 text-slate-500 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isChecked ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-semibold">{item.title}</span>
                      </div>
                      <input
                        id={`perm-check-${item.key}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Hanlded by div tap
                        className="rounded accent-emerald-600 bg-white border-gray-300 w-4 h-4"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 items-start text-[11px] text-slate-655 bg-emerald-5 border border-emerald-100 rounded-lg p-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-emerald-950 font-medium font-sans">
                Health Connect encrypts your fitness statistics securely and never leaks data. MyFit is an offline-friendly trainer leveraging Local SQLite databases to persist metrics.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              id="onboard-step3-back-btn"
              onClick={handlePrevStep}
              className="flex-1 bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm shadow-sm"
              disabled={loading}
            >
              Back
            </button>
            <button
              id="onboard-submit-btn"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:bg-emerald-600/50"
            >
              {loading ? "Initializing..." : "Complete Setup"} <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
