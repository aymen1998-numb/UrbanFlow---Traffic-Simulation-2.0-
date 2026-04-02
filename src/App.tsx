import React, { useState, useEffect } from 'react';
import { Activity, Plus, Copy, Trash2, Zap, Trophy } from 'lucide-react';
import { Scenario, simulateNetwork, optimizeScenario } from './simulation/macro';
import { defaultNetwork } from './simulation/defaultNetwork';
import { NetworkCanvas } from './components/NetworkCanvas';

export default function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(2);

  useEffect(() => {
    // Initialize default scenario
    const initial: Scenario = {
      id: crypto.randomUUID(),
      name: 'Baseline Scenario',
      network: JSON.parse(JSON.stringify(defaultNetwork))
    };
    initial.metrics = simulateNetwork(initial.network, 2 * 3600);
    setScenarios([initial]);
    setActiveId(initial.id);
  }, []);

  const activeScenario = scenarios.find(s => s.id === activeId);

  const handleAddScenario = () => {
    const newScen: Scenario = {
      id: crypto.randomUUID(),
      name: `Scenario ${scenarios.length + 1}`,
      network: JSON.parse(JSON.stringify(defaultNetwork))
    };
    newScen.metrics = simulateNetwork(newScen.network, durationHours * 3600);
    setScenarios([...scenarios, newScen]);
    setActiveId(newScen.id);
  };

  const handleDuplicate = (scen: Scenario) => {
    const newScen: Scenario = JSON.parse(JSON.stringify(scen));
    newScen.id = crypto.randomUUID();
    newScen.name = `${scen.name} (Copy)`;
    setScenarios([...scenarios, newScen]);
    setActiveId(newScen.id);
  };

  const handleDelete = (id: string) => {
    if (scenarios.length <= 1) return;
    const newScens = scenarios.filter(s => s.id !== id);
    setScenarios(newScens);
    if (activeId === id) setActiveId(newScens[0].id);
  };

  const handleOptimize = () => {
    if (!activeScenario) return;
    setIsOptimizing(true);
    
    // Simulate async work
    setTimeout(() => {
      let optimized = optimizeScenario(activeScenario, durationHours * 3600);
      
      // If the original scenario was the best, create a copy to avoid duplicate IDs
      if (optimized.id === activeScenario.id) {
        optimized = JSON.parse(JSON.stringify(optimized));
        optimized.id = crypto.randomUUID();
        optimized.name = `${activeScenario.name} (Optimized - No changes)`;
      }
      
      setScenarios(prev => [...prev, optimized]);
      setActiveId(optimized.id);
      setIsOptimizing(false);
    }, 500);
  };

  // Rank scenarios
  const rankedScenarios = [...scenarios].sort((a, b) => (b.metrics?.score || 0) - (a.metrics?.score || 0));
  const bestScenarioId = rankedScenarios[0]?.id;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">UrbanFlow Macro</h1>
            <p className="text-xs text-slate-500 font-medium">Fast Traffic Optimization Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-600">Duration:</span>
            <select 
              value={durationHours} 
              onChange={(e) => {
                const newDuration = Number(e.target.value);
                setDurationHours(newDuration);
                setScenarios(prev => prev.map(s => ({
                  ...s,
                  metrics: simulateNetwork(s.network, newDuration * 3600)
                })));
              }}
              className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={4}>4 Hours</option>
              <option value={8}>8 Hours</option>
              <option value={24}>24 Hours</option>
            </select>
          </div>
          <button 
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {isOptimizing ? 'Optimizing...' : 'Auto-Optimize'}
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)] min-h-[800px]">
          
          {/* Left Column: Scenarios List */}
          <div className="lg:col-span-3 h-full flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Scenarios</h2>
                <button onClick={handleAddScenario} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                {rankedScenarios.map((s, idx) => (
                  <div 
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${activeId === s.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {s.id === bestScenarioId && <Trophy className="w-4 h-4 text-amber-500" />}
                        <span className="font-medium text-sm text-slate-800">{s.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleDuplicate(s); }} className="p-1 text-slate-400 hover:text-blue-600"><Copy className="w-3 h-3" /></button>
                        {scenarios.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Score:</span>
                      <span className={`font-bold ${s.id === bestScenarioId ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {s.metrics?.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-500">Rank:</span>
                      <span className="font-medium text-slate-600">#{idx + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column: Network Canvas */}
          <div className="lg:col-span-6 h-full flex flex-col">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Network Layout</h2>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Macroscopic Model</span>
              </div>
              <div className="flex-1 min-h-0 relative">
                {activeScenario && (
                  <NetworkCanvas 
                    network={activeScenario.network} 
                    metrics={activeScenario.metrics}
                    onNetworkChange={(newNetwork) => {
                      const updatedScenarios = scenarios.map(s => {
                        if (s.id === activeId) {
                          const updated = { ...s, network: newNetwork };
                          updated.metrics = simulateNetwork(newNetwork, durationHours * 3600);
                          return updated;
                        }
                        return s;
                      });
                      setScenarios(updatedScenarios);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Metrics & Feedback */}
          <div className="lg:col-span-3 h-full flex flex-col gap-4">
            {activeScenario && activeScenario.metrics && (
              <>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h2 className="font-semibold text-slate-800 mb-4">Performance Metrics</h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Overall Score</span>
                        <span className="font-bold text-slate-900">{activeScenario.metrics.score.toFixed(1)} / 100</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, activeScenario.metrics.score)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Avg Speed</p>
                        <p className="text-lg font-bold text-slate-800">{activeScenario.metrics.avgSpeed.toFixed(1)} <span className="text-xs font-normal">km/h</span></p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Throughput</p>
                        <p className="text-lg font-bold text-slate-800">{activeScenario.metrics.throughput.toFixed(0)} <span className="text-xs font-normal">veh/h</span></p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Congestion</p>
                        <p className="text-lg font-bold text-slate-800">{(activeScenario.metrics.congestion * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Avg Wait</p>
                        <p className="text-lg font-bold text-slate-800">{activeScenario.metrics.avgWaitTime.toFixed(1)} <span className="text-xs font-normal">s</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                {activeScenario.id === bestScenarioId && scenarios.length > 1 && (
                  <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-semibold text-emerald-800">Optimal Scenario</h3>
                    </div>
                    <p className="text-sm text-emerald-700 leading-relaxed">
                      This configuration provides the best balance of high throughput and low congestion. 
                      {activeScenario.metrics.avgSpeed > 40 ? ' Traffic flows freely.' : ' Congestion is managed effectively.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
