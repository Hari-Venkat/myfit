import React, { useState } from 'react';
import { UserProfile } from '../types.js';
import {
  User,
  Ruler,
  Weight,
  Target,
  Dumbbell,
  Calendar,
  ChevronRight,
  Save,
  LogOut,
  Pencil
} from 'lucide-react';

interface ProfileScreenProps {
  user: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onResetAccount: () => void;
}

export default function ProfileScreen({ user, onUpdateProfile, onResetAccount }: ProfileScreenProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    age: user.age.toString(),
    gender: user.gender,
    height: user.height.toString(),
    weight: user.weight.toString(),
    goalWeight: user.goalWeight?.toString() || '',
    fitnessGoal: user.fitnessGoal,
    daysPerWeek: user.daysPerWeek.toString(),
    workoutStyle: user.workoutStyle
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = {
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        height: Number(form.height),
        weight: Number(form.weight),
        goalWeight: form.goalWeight ? Number(form.goalWeight) : undefined,
        fitnessGoal: form.fitnessGoal as UserProfile['fitnessGoal'],
        daysPerWeek: Number(form.daysPerWeek),
        workoutStyle: form.workoutStyle as UserProfile['workoutStyle']
      };
      onUpdateProfile(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F0F2F5] overflow-y-auto scrollbar-none font-sans">

      {/* Profile Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-5 pt-6 pb-8 text-white relative">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-90">My Profile</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xl font-black tracking-tight shrink-0">
            {initials}
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">{user.name}</h3>
            <p className="text-xs opacity-80 mt-0.5">{user.fitnessGoal} Program</p>
            <p className="text-[10px] opacity-60 mt-0.5 font-mono">Member since {memberSince}</p>
          </div>
        </div>
      </div>

      {/* Body Stats Quick View */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm grid grid-cols-3 divide-x divide-gray-100 p-3">
          <div className="text-center">
            <p className="text-lg font-black text-slate-800 font-mono">{user.height}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Height cm</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-slate-800 font-mono">{user.weight}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Weight kg</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-emerald-600 font-mono">{user.goalWeight || '--'}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Goal kg</p>
          </div>
        </div>
      </div>

      {/* Edit Form or Info Cards */}
      <div className="px-4 pt-4 pb-6 space-y-3">

        {editing ? (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Personal Details</h4>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Age</label>
                  <input
                    type="number"
                    value={form.age}
                    onChange={(e) => handleChange('age', e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-Binary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={form.height}
                    onChange={(e) => handleChange('height', e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={form.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Goal Weight (kg)</label>
                <input
                  type="number"
                  value={form.goalWeight}
                  onChange={(e) => handleChange('goalWeight', e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Training Preferences</h4>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Fitness Goal</label>
                <select
                  value={form.fitnessGoal}
                  onChange={(e) => handleChange('fitnessGoal', e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option>Weight Loss</option>
                  <option>Fat Loss</option>
                  <option>Muscle Gain</option>
                  <option>Maintain Weight</option>
                  <option>General Fitness</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Days / Week</label>
                  <select
                    value={form.daysPerWeek}
                    onChange={(e) => handleChange('daysPerWeek', e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="3">3 Days</option>
                    <option value="4">4 Days</option>
                    <option value="5">5 Days</option>
                    <option value="6">6 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Workout Style</label>
                  <select
                    value={form.workoutStyle}
                    onChange={(e) => handleChange('workoutStyle', e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option>Push Pull Legs</option>
                    <option>Upper Lower</option>
                    <option>Full Body</option>
                    <option>Bro Split</option>
                    <option>Arnold Split</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditing(false);
                  setForm({
                    name: user.name,
                    age: user.age.toString(),
                    gender: user.gender,
                    height: user.height.toString(),
                    weight: user.weight.toString(),
                    goalWeight: user.goalWeight?.toString() || '',
                    fitnessGoal: user.fitnessGoal,
                    daysPerWeek: user.daysPerWeek.toString(),
                    workoutStyle: user.workoutStyle
                  });
                }}
                className="flex-1 bg-white border border-gray-200 text-slate-700 font-semibold py-3 rounded-xl text-sm cursor-pointer transition-all hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Info Cards (Read-only view) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Personal Details</h4>
              </div>
              <InfoRow icon={User} label="Name" value={user.name} />
              <InfoRow icon={Calendar} label="Age" value={`${user.age} years`} />
              <InfoRow icon={User} label="Gender" value={user.gender} />
              <InfoRow icon={Ruler} label="Height" value={`${user.height} cm`} />
              <InfoRow icon={Weight} label="Current Weight" value={`${user.weight} kg`} />
              <InfoRow icon={Target} label="Goal Weight" value={user.goalWeight ? `${user.goalWeight} kg` : 'Not set'} last />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Training Preferences</h4>
              </div>
              <InfoRow icon={Target} label="Fitness Goal" value={user.fitnessGoal} />
              <InfoRow icon={Calendar} label="Workouts / Week" value={`${user.daysPerWeek} days`} />
              <InfoRow icon={Dumbbell} label="Workout Style" value={user.workoutStyle} last />
            </div>

            {/* Reset Account */}
            <button
              onClick={onResetAccount}
              className="w-full bg-white border border-red-200 text-red-600 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-red-50 mt-2"
            >
              <LogOut className="w-4 h-4" />
              Reset Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-gray-50'}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <span className="text-xs text-slate-800 font-semibold">{value}</span>
    </div>
  );
}
