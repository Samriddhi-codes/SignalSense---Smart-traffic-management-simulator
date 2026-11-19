import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { AnalyticsSection } from './components/AnalyticsSection';
import { IntersectionCanvas } from './components/IntersectionCanvas';
import { ReflexRulePanel } from './components/ReflexRulePanel';
import { axisLabel, evaluateReflexAgent } from './engine/reflexAgent';
import {
  DEFAULT_AGENT_CONFIG,
  TRAFFIC_SCENARIOS,
  computeSensors,
  createInitialSimulationState,
  spawnVehicleInDirection,
  stepSimulation,
} from './engine/simulation';
import {
  AgentConfig,
  ArrivalRates,
  Direction,
  SignalLight,
  SimulationState,
} from './types/traffic';

export default function App() {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    TRAFFIC_SCENARIOS[0].id
  );
  const [arrivalRates, setArrivalRates] = useState<ArrivalRates>(
    TRAFFIC_SCENARIOS[0].rates
  );
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simState, setSimState] = useState<SimulationState>(() =>
    createInitialSimulationState(DEFAULT_AGENT_CONFIG, TRAFFIC_SCENARIOS[0])
  );

  const configRef = useRef(config);
  configRef.current = config;
  const ratesRef = useRef(arrivalRates);
  ratesRef.current = arrivalRates;

  useEffect(() => {
    if (!isRunning) return;

    let rafId = 0;
    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTimestamp) / 1000, 0.06);
      lastTimestamp = now;

      setSimState((prev) =>
        stepSimulation(prev, dt, configRef.current, ratesRef.current)
      );

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning]);

  const handleUpdateConfig = useCallback((patch: Partial<AgentConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      // Immediately re-evaluate stateless percepts & rule match (even when paused)
      setSimState((s) => {
        const sensors = computeSensors(s.vehicles, next.highThreshold);
        const agentDecision = evaluateReflexAgent(sensors, next);
        return {
          ...s,
          sensors,
          agentDecision,
        };
      });
      return next;
    });
  }, []);

  const handleUpdateRate = useCallback((dir: Direction, rate: number) => {
    setActiveScenarioId('custom');
    setArrivalRates((prev) => ({
      ...prev,
      [dir]: rate,
    }));
  }, []);

  const handleSelectScenario = useCallback((scenarioId: string) => {
    const scenario = TRAFFIC_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setActiveScenarioId(scenario.id);
    setArrivalRates(scenario.rates);
    setSimState(createInitialSimulationState(configRef.current, scenario));
  }, []);

  const handleReset = useCallback(() => {
    const scenario =
      TRAFFIC_SCENARIOS.find((s) => s.id === activeScenarioId) ??
      TRAFFIC_SCENARIOS[0];
    setSimState(createInitialSimulationState(configRef.current, scenario));
  }, [activeScenarioId]);

  const handleStep = useCallback(() => {
    setIsRunning(false);
    setSimState((prev) =>
      stepSimulation(prev, 0.25, configRef.current, ratesRef.current)
    );
  }, []);

  const handleSpawnDirection = useCallback((dir: Direction) => {
    setSimState((prev) =>
      spawnVehicleInDirection(prev, dir, configRef.current)
    );
  }, []);

  const formatLightLabel = (light: SignalLight) => {
    switch (light) {
      case SignalLight.GREEN:
        return 'GREEN · GO';
      case SignalLight.AMBER:
        return 'AMBER · CLEAR';
      case SignalLight.RED:
        return 'RED · STOP';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#intersection"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SignalSense
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#intersection"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Intersection
            </a>
            <a
              href="#reflex-rules"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Reflex Rules
            </a>
            <a
              href="#decision-trace"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Decision Trace
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Simulation
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        {/* Simulation Header & Playback Toolbar */}
        <div
          id="intersection"
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200"
        >
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 text-balance">
              Smart Traffic Management Simulator
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Four-way road intersection controlled by a stateless Simple Reflex Agent evaluating live virtual sensor density via IF–THEN rules.
            </p>
          </div>

          {/* Playback & Speed Control Toolbar */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsRunning((r) => !r)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isRunning
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  Pause Simulation
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Start Simulation
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleStep}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <StepForward className="w-3.5 h-3.5" />
              Step +0.25s
            </button>

            <div
              role="group"
              aria-label="Simulation speed"
              className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 border border-slate-200"
            >
              {[0.5, 1, 2].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() =>
                    handleUpdateConfig({ simSpeedMultiplier: speed })
                  }
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.simSpeedMultiplier === speed
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Two-Zone Sandbox Layout */}
        <div className="mt-7 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Left Zone: Interactive 4-Way Intersection Stage */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    Four-Way Intersection Viewport
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Virtual inductive loops at stop lines</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-600 tabular-nums">
                  <span>t = {simState.metrics.simTimeSec.toFixed(1)}s</span>
                  <span aria-hidden="true">·</span>
                  <span>{simState.metrics.activeVehicles} on road</span>
                </div>
              </div>

              <IntersectionCanvas
                simState={simState}
                highThreshold={config.highThreshold}
                onSpawnDirection={handleSpawnDirection}
              />

              {/* Clean 4-Column Signal & Agent KPI Strip */}
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">North–South Signal</div>
                  <div
                    className={`mt-1 font-mono text-xs font-semibold tabular-nums ${
                      simState.controller.nsLight === SignalLight.GREEN
                        ? 'text-emerald-700'
                        : simState.controller.nsLight === SignalLight.AMBER
                          ? 'text-amber-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {formatLightLabel(simState.controller.nsLight)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">East–West Signal</div>
                  <div
                    className={`mt-1 font-mono text-xs font-semibold tabular-nums ${
                      simState.controller.ewLight === SignalLight.GREEN
                        ? 'text-emerald-700'
                        : simState.controller.ewLight === SignalLight.AMBER
                          ? 'text-amber-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {formatLightLabel(simState.controller.ewLight)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Agent Decision</div>
                  <div className="mt-1 font-mono text-xs font-semibold text-sky-700 truncate">
                    {axisLabel(simState.agentDecision.targetAxis)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Vehicles Cleared</div>
                  <div className="mt-1 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {simState.metrics.vehiclesCleared} total ·{' '}
                    {simState.metrics.avgWaitSec.toFixed(1)}s avg wait
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Zone: Reflex Agent Control & Concept Deck */}
          <div className="lg:col-span-5">
            <ReflexRulePanel
              simState={simState}
              config={config}
              arrivalRates={arrivalRates}
              activeScenarioId={activeScenarioId}
              onUpdateConfig={handleUpdateConfig}
              onUpdateRate={handleUpdateRate}
              onSelectScenario={handleSelectScenario}
              onSpawnDirection={handleSpawnDirection}
            />
          </div>
        </div>

        {/* Below-the-Fold Analytics, Trace & Architecture */}
        <AnalyticsSection
          simState={simState}
          highThreshold={config.highThreshold}
        />
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>SignalSense · Smart Traffic Management Simulator</span>
          <span>
            Stateless Simple Reflex Agent · Condition–Action Signal Control
          </span>
        </div>
      </footer>
    </div>
  );
}
