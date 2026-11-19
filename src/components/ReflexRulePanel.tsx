import React from 'react';
import { Plus } from 'lucide-react';
import {
  REFLEX_RULES,
  axisLabel,
  tieBreakLabel,
} from '../engine/reflexAgent';
import { TRAFFIC_SCENARIOS } from '../engine/simulation';
import {
  AgentConfig,
  ArrivalRates,
  Axis,
  Direction,
  SignalLight,
  SimulationState,
  TieBreakPolicy,
  TrafficLevel,
} from '../types/traffic';

interface ReflexRulePanelProps {
  simState: SimulationState;
  config: AgentConfig;
  arrivalRates: ArrivalRates;
  activeScenarioId: string;
  onUpdateConfig: (patch: Partial<AgentConfig>) => void;
  onUpdateRate: (dir: Direction, rate: number) => void;
  onSelectScenario: (scenarioId: string) => void;
  onSpawnDirection: (dir: Direction) => void;
}

function SignalBadgeText({ light }: { light: SignalLight }) {
  if (light === SignalLight.GREEN) {
    return (
      <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
        ● GREEN · GO
      </span>
    );
  }
  if (light === SignalLight.AMBER) {
    return (
      <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
        ▲ AMBER · CLEAR
      </span>
    );
  }
  return (
    <span className="font-mono text-xs font-semibold text-rose-700 tabular-nums">
      ■ RED · STOP
    </span>
  );
}

