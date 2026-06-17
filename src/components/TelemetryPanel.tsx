import React, { useState, useEffect } from 'react';
import { Database, Terminal, Cpu, Clock, Layers, ChevronDown } from 'lucide-react';
import { AgentTelemetryLogs } from '../types.js';

interface TelemetryPanelProps {
  telemetryLogs: AgentTelemetryLogs[];
  onRefreshTelemetry: () => void;
  dbTables: any[];
}

export default function TelemetryPanel({ telemetryLogs, onRefreshTelemetry, dbTables }: TelemetryPanelProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'sqlite'>('agent');
  const [selectedTable, setSelectedTable] = useState<string>('');

  useEffect(() => {
    if (dbTables && dbTables.length > 0 && !selectedTable) {
      setSelectedTable(dbTables[0].name);
    }
  }, [dbTables]);

  const activeTableData = dbTables.find(t => t.name === selectedTable);

  return (
    <div className="h-full bg-white border-l border-gray-200 text-slate-800 overflow-y-auto px-5 py-5 font-sans shadow-inner">
      
      {/* Title */}
      <div className="flex items-center gap-2.5 mb-5 border-b border-gray-150 pb-3 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg shrink-0 border border-indigo-105 shadow-inner">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-850 tracking-wide uppercase font-sans">ADK & SQLite Console</h2>
            <span className="text-[10px] text-indigo-650 font-mono font-black uppercase">Agent-Based Decision Kernels</span>
          </div>
        </div>
        <button
          id="refresh-telemetry-btn"
          onClick={onRefreshTelemetry}
          className="text-xs text-indigo-650 hover:text-indigo-800 font-extrabold font-mono underline cursor-pointer shrink-0"
        >
          REFRESH
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-5 border border-gray-250 shrink-0">
        <button
          id="tab-agents"
          onClick={() => setActiveTab('agent')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'agent' ? 'bg-white text-indigo-700 border border-gray-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Terminal className="w-3.5 h-3.5" /> Multi-Agent Logs
        </button>
        <button
          id="tab-sqlite"
          onClick={() => setActiveTab('sqlite')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'sqlite' ? 'bg-white text-indigo-700 border border-gray-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Database className="w-3.5 h-3.5" /> SQLite Table Viewer
        </button>
      </div>

      {/* TAB 1: ADK LOGS */}
      {activeTab === 'agent' && (
        <div className="space-y-4 font-mono text-[11px]">
          
          <div className="flex gap-2 items-center bg-indigo-50 border border-indigo-150 p-2.5 rounded-xl mb-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <p className="text-[10px] text-indigo-900 leading-normal font-sans font-semibold">
              Google ADK runs individual processing agents on the FastAPI/Express server. Inputs are queries from SQLite, outputs are structured parameters fed into the central coordinator.
            </p>
          </div>

          {telemetryLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-sans font-medium">
              No live telemetry logs generated yet. Trigger onboarding or Health Connect sync to execute agents.
            </div>
          ) : (
            telemetryLogs.map((log, i) => (
              <div 
                key={i} 
                className="bg-slate-50 border border-gray-150 rounded-xl overflow-hidden shadow-sm"
              >
                {/* Log Row Header */}
                <div className="py-2 px-3 bg-white border-b border-gray-150 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow" />
                    <span className="font-extrabold text-[10px] text-slate-800 tracking-tight uppercase">
                      {log.agentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Log Detail body */}
                <div className="p-3 bg-slate-50 space-y-2.5">
                  <div className="text-indigo-700 font-bold">{log.action}</div>
                  
                  {log.inputData && (
                    <div className="space-y-1">
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest font-sans">AGENT INPUT PARAMETERS</div>
                      <pre className="bg-white border border-gray-150 rounded-xl p-2.5 overflow-x-auto text-[10px] text-slate-700 scrollbar-none max-h-36 shadow-inner">
                        {JSON.stringify(log.inputData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.outputData && (
                    <div className="space-y-1">
                      <div className="text-[9px] text-emerald-700 uppercase font-black tracking-widest font-sans">STRUCTURED AGENT OUTPUT</div>
                      <pre className="bg-white border border-emerald-100 rounded-xl p-2.5 overflow-x-auto text-[10px] text-emerald-850 scrollbar-none max-h-36 shadow-inner">
                        {JSON.stringify(log.outputData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: SQLITE EXPLORER */}
      {activeTab === 'sqlite' && (
        <div className="space-y-4">
          
          {/* Table Selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 font-mono tracking-widest uppercase block">SELECT DATABASE TABLE</label>
            <div className="relative">
              <select
                id="select-sqlite-table"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full bg-white border border-gray-200 text-xs text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-mono shadow-sm"
              >
                {dbTables.map((t, idx) => (
                  <option key={idx} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {activeTableData ? (
            <div className="space-y-4">
              
              {/* Columns Metadata list */}
              <div className="bg-slate-50 border border-gray-150 p-3 rounded-xl space-y-1 font-mono text-[10px] shadow-inner">
                <span className="text-slate-400 block font-sans font-bold uppercase tracking-wider text-[9px]">TABLE SCHEMA METADATA</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeTableData.columns.map((col: string, idx: number) => (
                    <span key={idx} className="bg-white border border-gray-150 px-2.5 py-0.5 rounded-lg text-indigo-700 font-bold shrink-0 shadow-sm">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rows List */}
              <div className="space-y-2">
                <span className="text-[9px] text-slate-500 block font-black uppercase tracking-widest font-mono">
                  ROWS COUNT: {activeTableData.rows?.length || 0}
                </span>

                {(!activeTableData.rows || activeTableData.rows.length === 0) ? (
                  <div className="text-center py-10 bg-white border border-dashed border-gray-200 text-slate-400 text-xs rounded-xl shadow-sm">
                    Table is empty. Log data first to write rows in SQLite.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-none">
                    {activeTableData.rows.map((row: any, rIdx: number) => (
                      <div 
                        key={rIdx} 
                        className="bg-slate-50/50 border border-gray-200 p-3 rounded-xl font-mono text-[10px] overflow-x-auto scrollbar-none shadow-sm"
                      >
                        <div className="flex justify-between border-b border-gray-150 pb-1 mb-1.5">
                          <span className="text-indigo-400 font-bold">ROW #{rIdx + 1}</span>
                          <span className="text-slate-505">ID: {row.id || row.date || rIdx}</span>
                        </div>
                        <pre className="text-slate-700 max-h-36 overflow-y-auto scrollbar-none text-[10px] bg-white p-2 border border-gray-100 rounded-lg">
                          {JSON.stringify(row, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <p className="text-xs text-slate-505 italic">No table definitions found. Please refresh SQLite state.</p>
          )}

        </div>
      )}

    </div>
  );
}

// Sub components
function Info({ className, ...props }: any) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
