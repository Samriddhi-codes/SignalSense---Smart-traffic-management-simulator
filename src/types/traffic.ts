export enum Axis {
  NORTH_SOUTH = 'NORTH_SOUTH',
  EAST_WEST = 'EAST_WEST',
}

export enum Direction {
  NORTH = 'NORTH', // Vehicles entering from North moving Southbound
  SOUTH = 'SOUTH', // Vehicles entering from South moving Northbound
  EAST = 'EAST',   // Vehicles entering from East moving Westbound
  WEST = 'WEST',   // Vehicles entering from West moving Eastbound
}

export enum SignalLight {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED',
}

export enum TrafficLevel {
  LOW = 'LOW',
  HIGH = 'HIGH',
}

export enum ReflexRuleId {
  NS_HIGH = 'RULE_1_NS_HIGH',
  EW_HIGH = 'RULE_2_EW_HIGH',
  BOTH_LOW = 'RULE_3_BOTH_LOW',
  EQUAL_HIGH_TIE_BREAK = 'RULE_4_TIE_BREAK',
}

export enum TieBreakPolicy {
  HIGHER_COUNT_ELSE_NS = 'HIGHER_COUNT_ELSE_NS',
  HIGHER_COUNT_ELSE_EW = 'HIGHER_COUNT_ELSE_EW',
  ALWAYS_NS = 'ALWAYS_NS',
  ALWAYS_EW = 'ALWAYS_EW',
}

export type VehicleType = 'sedan' | 'compact' | 'van';

export interface Vehicle {
  id: number;
  direction: Direction;
  axis: Axis;
  /** Distance from road entry (0) along travel path toward exit (ROAD_LENGTH = 800) */
  position: number;
  speed: number;
  maxSpeed: number;
  length: number;
  width: number;
  color: string;
  vehicleType: VehicleType;
  waitTime: number;
  inSensorZone: boolean;
  passedStopLine: boolean;
  braking: boolean;
}

export interface VehicleBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
}

export interface CollisionEvent {
  pairKey: string;
  vehicleAId: number;
  vehicleBId: number;
  directionA: Direction;
  directionB: Direction;
  overlapX: number;
  overlapY: number;
  overlapWidth: number;
  overlapHeight: number;
}

export interface SensorReading {
  northCount: number;
  southCount: number;
  eastCount: number;
  westCount: number;
  nsTotal: number;
  ewTotal: number;
  nsLevel: TrafficLevel;
  ewLevel: TrafficLevel;
  nsDensityPct: number;
  ewDensityPct: number;
}

export interface AgentConfig {
  highThreshold: number;
  defaultPriority: Axis;
  tieBreakPolicy: TieBreakPolicy;
  minGreenHoldSec: number;
  amberDurationSec: number;
  simSpeedMultiplier: number;
}

export interface ArrivalRates {
  [Direction.NORTH]: number; // vehicles per minute
  [Direction.SOUTH]: number;
  [Direction.EAST]: number;
  [Direction.WEST]: number;
}

export interface AgentDecision {
  targetAxis: Axis;
  ruleId: ReflexRuleId;
  ruleTitle: string;
  conditionSummary: string;
  actionSummary: string;
  explanation: string;
}

export interface SignalControllerState {
  activeAxis: Axis;
  nsLight: SignalLight;
  ewLight: SignalLight;
  inTransition: boolean;
  transitionTargetAxis: Axis | null;
  phaseElapsedSec: number;
  amberRemainingSec: number;
}

export interface DecisionLogEntry {
  id: number;
  simTimeSec: number;
  nsCount: number;
  ewCount: number;
  nsLevel: TrafficLevel;
  ewLevel: TrafficLevel;
  ruleId: ReflexRuleId;
  ruleLabel: string;
  decidedAxis: Axis;
  actionTaken: string;
  wasHeldByMinGreen: boolean;
}

export interface TimeSeriesPoint {
  simTimeSec: number;
  nsCount: number;
  ewCount: number;
  activeAxis: Axis;
}

export interface SimulationMetrics {
  simTimeSec: number;
  vehiclesCleared: number;
  totalWaitSec: number;
  avgWaitSec: number;
  throughputPerMin: number;
  activeVehicles: number;
  nsQueued: number;
  ewQueued: number;
  totalCollisions: number;
  ruleHits: Record<ReflexRuleId, number>;
}

export interface SimulationState {
  vehicles: Vehicle[];
  nextVehicleId: number;
  nextLogId: number;
  sensors: SensorReading;
  agentDecision: AgentDecision;
  controller: SignalControllerState;
  collisions: CollisionEvent[];
  metrics: SimulationMetrics;
  decisionLog: DecisionLogEntry[];
  history: TimeSeriesPoint[];
  lastHistorySampleSec: number;
  spawnAccumulators: Record<Direction, number>;
}

export interface TrafficScenario {
  id: string;
  name: string;
  summary: string;
  rates: ArrivalRates;
  seedVehicles?: Partial<Record<Direction, number>>;
}
