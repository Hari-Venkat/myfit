import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types.js';
import { Send, ArrowLeft, Bot, Sparkles, User, Database, RefreshCw, AlertCircle } from 'lucide-react';

interface ChatScreenProps {
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  isCoachTyping: boolean;
  onBackToDashboard?: () => void;
}

export default function ChatScreen({ 
  chatHistory, 
  onSendMessage, 
  onClearHistory, 
  isCoachTyping,
  onBackToDashboard 
}: ChatScreenProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const suggestionChips = [
    "Can I skip the gym today?",
    "Why is my recovery score low?",
    "What should I eat after a workout?",
    "How is my training progress?"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isCoachTyping]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText).catch(console.error);
    setInputText('');
  };

  const handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleChipClick = (chip: string) => {
    onSendMessage(chip).catch(console.error);
  };

  // Safe manual markdown parser that produces secure, clean styled paragraphs, lists and subtitles
  const parseMarkdownHtml = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();
      
      // Header
      if (trimmed.startsWith('#')) {
        const depth = trimmed.match(/^#+/)?.[0].length || 1;
        const textVal = trimmed.replace(/^#+\s*/, '');
        const sizeClass = depth === 1 ? 'text-lg font-bold text-white mt-3' : 'text-sm font-bold text-slate-200 mt-2';
        return <h4 key={idx} className={`${sizeClass} leading-tight`}>{textVal}</h4>;
      }
      
      // Bullet list item
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const textVal = trimmed.replace(/^[-*]\s*/, '');
        // Parse bold elements inside markdown line
        const boldParsed = parseBoldElements(textVal);
        return (
          <li key={idx} className="list-none flex gap-2 items-start text-xs text-slate-300 ml-1.5 my-1 leading-relaxed">
            <span className="w-1 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
            <span className="flex-1">{boldParsed}</span>
          </li>
        );
      }

      // Empty line
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Standard text line with potential bold tags
      return (
        <p key={idx} className="text-xs text-slate-300 leading-relaxed my-1">
          {parseBoldElements(trimmed)}
        </p>
      );
    });
  };

  // Inline Bold tag parse (**text**)
  const parseBoldElements = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-emerald-300">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div id="coach-chat-view" className="flex-1 flex flex-col h-full bg-[#F0F2F5] font-sans">
      
      {/* CHAT HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-250 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-black shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 tracking-tight leading-none mb-0.5">MyFit AI Coach</h3>
            <span className="text-[9px] text-slate-500 font-mono tracking-wide">Gemini 2.5 Expert Node</span>
          </div>
        </div>

        <button
          id="clear-chat-btn"
          onClick={onClearHistory}
          className="text-[9px] uppercase tracking-wider font-bold font-mono text-slate-500 hover:text-rose-600 bg-slate-50 px-2.5 py-1 rounded border border-gray-200 transition-all cursor-pointer"
        >
          Clear Logs
        </button>
      </div>

      {/* CHAT MESSAGE POOL */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
        
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto space-y-4 py-8">
            <div className="p-3 bg-white border border-gray-100 rounded-full text-emerald-600 shadow-sm">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-800">Ask your Coach anything</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Ask about skipping workouts, food timing, recovery indices, and target progressive gains. Gemini responds based on your live SQLite database records.
              </p>
            </div>

            {/* Quick Suggestions list */}
            <div className="grid grid-cols-1 gap-2 w-full pt-4">
              {suggestionChips.map((chip, i) => (
                <button
                  id={`chip-${i}`}
                  key={i}
                  onClick={() => handleChipClick(chip)}
                  className="bg-white hover:bg-slate-50 border border-gray-200 text-xs text-slate-700 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-left flex items-center gap-2"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="flex-1 truncate font-semibold">{chip}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {chatHistory.map((msg) => {
              const isCoach = msg.sender === 'coach';
              return (
                <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isCoach ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                  
                  {/* Sender Avatar */}
                  <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold font-mono ${isCoach ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-650 text-white'}`}>
                    {isCoach ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Speech bubble */}
                  <div className="space-y-1.5">
                    <div className={`p-3 rounded-2xl border text-xs shadow-sm ${isCoach ? 'bg-white border-gray-100 text-slate-800 rounded-tl-none' : 'bg-indigo-600 border-indigo-700 text-white rounded-tr-none'}`}>
                      {isCoach ? (
                        <div className="space-y-1">{parseMarkdownHtml(msg.text)}</div>
                      ) : (
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>

                    {/* Biometric References Telemetry indicator */}
                    {isCoach && msg.usedMetrics && (
                      <div className="flex gap-1.5 items-center bg-white border border-gray-150 rounded-lg px-2 py-1 text-[9px] text-slate-500/85 font-mono shadow-sm">
                        <Database className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Analyzed user steps, sleep tracker and recovery index.</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}

            {/* TYPING STATE INDICATOR */}
            {isCoachTyping && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

      </div>

      {/* INPUT CONTROLS ROW */}
      <div className="p-3 border-t border-gray-200 bg-white shrink-0 shadow-sm">
        <div className="flex gap-2">
          <input
            id="chat-text-input"
            type="text"
            placeholder={isCoachTyping ? "Trainer is thinking..." : "Consult your AI Coach..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeydown}
            disabled={isCoachTyping}
            className="flex-1 bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all disabled:opacity-50 font-sans"
          />
          <button
            id="send-chat-btn"
            onClick={handleSend}
            disabled={!inputText.trim() || isCoachTyping}
            className="p-3 bg-emerald-600 text-white hover:bg-emerald-700 transition-all rounded-xl flex items-center justify-center font-bold disabled:opacity-45 cursor-pointer text-xs shadow-sm shadow-emerald-500/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
