import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  HealthMetricLog,
  WeeklyPlan,
  DailyAIBriefing,
  ChatMessage
} from './types.js';

import MobileDevice from './components/MobileDevice.tsx';
import OnboardingScreen from './components/OnboardingScreen.tsx';
import DashboardScreen from './components/DashboardScreen.tsx';
import ChatScreen from './components/ChatScreen.tsx';
import PlannerScreen from './components/PlannerScreen.tsx';

import ProfileScreen from './components/ProfileScreen.tsx';

import {
  Dumbbell,
  RotateCcw
} from 'lucide-react';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'plan' | 'profile'>('home');
  
  // Data State
  const [dailyBriefing, setDailyBriefing] = useState<DailyAIBriefing | null>(null);
  const [latestMetrics, setLatestMetrics] = useState<HealthMetricLog | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Loading indicator states
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);

  // Initialize and Fetch Databases
  useEffect(() => {
    fetchInitialSystemState();
  }, []);

  const fetchInitialSystemState = async () => {
    try {
      setLoadingDashboard(true);
      
      // 1. Fetch user onboarding profile
      const userRes = await fetch('/api/user/profile');
      const userData = await userRes.json();
      
      if (userData.profile) {
        setUserProfile(userData.profile);
        
        // Parallel data load
        await Promise.all([
          fetchDailyBriefing(),
          fetchHealthLogs(),
          fetchWeeklyPlan(),
          fetchChatHistory()
        ]);
      }
    } catch (e) {
      console.error("Failed to load initial MyFit system state:", e);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchDailyBriefing = async () => {
    try {
      const res = await fetch('/api/daily-briefing');
      const data = await res.json();
      setDailyBriefing(data.briefing);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHealthLogs = async () => {
    try {
      const res = await fetch('/api/health-connect/logs');
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLatestMetrics(data.logs[0]); // Top is today's metric
      } else {
        setLatestMetrics(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWeeklyPlan = async () => {
    try {
      const res = await fetch('/api/weekly-plan');
      const data = await res.json();
      setWeeklyPlan(data.plan);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch('/api/coach/chat/history');
      const data = await res.json();
      setChatHistory(data.history || []);
    } catch (e) {
      console.error(e);
    }
  };


  // Onboarding Setup Finish
  const handleOnboardComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    fetchInitialSystemState();
  };

  // Reset core database to clear state
  const handleSystemReset = async () => {
    if (!window.confirm("This will clear all user profiles, synchronized Health Connect records, and chat history. Continue?")) return;
    try {
      const res = await fetch('/api/user/reset', { method: 'POST' });
      if (res.ok) {
        setUserProfile(null);
        setDailyBriefing(null);
        setLatestMetrics(null);
        setWeeklyPlan(null);
        setChatHistory([]);
        setActiveTab('home');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Water hydration log increment
  const handleAddWater = async (amount: number) => {
    if (!latestMetrics) return;
    try {
      const currentWater = latestMetrics.waterIntake || 0;
      const updatedRecord = { ...latestMetrics, waterIntake: currentWater + amount };

      const response = await fetch('/api/health-connect/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord)
      });
      if (response.ok) {
        const data = await response.json();
        setLatestMetrics(data.record);
        await fetchDailyBriefing();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Gym training completed
  const handleWorkoutLogged = async () => {
    await Promise.all([
      fetchDailyBriefing(),
      fetchWeeklyPlan()
    ]);
  };

  // regenerate plan manually
  const handleRegeneratePlan = async () => {
    setRegeneratingPlan(true);
    try {
      const res = await fetch('/api/weekly-plan/regenerate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWeeklyPlan(data.plan);
        setDailyBriefing(data.briefing);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegeneratingPlan(false);
    }
  };

  // Send messaging in chat
  const handleSendChatMessage = async (text: string) => {
    try {
      setSendingChat(true);

      // Optimistic user message append
      const userMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        sender: 'user',
        text,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, userMsg]);

      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await response.json();
      if (data.message) {
        setChatHistory(prev => [...prev, data.message]);
      } else {
        throw new Error("No message in response");
      }
    } catch (e) {
      console.error(e);
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        sender: 'coach',
        text: 'Sorry, I encountered an error. The AI service may be temporarily unavailable. Please try again in a moment.',
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleClearChatHistory = async () => {
    if (!window.confirm("Clear all counseling chat logs?")) return;
    try {
      const res = await fetch('/api/coach/chat/clear', { method: 'POST' });
      if (res.ok) {
        setChatHistory([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = async (updated: Partial<UserProfile>) => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div id="myfit-applet-root" className="h-dvh bg-[#F0F2F5] text-slate-800 flex flex-col font-sans select-none antialiased overflow-hidden">

      {/* DESKTOP-ONLY HEADER — hidden on mobile */}
      <header className="hidden sm:flex h-16 bg-white border-b border-gray-200 px-6 items-center justify-between shrink-0 box-border z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/10">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 leading-none tracking-tight font-sans">
              MyFit
            </h1>
            <p className="text-[10px] text-emerald-600 font-mono tracking-wider font-semibold uppercase mt-0.5">
              Your Personal AI Fitness Coach
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="global-reset-btn"
            onClick={handleSystemReset}
            className="bg-slate-100 hover:bg-slate-200 hover:text-rose-600 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-600 font-sans tracking-tight transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset State
          </button>
        </div>
      </header>

      {/* MAIN CONTENT — full-screen on mobile, centered emulator on desktop */}
      <main className="flex-1 flex items-center justify-center overflow-hidden sm:bg-slate-50">

        <MobileDevice
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showNavigation={!!userProfile}
        >
          {!userProfile ? (
            <OnboardingScreen onOnboardComplete={handleOnboardComplete} />
          ) : (
            <>
              {activeTab === 'home' && (
                <DashboardScreen
                  user={userProfile}
                  briefing={dailyBriefing}
                  latestMetrics={latestMetrics}
                  onLogCompletedWorkout={handleWorkoutLogged}
                  onAddWater={handleAddWater}
                  onGoToProfile={() => setActiveTab('profile')}
                  isLoading={loadingDashboard}
                />
              )}
              {activeTab === 'chat' && (
                <ChatScreen
                  chatHistory={chatHistory}
                  onSendMessage={handleSendChatMessage}
                  onClearHistory={handleClearChatHistory}
                  isCoachTyping={sendingChat}
                />
              )}
              {activeTab === 'plan' && (
                <PlannerScreen
                  plan={weeklyPlan}
                  onRegeneratePlan={handleRegeneratePlan}
                  isRegenerating={regeneratingPlan}
                />
              )}
{activeTab === 'profile' && (
                <ProfileScreen
                  user={userProfile}
                  onUpdateProfile={handleUpdateProfile}
                  onResetAccount={handleSystemReset}
                />
              )}
            </>
          )}
        </MobileDevice>

      </main>

    </div>
  );
}
