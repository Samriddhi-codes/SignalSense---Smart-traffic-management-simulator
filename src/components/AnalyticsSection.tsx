import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { axisLabel } from '../engine/reflexAgent';
import {
  Axis,
  ReflexRuleId,
  SimulationState,
  TrafficLevel,
} from '../types/traffic';

interface AnalyticsSectionProps {
  simState: SimulationState;
  highThreshold: number;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  simState,
  highThreshold,
}) => {
  const [ruleFilter, setRuleFilter] = useState<'ALL' | ReflexRuleId>('ALL');

  const filteredLogs = useMemo(() => {
    if (ruleFilter === 'ALL') return simState.decisionLog;
    return simState.decisionLog.filter((entry) => entry.ruleId === ruleFilter);
  }, [simState.decisionLog, ruleFilter]);

  const handleExportCsv = () => {
    const header = [
      'LogID',
      'SimTimeSec',
      'NS_Vehicles',
      'NS_Level',
      'EW_Vehicles',
      'EW_Level',
      'MatchedRule',
      'DecidedAxis',
      'ActionTaken',
    ].join(',');
    const rows = simState.decisionLog.map((e) =>
      [
        e.id,
        e.simTimeSec.toFixed(2),
        e.nsCount,
        e.nsLevel,
        e.ewCount,
        e.ewLevel,
        `"${e.ruleLabel}"`,
        axisLabel(e.decidedAxis),
        `"${e.actionTaken}"`,
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `signalsense-trace-${Math.round(simState.metrics.simTimeSec)}s.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Build SVG polyline points for the 60-second sensor queue history
  const chartGeom = useMemo(() => {
    const width = 640;
    const height = 190;
    const padL = 36;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const pts = simState.history;
    const maxCount = Math.max(
      highThreshold + 2,
      8,
      ...pts.map((p) => Math.max(p.nsCount, p.ewCount))
    );

    const toX = (idx: number) => {
      if (pts.length <= 1) return padL;
      return padL + (idx / (pts.length - 1)) * innerW;
    };
    const toY = (val: number) =>
      padT + innerH - Math.min(1, val / maxCount) * innerH;

    const nsLine = pts.map((p, i) => `${toX(i)},${toY(p.nsCount)}`).join(' ');
    const ewLine = pts.map((p, i) => `${toX(i)},${toY(p.ewCount)}`).join(' ');
    const thresholdY = toY(highThreshold);

    return {
      width,
      height,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      maxCount,
      nsLine,
      ewLine,
      thresholdY,
      pts,
    };
  }, [simState.history, highThreshold]);

  return (
    <div className="mt-10 flex flex-col gap-10">
      {/* Row 1: Sensor Density Time-Series & Stateless Architecture */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Sensor Queue Density Over Time
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Rolling 60-second snapshot of detected vehicles per axis against the high-density threshold
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="inline-block w-3 h-0.5 bg-sky-600" />
                  North–South
                </span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="inline-block w-3 h-0.5 bg-amber-600" />
                  East–West
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="inline-block w-3 h-0 border-t border-dashed border-rose-500" />
                  Threshold ({highThreshold})
                </span>
              </div>
            </div>

            <div className="mt-4 w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartGeom.width} ${chartGeom.height}`}
                className="w-full h-48 block"
                role="img"
                aria-label="Sensor density over time chart"
              >
                {/* Horizontal grid lines */}
                {[0, 0.5, 1].map((frac) => {
                  const val = Math.round(chartGeom.maxCount * frac);
                  const y =
                    chartGeom.padT +
                    chartGeom.innerH -
                    frac * chartGeom.innerH;
                  return (
                    <g key={frac}>
                      <line
                        x1={chartGeom.padL}
                        y1={y}
                        x2={chartGeom.width - chartGeom.padR}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeWidth={1}
                      />
                      <text
                        x={chartGeom.padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* High Threshold Dashed Line */}
                <line
                  x1={chartGeom.padL}
                  y1={chartGeom.thresholdY}
                  x2={chartGeom.width - chartGeom.padR}
                  y2={chartGeom.thresholdY}
                  stroke="#E11D48"
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                />

                {/* NS & EW Series */}
                {chartGeom.pts.length > 1 ? (
                  <>
                    <polyline
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={chartGeom.nsLine}
                    />
                    <polyline
                      fill="none"
                      stroke="#D97706"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={chartGeom.ewLine}
                    />
                  </>
                ) : (
                  <text
                    x={chartGeom.width / 2}
                    y={chartGeom.height / 2}
                    textAnchor="middle"
                    className="fill-slate-400 text-xs"
                  >
                    Run simulation to plot live sensor density samples
                  </text>
                )}

                {/* X-axis label */}
                <text
                  x={chartGeom.padL}
                  y={chartGeom.height - 6}
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {chartGeom.pts.length > 0
                    ? `${chartGeom.pts[0].simTimeSec.toFixed(0)}s`
                    : '0s'}
                </text>
                <text
                  x={chartGeom.width - chartGeom.padR}
                  y={chartGeom.height - 6}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {chartGeom.pts.length > 0
                    ? `${chartGeom.pts[chartGeom.pts.length - 1].simTimeSec.toFixed(0)}s`
                    : '0s'}
                </text>
              </svg>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Vehicles Cleared</span>
              <div className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {simState.metrics.vehiclesCleared}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Avg Wait Time</span>
              <div className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {simState.metrics.avgWaitSec.toFixed(1)} s
              </div>
            </div>
            <div>
              <span className="text-slate-500">Throughput Rate</span>
              <div className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {simState.metrics.throughputPerMin.toFixed(1)} veh/min
              </div>
            </div>
          </div>
        </div>

        {/* How the Simple Reflex Agent Works */}
        <div
          id="how-it-works"
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              How the Simple Reflex Agent Works
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              A Simple Reflex Agent selects actions purely from the current percept. It holds no internal state, builds no traffic forecast, and does not learn from previous signal cycles.
            </p>

            <ol className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-sky-700 pt-0.5 shrink-0">
                  01.
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Virtual Road Sensors (Percept)
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    Inductive loops upstream of each stop line count active vehicles on North–South and East–West approaches and classify each axis as LOW or HIGH against your threshold.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-sky-700 pt-0.5 shrink-0">
                  02.
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Condition–Action Matcher (IF–THEN)
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    Evaluates the 4 deterministic rules against the current sensor snapshot—giving green to whichever axis is congested, using default priority when both are low, or applying tie-breaking when both are high.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-sky-700 pt-0.5 shrink-0">
                  03.
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Signal Actuator (Action)
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    Executes the agent’s target green phase after a safe amber clearance interval and minimum green hold so vehicles already inside the box clear safely.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono">
            action = RuleMatch(percept[nsLevel, ewLevel, nsCount, ewCount])
          </div>
        </div>
      </section>

      {/* Row 2: Live Agent Decision Trace Table */}
      <section
        id="decision-trace"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Agent Decision Trace
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Log of rule transitions and signal switches triggered by live sensor percepts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Segmented rule filter */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 overflow-x-auto">
              {[
                { id: 'ALL' as const, label: 'All Rules' },
                { id: ReflexRuleId.NS_HIGH, label: 'Rule 1 (NS)' },
                { id: ReflexRuleId.EW_HIGH, label: 'Rule 2 (EW)' },
                { id: ReflexRuleId.BOTH_LOW, label: 'Rule 3 (Low)' },
                { id: ReflexRuleId.EQUAL_HIGH_TIE_BREAK, label: 'Rule 4 (Tie)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRuleFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    ruleFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No decision events match the selected rule filter yet. Adjust arrival rates or switch back to All Rules.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">Sim Time</th>
                  <th className="py-2.5 px-4">NS Sensor</th>
                  <th className="py-2.5 px-4">EW Sensor</th>
                  <th className="py-2.5 px-4">Matched Rule</th>
                  <th className="py-2.5 px-4">Target Green</th>
                  <th className="py-2.5 pl-4">Actuator Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.slice(0, 14).map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {entry.simTimeSec.toFixed(1)}s
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                      <span className="text-slate-900 font-semibold">
                        {entry.nsCount}
                      </span>{' '}
                      <span
                        className={
                          entry.nsLevel === TrafficLevel.HIGH
                            ? 'text-amber-700'
                            : 'text-slate-400'
                        }
                      >
                        ({entry.nsLevel})
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                      <span className="text-slate-900 font-semibold">
                        {entry.ewCount}
                      </span>{' '}
                      <span
                        className={
                          entry.ewLevel === TrafficLevel.HIGH
                            ? 'text-amber-700'
                            : 'text-slate-400'
                        }
                      >
                        ({entry.ewLevel})
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {entry.ruleLabel}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium whitespace-nowrap">
                      <span
                        className={
                          entry.decidedAxis === Axis.NORTH_SOUTH
                            ? 'text-sky-700'
                            : 'text-amber-700'
                        }
                      >
                        {axisLabel(entry.decidedAxis)}
                      </span>
                    </td>
                    <td className="py-2.5 pl-4 text-slate-600 whitespace-nowrap">
                      {entry.actionTaken}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
