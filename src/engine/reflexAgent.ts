import {
  AgentConfig,
  AgentDecision,
  Axis,
  ReflexRuleId,
  SensorReading,
  TieBreakPolicy,
  TrafficLevel,
} from '../types/traffic';

export interface ReflexRuleDefinition {
  id: ReflexRuleId;
  index: string;
  sensorCondition: string;
  agentDecision: string;
  formalPredicate: string;
}

export const REFLEX_RULES: ReflexRuleDefinition[] = [
  {
    id: ReflexRuleId.NS_HIGH,
    index: 'Rule 1',
    sensorCondition: 'North–South traffic is high',
    agentDecision: 'Green for North–South',
    formalPredicate: 'IF (NS = HIGH) AND (EW = LOW)',
  },
  {
    id: ReflexRuleId.EW_HIGH,
    index: 'Rule 2',
    sensorCondition: 'East–West traffic is high',
    agentDecision: 'Green for East–West',
    formalPredicate: 'IF (EW = HIGH) AND (NS = LOW)',
  },
  {
    id: ReflexRuleId.BOTH_LOW,
    index: 'Rule 3',
    sensorCondition: 'Both directions have low traffic',
    agentDecision: 'Follow default priority',
    formalPredicate: 'IF (NS = LOW) AND (EW = LOW)',
  },
  {
    id: ReflexRuleId.EQUAL_HIGH_TIE_BREAK,
    index: 'Rule 4',
    sensorCondition: 'Both directions have equal high traffic',
    agentDecision: 'Apply predefined tie-breaking rule',
    formalPredicate: 'IF (NS = HIGH) AND (EW = HIGH)',
  },
];

export function axisLabel(axis: Axis): string {
  return axis === Axis.NORTH_SOUTH ? 'North–South' : 'East–West';
}

export function tieBreakLabel(policy: TieBreakPolicy): string {
  switch (policy) {
    case TieBreakPolicy.HIGHER_COUNT_ELSE_NS:
      return 'Higher count, else North–South';
    case TieBreakPolicy.HIGHER_COUNT_ELSE_EW:
      return 'Higher count, else East–West';
    case TieBreakPolicy.ALWAYS_NS:
      return 'Always favor North–South';
    case TieBreakPolicy.ALWAYS_EW:
      return 'Always favor East–West';
  }
}

/**
 * Pure stateless Simple Reflex Agent evaluation function.
 *
 * Notice the function signature: it accepts ONLY the current sensor percepts
 * and static rule configuration. It has zero access to previous states, history,
 * or learned weights.
 */
export function evaluateReflexAgent(
  sensors: SensorReading,
  config: AgentConfig
): AgentDecision {
  const { nsTotal, ewTotal, nsLevel, ewLevel } = sensors;
  const { defaultPriority, tieBreakPolicy } = config;

  // Rule 1: North-South traffic is high while East-West is low
  if (nsLevel === TrafficLevel.HIGH && ewLevel === TrafficLevel.LOW) {
    return {
      targetAxis: Axis.NORTH_SOUTH,
      ruleId: ReflexRuleId.NS_HIGH,
      ruleTitle: 'Rule 1 · North–South Traffic High',
      conditionSummary: `NS = ${nsTotal} (HIGH), EW = ${ewTotal} (LOW)`,
      actionSummary: 'Green for North–South',
      explanation: `North–South sensors detect ${nsTotal} vehicles (threshold ≥ ${config.highThreshold}) while East–West is low (${ewTotal}). Immediate green assigned to North–South.`,
    };
  }

  // Rule 2: East-West traffic is high while North-South is low
  if (ewLevel === TrafficLevel.HIGH && nsLevel === TrafficLevel.LOW) {
    return {
      targetAxis: Axis.EAST_WEST,
      ruleId: ReflexRuleId.EW_HIGH,
      ruleTitle: 'Rule 2 · East–West Traffic High',
      conditionSummary: `EW = ${ewTotal} (HIGH), NS = ${nsTotal} (LOW)`,
      actionSummary: 'Green for East–West',
      explanation: `East–West sensors detect ${ewTotal} vehicles (threshold ≥ ${config.highThreshold}) while North–South is low (${nsTotal}). Immediate green assigned to East–West.`,
    };
  }

  // Rule 3: Both directions have low traffic
  if (nsLevel === TrafficLevel.LOW && ewLevel === TrafficLevel.LOW) {
    const priorityName = axisLabel(defaultPriority);
    return {
      targetAxis: defaultPriority,
      ruleId: ReflexRuleId.BOTH_LOW,
      ruleTitle: 'Rule 3 · Both Directions Low',
      conditionSummary: `NS = ${nsTotal} (LOW), EW = ${ewTotal} (LOW)`,
      actionSummary: `Follow default priority (${priorityName})`,
      explanation: `Both axes are below the high-density threshold (< ${config.highThreshold}). Agent falls back to configured default priority: ${priorityName}.`,
    };
  }

  // Rule 4: Both directions have high traffic (including equal high traffic)
  let chosenAxis: Axis;
  let tieDetail: string;

  if (nsTotal === ewTotal) {
    switch (tieBreakPolicy) {
      case TieBreakPolicy.HIGHER_COUNT_ELSE_NS:
      case TieBreakPolicy.ALWAYS_NS:
        chosenAxis = Axis.NORTH_SOUTH;
        tieDetail = `Equal high load (${nsTotal} = ${ewTotal}); tie-breaker favors North–South`;
        break;
      case TieBreakPolicy.HIGHER_COUNT_ELSE_EW:
      case TieBreakPolicy.ALWAYS_EW:
        chosenAxis = Axis.EAST_WEST;
        tieDetail = `Equal high load (${nsTotal} = ${ewTotal}); tie-breaker favors East–West`;
        break;
    }
  } else {
    switch (tieBreakPolicy) {
      case TieBreakPolicy.HIGHER_COUNT_ELSE_NS:
      case TieBreakPolicy.HIGHER_COUNT_ELSE_EW:
        chosenAxis = nsTotal > ewTotal ? Axis.NORTH_SOUTH : Axis.EAST_WEST;
        tieDetail = `Both high (NS ${nsTotal} vs EW ${ewTotal}); tie-breaker picks higher count (${axisLabel(chosenAxis)})`;
        break;
      case TieBreakPolicy.ALWAYS_NS:
        chosenAxis = Axis.NORTH_SOUTH;
        tieDetail = `Both high (NS ${nsTotal}, EW ${ewTotal}); static tie-breaker favors North–South`;
        break;
      case TieBreakPolicy.ALWAYS_EW:
        chosenAxis = Axis.EAST_WEST;
        tieDetail = `Both high (NS ${nsTotal}, EW ${ewTotal}); static tie-breaker favors East–West`;
        break;
    }
  }

  return {
    targetAxis: chosenAxis,
    ruleId: ReflexRuleId.EQUAL_HIGH_TIE_BREAK,
    ruleTitle:
      nsTotal === ewTotal
        ? 'Rule 4 · Equal High Traffic (Tie-Break)'
        : 'Rule 4 · Both High Traffic (Tie-Break)',
    conditionSummary: `NS = ${nsTotal} (HIGH), EW = ${ewTotal} (HIGH)`,
    actionSummary: `Tie-break → Green for ${axisLabel(chosenAxis)}`,
    explanation: tieDetail,
  };
}