export const ReflexRulePanel: React.FC<ReflexRulePanelProps> = ({
  simState,
  config,
  arrivalRates,
  activeScenarioId,
  onUpdateConfig,
  onUpdateRate,
  onSelectScenario,
  onSpawnDirection,
}) => {
  const { sensors, agentDecision, controller } = simState;

  return (
    <div className="flex flex-col gap-6">
      {/* Section 1: Current Sensor Percepts & Instantaneous Reflex Output */}
      <section
        id="sensor-logic"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            01. Current Sensor Percepts
          </h2>
          <span className="text-xs text-slate-500">
            Stateless · Threshold ≥ {config.highThreshold} veh
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* North-South Sensor Box */}
          <div
            className={`rounded-lg border p-3.5 transition-colors ${
              controller.activeAxis === Axis.NORTH_SOUTH
                ? 'border-sky-300 bg-sky-50/50'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                North–South Axis
              </span>
              <SignalBadgeText light={controller.nsLight} />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {sensors.nsTotal}
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  veh
                </span>
              </span>
              <span
                className={`font-mono text-xs font-semibold tabular-nums ${
                  sensors.nsLevel === TrafficLevel.HIGH
                    ? 'text-amber-700'
                    : 'text-slate-600'
                }`}
              >
                {sensors.nsLevel === TrafficLevel.HIGH ? '▲ HIGH' : '○ LOW'}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-150 ${
                  sensors.nsLevel === TrafficLevel.HIGH
                    ? 'bg-amber-500'
                    : 'bg-sky-600'
                }`}
                style={{ width: `${Math.max(4, sensors.nsDensityPct)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
              <span>N: {sensors.northCount}</span>
              <span>S: {sensors.southCount}</span>
            </div>
          </div>

          {/* East-West Sensor Box */}
          <div
            className={`rounded-lg border p-3.5 transition-colors ${
              controller.activeAxis === Axis.EAST_WEST
                ? 'border-sky-300 bg-sky-50/50'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                East–West Axis
              </span>
              <SignalBadgeText light={controller.ewLight} />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {sensors.ewTotal}
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  veh
                </span>
              </span>
              <span
                className={`font-mono text-xs font-semibold tabular-nums ${
                  sensors.ewLevel === TrafficLevel.HIGH
                    ? 'text-amber-700'
                    : 'text-slate-600'
                }`}
              >
                {sensors.ewLevel === TrafficLevel.HIGH ? '▲ HIGH' : '○ LOW'}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-150 ${
                  sensors.ewLevel === TrafficLevel.HIGH
                    ? 'bg-amber-500'
                    : 'bg-sky-600'
                }`}
                style={{ width: `${Math.max(4, sensors.ewDensityPct)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
              <span>E: {sensors.eastCount}</span>
              <span>W: {sensors.westCount}</span>
            </div>
          </div>
        </div>

        {/* Instantaneous Agent Evaluation Readout */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-900">
              {agentDecision.ruleTitle}
            </span>
            <span className="font-mono text-sky-700 font-medium tabular-nums">
              {agentDecision.conditionSummary}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            {agentDecision.explanation}
          </p>
          {controller.inTransition ? (
            <p className="mt-1.5 text-xs font-medium text-amber-700 font-mono tabular-nums">
              Actuator clearing intersection · Amber {controller.amberRemainingSec.toFixed(1)}s remaining
            </p>
          ) : agentDecision.targetAxis !== controller.activeAxis ? (
            <p className="mt-1.5 text-xs font-medium text-slate-600 font-mono tabular-nums">
              Holding current green for minimum phase ({controller.phaseElapsedSec.toFixed(1)}s / {config.minGreenHoldSec.toFixed(1)}s)
            </p>
          ) : null}
        </div>
      </section>

      {/* Section 2: Simple Reflex Agent Rule Table */}
      <section
        id="reflex-rules"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            02. Simple Reflex IF–THEN Rules
          </h2>
          <span className="text-xs text-slate-500">Memoryless condition–action</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2 pr-3">Current Sensor Input</th>
                <th className="py-2 pl-3">Agent Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {REFLEX_RULES.map((rule) => {
                const isActive = agentDecision.ruleId === rule.id;
                return (
                  <tr
                    key={rule.id}
                    className={`transition-colors ${
                      isActive ? 'bg-sky-50 text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    <td className="py-2.5 pr-3 align-top">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            isActive ? 'text-sky-700' : 'text-slate-400'
                          }`}
                        >
                          {isActive ? '▶' : '·'}
                        </span>
                        <div>
                          <div
                            className={`font-medium ${
                              isActive ? 'text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {rule.sensorCondition}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {rule.formalPredicate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 align-top">
                      <div
                        className={`font-medium ${
                          isActive ? 'text-sky-800' : 'text-slate-700'
                        }`}
                      >
                        {rule.agentDecision}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                        Fired {simState.metrics.ruleHits[rule.id] ?? 0}×
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Agent Configuration Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="threshold-slider" className="font-medium text-slate-700">
                High-Density Threshold
              </label>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {config.highThreshold} veh
              </span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min={2}
              max={8}
              step={1}
              value={config.highThreshold}
              onChange={(e) =>
                onUpdateConfig({ highThreshold: Number(e.target.value) })
              }
              className="lab-slider w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="mingreen-slider" className="font-medium text-slate-700">
                Minimum Green Hold
              </label>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {config.minGreenHoldSec.toFixed(1)} s
              </span>
            </div>
            <input
              id="mingreen-slider"
              type="range"
              min={0.5}
              max={6.0}
              step={0.5}
              value={config.minGreenHoldSec}
              onChange={(e) =>
                onUpdateConfig({ minGreenHoldSec: Number(e.target.value) })
              }
              className="lab-slider w-full"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="amber-slider" className="font-medium text-slate-700">
                Amber Clearance Phase (0s = Unsafe Instant Switch)
              </label>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {config.amberDurationSec.toFixed(1)} s
              </span>
            </div>
            <input
              id="amber-slider"
              type="range"
              min={0.0}
              max={3.0}
              step={0.2}
              value={config.amberDurationSec}
              onChange={(e) =>
                onUpdateConfig({ amberDurationSec: Number(e.target.value) })
              }
              className="lab-slider w-full"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Default Priority (Both Low)
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => onUpdateConfig({ defaultPriority: Axis.NORTH_SOUTH })}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  config.defaultPriority === Axis.NORTH_SOUTH
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                North–South
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ defaultPriority: Axis.EAST_WEST })}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  config.defaultPriority === Axis.EAST_WEST
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                East–West
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="tiebreak-select"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Tie-Breaking Rule (Both High)
            </label>
            <select
              id="tiebreak-select"
              value={config.tieBreakPolicy}
              onChange={(e) =>
                onUpdateConfig({ tieBreakPolicy: e.target.value as TieBreakPolicy })
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {Object.values(TieBreakPolicy).map((policy) => (
                <option key={policy} value={policy}>
                  {tieBreakLabel(policy)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 3: Traffic Scenario Presets & Per-Approach Arrival Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            03. Traffic Flow & Arrival Controls
          </h2>
          <span className="text-xs text-slate-500">Spawn & arrival rates</span>
        </div>

        {/* Scenario Selector */}
        <div className="mt-3">
          <label
            htmlFor="scenario-select"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Preset Traffic Scenario
          </label>
          <select
            id="scenario-select"
            value={activeScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {TRAFFIC_SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name} — {sc.summary}
              </option>
            ))}
            {activeScenarioId === 'custom' && (
              <option value="custom">Custom Arrival Rates</option>
            )}
          </select>
        </div>

        {/* Approach Sliders + Direct Spawn Buttons */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[
            { dir: Direction.NORTH, label: 'North Approach' },
            { dir: Direction.SOUTH, label: 'South Approach' },
            { dir: Direction.EAST, label: 'East Approach' },
            { dir: Direction.WEST, label: 'West Approach' },
          ].map(({ dir, label }) => (
            <div
              key={dir}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <label
                  htmlFor={`rate-${dir}`}
                  className="text-xs font-medium text-slate-800"
                >
                  {label}
                </label>
                <button
                  type="button"
                  onClick={() => onSpawnDirection(dir)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add Vehicle
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id={`rate-${dir}`}
                  type="range"
                  min={0}
                  max={45}
                  step={1}
                  value={arrivalRates[dir]}
                  onChange={(e) => onUpdateRate(dir, Number(e.target.value))}
                  className="lab-slider flex-1"
                />
                <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums w-16 text-right">
                  {arrivalRates[dir]} /min
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary footer note inside deck */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Active Priority:{' '}
            <strong className="font-medium text-slate-700">
              {axisLabel(controller.activeAxis)}
            </strong>
          </span>
          <span className="font-mono tabular-nums">
            Queue: NS {simState.metrics.nsQueued} · EW {simState.metrics.ewQueued}
          </span>
        </div>
      </section>
    </div>
  );
};
