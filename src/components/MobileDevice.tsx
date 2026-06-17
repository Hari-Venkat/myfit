import React, { useState, useEffect } from 'react';
import { Home, Bot, Calendar, Wifi, Battery, Volume2 } from 'lucide-react';

type TabId = 'home' | 'chat' | 'plan' | 'profile';

interface MobileDeviceProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  showNavigation: boolean;
}

const tabs: { id: TabId; icon: typeof Home; label: string }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'chat', icon: Bot, label: 'AI Coach' },
  { id: 'plan', icon: Calendar, label: 'Planner' }
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function BottomNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: TabId) => void }) {
  return (
    <div className="bg-white border-t border-gray-200 flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0 select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            id={`m3-tab-btn-${tab.id}`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center justify-center gap-0.5 cursor-pointer flex-1 text-slate-500"
          >
            <div className={`p-1 px-3 rounded-full transition-all duration-200 ${isActive ? 'bg-emerald-50 text-emerald-700 px-4' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon className="w-5 h-5 sm:w-4 sm:h-4" />
            </div>
            <span className={`text-[10px] sm:text-[9px] font-bold tracking-tight ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function MobileDevice({ children, activeTab, onTabChange, showNavigation }: MobileDeviceProps) {
  const isMobile = useIsMobile();

  // Real-time hour minutes formatted
  const getFormattedDeviceTime = () => {
    const d = new Date();
    let hrs = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, '0');
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    return `${hrs}:${mins} ${ampm}`;
  };

  // On real mobile: full-screen native layout, no fake phone frame
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-[#F0F2F5]">
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {children}
        </div>
        {showNavigation && <BottomNav activeTab={activeTab} onTabChange={onTabChange} />}
      </div>
    );
  }

  // On desktop: show the phone emulator frame
  return (
    <div className="relative mx-auto w-[330px] h-[670px] bg-black rounded-[42px] border-4 border-slate-800 shadow-2xl p-2.5 flex flex-col overflow-hidden shrink-0 ring-1 ring-slate-800 shadow-indigo-950/20">

      {/* SPEAKER NOTCH BEZEL */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50 flex items-center justify-between px-3.5 pb-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-800" />
        <div className="w-10 h-1 bg-slate-900 rounded-full" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
      </div>

      {/* DEVICE STATUS BAR */}
      <div className="h-6 flex justify-between items-center px-4 pt-1 bg-white text-[10px] text-slate-500 border-b border-gray-100 font-mono font-semibold relative z-10 shrink-0 select-none">
        <span>{getFormattedDeviceTime()}</span>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5" />
          <Volume2 className="w-3.5 h-3.5" />
          <div className="flex items-center gap-0.5">
            <span className="text-[9px]">98%</span>
            <Battery className="w-4 h-4 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* SCREEN CONTENT */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-[#F0F2F5]">
        {children}
      </div>

      {/* TAB NAVIGATION BAR */}
      {showNavigation && <BottomNav activeTab={activeTab} onTabChange={onTabChange} />}

      {/* PHYSICAL BOTTOM HOME BAR */}
      <div className="h-3 shrink-0 flex items-center justify-center pb-0.5 select-none bg-black">
        <div className="w-24 h-1 bg-slate-800 rounded-full" />
      </div>

    </div>
  );
}
