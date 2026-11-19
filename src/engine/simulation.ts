import {
  AgentConfig,
  ArrivalRates,
  Axis,
  CollisionEvent,
  Direction,
  ReflexRuleId,
  SensorReading,
  SignalLight,
  SimulationState,
  TieBreakPolicy,
  TrafficLevel,
  TrafficScenario,
  Vehicle,
  VehicleBounds,
  VehicleType,
} from '../types/traffic';
import { axisLabel, evaluateReflexAgent } from './reflexAgent';

export const WORLD_SIZE = 800;
export const INTERSECTION_CENTER = 400;
export const ROAD_HALF_WIDTH = 76;
export const INTERSECTION_MIN_BOUND = INTERSECTION_CENTER - ROAD_HALF_WIDTH;
export const INTERSECTION_MAX_BOUND = INTERSECTION_CENTER + ROAD_HALF_WIDTH;
export const LANE_OFFSET = 38; // Center of each directional lane from road centerline
export const STOP_LINE_POS = 292;
export const INTERSECTION_EXIT_POS = 486;
export const SENSOR_START_POS = 36;
export const SENSOR_END_POS = 290;
export const MAX_SENSOR_CAPACITY_PER_AXIS = 12;

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  highThreshold: 3,
  defaultPriority: Axis.NORTH_SOUTH,
  tieBreakPolicy: TieBreakPolicy.HIGHER_COUNT_ELSE_NS,
  minGreenHoldSec: 3.0,
  amberDurationSec: 1.6,
  simSpeedMultiplier: 1.0,
};

export const TRAFFIC_SCENARIOS: TrafficScenario[] = [
  {
    id: 'balanced',
    name: 'Balanced Urban Flow',
    summary: 'Moderate arrivals across all four approaches with periodic waves.',
    rates: {
      [Direction.NORTH]: 16,
      [Direction.SOUTH]: 14,
      [Direction.EAST]: 15,
      [Direction.WEST]: 14,
    },
    seedVehicles: {
      [Direction.NORTH]: 2,
      [Direction.SOUTH]: 1,
      [Direction.EAST]: 2,
      [Direction.WEST]: 1,
    },
  },
  {
    id: 'ns_rush',
    name: 'North–South Rush Hour',
    summary: 'Heavy arterial demand on North–South while East–West stays light.',
    rates: {
      [Direction.NORTH]: 30,
      [Direction.SOUTH]: 28,
      [Direction.EAST]: 6,
      [Direction.WEST]: 5,
    },
    seedVehicles: {
      [Direction.NORTH]: 3,
      [Direction.SOUTH]: 2,
      [Direction.EAST]: 1,
      [Direction.WEST]: 0,
    },
  },
  {
    id: 'ew_commute',
    name: 'East–West Surge',
    summary: 'Cross-town peak demand on East–West; tests Rule 2 priority switching.',
    rates: {
      [Direction.NORTH]: 6,
      [Direction.SOUTH]: 7,
      [Direction.EAST]: 30,
      [Direction.WEST]: 29,
    },
    seedVehicles: {
      [Direction.NORTH]: 0,
      [Direction.SOUTH]: 1,
      [Direction.EAST]: 3,
      [Direction.WEST]: 2,
    },
  },
  {
    id: 'equal_gridlock',
    name: 'Equal High Congestion',
    summary: 'Simultaneous heavy load on both axes to trigger Rule 4 tie-breaking.',
    rates: {
      [Direction.NORTH]: 28,
      [Direction.SOUTH]: 28,
      [Direction.EAST]: 28,
      [Direction.WEST]: 28,
    },
    seedVehicles: {
      [Direction.NORTH]: 3,
      [Direction.SOUTH]: 2,
      [Direction.EAST]: 3,
      [Direction.WEST]: 2,
    },
  },
  {
    id: 'low_night',
    name: 'Low Late-Night Traffic',
    summary: 'Sparse arrivals below threshold; agent holds default priority (Rule 3).',
    rates: {
      [Direction.NORTH]: 4,
      [Direction.SOUTH]: 3,
      [Direction.EAST]: 4,
      [Direction.WEST]: 3,
    },
    seedVehicles: {
      [Direction.NORTH]: 1,
      [Direction.SOUTH]: 0,
      [Direction.EAST]: 1,
      [Direction.WEST]: 0,
    },
  },
];

const VEHICLE_PALETTE: { type: VehicleType; length: number; width: number; maxSpeed: number; colors: string[] }[] = [
  {
    type: 'compact',
    length: 30,
    width: 18,
    maxSpeed: 126,
    colors: ['#38BDF8', '#60A5FA', '#A78BFA', '#34D399', '#FBBF24'],
  },
  {
    type: 'sedan',
    length: 36,
    width: 19,
    maxSpeed: 120,
    colors: ['#F8FAFC', '#CBD5E1', '#94A3B8', '#0EA5E9', '#F97316', '#EF4444'],
  },
  {
    type: 'van',
    length: 44,
    width: 21,
    maxSpeed: 102,
    colors: ['#E2E8F0', '#FDE047', '#3B82F6', '#FB923C'],
  },
];

export function directionToAxis(direction: Direction): Axis {
  return direction === Direction.NORTH || direction === Direction.SOUTH
    ? Axis.NORTH_SOUTH
    : Axis.EAST_WEST;
}

function pickVehicleSpec(id: number): {
  vehicleType: VehicleType;
  length: number;
  width: number;
  maxSpeed: number;
  color: string;
} {
  const roll = (id * 37) % 10;
  const spec =
    roll < 3
      ? VEHICLE_PALETTE[0]
      : roll < 8
        ? VEHICLE_PALETTE[1]
        : VEHICLE_PALETTE[2];
  const color = spec.colors[(id * 13) % spec.colors.length];
  return {
    vehicleType: spec.type,
    length: spec.length,
    width: spec.width,
    maxSpeed: spec.maxSpeed + ((id % 5) - 2) * 3,
    color,
  };
}

export function createVehicle(
  id: number,
  direction: Direction,
  initialPos = -24
): Vehicle {
  const spec = pickVehicleSpec(id);
  const inSensorZone =
    initialPos >= SENSOR_START_POS && initialPos <= SENSOR_END_POS;
  return {
    id,
    direction,
    axis: directionToAxis(direction),
    position: initialPos,
    speed: 65,
    maxSpeed: spec.maxSpeed,
    length: spec.length,
    width: spec.width,
    color: spec.color,
    vehicleType: spec.vehicleType,
    waitTime: 0,
    inSensorZone,
    passedStopLine: initialPos > STOP_LINE_POS,
    braking: false,
  };
}

export function getVehicleWorldBounds(v: Vehicle): VehicleBounds {
  let cx: number;
  let cy: number;
  let halfW: number;
  let halfH: number;

  switch (v.direction) {
    case Direction.NORTH:
      cx = INTERSECTION_CENTER - LANE_OFFSET;
      cy = v.position;
      halfW = v.width / 2;
      halfH = v.length / 2;
      break;
    case Direction.SOUTH:
      cx = INTERSECTION_CENTER + LANE_OFFSET;
      cy = WORLD_SIZE - v.position;
      halfW = v.width / 2;
      halfH = v.length / 2;
      break;
    case Direction.WEST:
      cx = v.position;
      cy = INTERSECTION_CENTER + LANE_OFFSET;
      halfW = v.length / 2;
      halfH = v.width / 2;
      break;
    case Direction.EAST:
      cx = WORLD_SIZE - v.position;
      cy = INTERSECTION_CENTER - LANE_OFFSET;
      halfW = v.length / 2;
      halfH = v.width / 2;
      break;
  }

  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minY: cy - halfH,
    maxY: cy + halfH,
    cx,
    cy,
  };
}

/**
 * Detects pairs of vehicles whose world bounding boxes overlap within the
 * central intersection conflict zone ([INTERSECTION_MIN_BOUND, INTERSECTION_MAX_BOUND]).
 */
export function detectIntersectionCollisions(
  vehicles: Vehicle[]
): CollisionEvent[] {
  const collisions: CollisionEvent[] = [];
  const boundsList = vehicles.map((v) => ({
    vehicle: v,
    bounds: getVehicleWorldBounds(v),
  }));

  for (let i = 0; i < boundsList.length; i++) {
    const a = boundsList[i];
    // Quick rejection if vehicle A does not intersect the intersection box
    if (
      a.bounds.maxX <= INTERSECTION_MIN_BOUND ||
      a.bounds.minX >= INTERSECTION_MAX_BOUND ||
      a.bounds.maxY <= INTERSECTION_MIN_BOUND ||
      a.bounds.minY >= INTERSECTION_MAX_BOUND
    ) {
      continue;
    }

    for (let j = i + 1; j < boundsList.length; j++) {
      const b = boundsList[j];

      const overlapMinX = Math.max(a.bounds.minX, b.bounds.minX);
      const overlapMaxX = Math.min(a.bounds.maxX, b.bounds.maxX);
      if (overlapMaxX <= overlapMinX) continue;

      const overlapMinY = Math.max(a.bounds.minY, b.bounds.minY);
      const overlapMaxY = Math.min(a.bounds.maxY, b.bounds.maxY);
      if (overlapMaxY <= overlapMinY) continue;

      // Verify the overlap region itself lies inside the intersection zone
      const clippedMinX = Math.max(overlapMinX, INTERSECTION_MIN_BOUND);
      const clippedMaxX = Math.min(overlapMaxX, INTERSECTION_MAX_BOUND);
      const clippedMinY = Math.max(overlapMinY, INTERSECTION_MIN_BOUND);
      const clippedMaxY = Math.min(overlapMaxY, INTERSECTION_MAX_BOUND);

      if (clippedMaxX > clippedMinX && clippedMaxY > clippedMinY) {
        const lowId = Math.min(a.vehicle.id, b.vehicle.id);
        const highId = Math.max(a.vehicle.id, b.vehicle.id);
        collisions.push({
          pairKey: `${lowId}-${highId}`,
          vehicleAId: a.vehicle.id,
          vehicleBId: b.vehicle.id,
          directionA: a.vehicle.direction,
          directionB: b.vehicle.direction,
          overlapX: clippedMinX,
          overlapY: clippedMinY,
          overlapWidth: clippedMaxX - clippedMinX,
          overlapHeight: clippedMaxY - clippedMinY,
        });
      }
    }
  }

  return collisions;
}

export function computeSensors(
  vehicles: Vehicle[],
  highThreshold: number
): SensorReading {
  let northCount = 0;
  let southCount = 0;
  let eastCount = 0;
  let westCount = 0;

  for (const v of vehicles) {
    if (!v.inSensorZone) continue;
    switch (v.direction) {
      case Direction.NORTH:
        northCount++;
        break;
      case Direction.SOUTH:
        southCount++;
        break;
      case Direction.EAST:
        eastCount++;
        break;
      case Direction.WEST:
        westCount++;
        break;
    }
  }

  const nsTotal = northCount + southCount;
  const ewTotal = eastCount + westCount;

  return {
    northCount,
    southCount,
    eastCount,
    westCount,
    nsTotal,
    ewTotal,
    nsLevel: nsTotal >= highThreshold ? TrafficLevel.HIGH : TrafficLevel.LOW,
    ewLevel: ewTotal >= highThreshold ? TrafficLevel.HIGH : TrafficLevel.LOW,
    nsDensityPct: Math.min(
      100,
      Math.round((nsTotal / MAX_SENSOR_CAPACITY_PER_AXIS) * 100)
    ),
    ewDensityPct: Math.min(
      100,
      Math.round((ewTotal / MAX_SENSOR_CAPACITY_PER_AXIS) * 100)
    ),
  };
}

export function createInitialSimulationState(
  config: AgentConfig,
  scenario: TrafficScenario = TRAFFIC_SCENARIOS[0]
): SimulationState {
  const vehicles: Vehicle[] = [];
  let nextId = 1;

  const seed = scenario.seedVehicles ?? {};
  (Object.keys(seed) as Direction[]).forEach((dir) => {
    const count = seed[dir] ?? 0;
    for (let i = 0; i < count; i++) {
      // Space seeded vehicles upstream in the sensor loop
      const pos = STOP_LINE_POS - 24 - i * 54;
      if (pos > 0) {
        vehicles.push(createVehicle(nextId++, dir, pos));
      }
    }
  });

  const sensors = computeSensors(vehicles, config.highThreshold);
  const decision = evaluateReflexAgent(sensors, config);
  const collisions = detectIntersectionCollisions(vehicles);
  const initialAxis = decision.targetAxis;

  return {
    vehicles,
    nextVehicleId: nextId,
    nextLogId: 2,
    sensors,
    agentDecision: decision,
    controller: {
      activeAxis: initialAxis,
      nsLight:
        initialAxis === Axis.NORTH_SOUTH
          ? SignalLight.GREEN
          : SignalLight.RED,
      ewLight:
        initialAxis === Axis.EAST_WEST ? SignalLight.GREEN : SignalLight.RED,
      inTransition: false,
      transitionTargetAxis: null,
      phaseElapsedSec: 0,
      amberRemainingSec: 0,
    },
    collisions,
    metrics: {
      simTimeSec: 0,
      vehiclesCleared: 0,
      totalWaitSec: 0,
      avgWaitSec: 0,
      throughputPerMin: 0,
      activeVehicles: vehicles.length,
      nsQueued: 0,
      ewQueued: 0,
      totalCollisions: collisions.length,
      ruleHits: {
        [ReflexRuleId.NS_HIGH]: decision.ruleId === ReflexRuleId.NS_HIGH ? 1 : 0,
        [ReflexRuleId.EW_HIGH]: decision.ruleId === ReflexRuleId.EW_HIGH ? 1 : 0,
        [ReflexRuleId.BOTH_LOW]: decision.ruleId === ReflexRuleId.BOTH_LOW ? 1 : 0,
        [ReflexRuleId.EQUAL_HIGH_TIE_BREAK]:
          decision.ruleId === ReflexRuleId.EQUAL_HIGH_TIE_BREAK ? 1 : 0,
      },
    },
    decisionLog: [
      {
        id: 1,
        simTimeSec: 0,
        nsCount: sensors.nsTotal,
        ewCount: sensors.ewTotal,
        nsLevel: sensors.nsLevel,
        ewLevel: sensors.ewLevel,
        ruleId: decision.ruleId,
        ruleLabel: decision.ruleTitle,
        decidedAxis: decision.targetAxis,
        actionTaken: decision.actionSummary,
        wasHeldByMinGreen: false,
      },
    ],
    history: [
      {
        simTimeSec: 0,
        nsCount: sensors.nsTotal,
        ewCount: sensors.ewTotal,
        activeAxis: initialAxis,
      },
    ],
    lastHistorySampleSec: 0,
    spawnAccumulators: {
      [Direction.NORTH]: 0,
      [Direction.SOUTH]: 0,
      [Direction.EAST]: 0,
      [Direction.WEST]: 0,
    },
  };
}

export function spawnVehicleInDirection(
  state: SimulationState,
  direction: Direction,
  config: AgentConfig
): SimulationState {
  const laneVehicles = state.vehicles.filter((v) => v.direction === direction);
  // Find vehicle closest to entry (-24)
  let minPos = Infinity;
  for (const v of laneVehicles) {
    if (v.position < minPos) minPos = v.position;
  }

  // Prevent spawning overlapping a vehicle right at entry
  const spawnPos = minPos < 34 ? Math.min(-24, minPos - 54) : -24;
  if (spawnPos < -160) {
    // Lane completely backed up off-screen
    return state;
  }

  const newVehicle = createVehicle(state.nextVehicleId, direction, spawnPos);
  const vehicles = [...state.vehicles, newVehicle];
  const sensors = computeSensors(vehicles, config.highThreshold);
  const decision = evaluateReflexAgent(sensors, config);
  const collisions = detectIntersectionCollisions(vehicles);

  return {
    ...state,
    vehicles,
    nextVehicleId: state.nextVehicleId + 1,
    sensors,
    agentDecision: decision,
    collisions,
    metrics: {
      ...state.metrics,
      activeVehicles: vehicles.length,
    },
  };
}

export function stepSimulation(
  prevState: SimulationState,
  rawDt: number,
  config: AgentConfig,
  arrivalRates: ArrivalRates
): SimulationState {
  const dt = Math.min(rawDt, 0.08) * config.simSpeedMultiplier;
  if (dt <= 0) return prevState;

  const nextTime = prevState.metrics.simTimeSec + dt;
  let nextVehicleId = prevState.nextVehicleId;
  let nextLogId = prevState.nextLogId;
  const spawnAccumulators = { ...prevState.spawnAccumulators };

  // 1. Spawn incoming vehicles according to arrival rates (vehicles/min)
  const spawned: Vehicle[] = [];
  const directions = [
    Direction.NORTH,
    Direction.SOUTH,
    Direction.EAST,
    Direction.WEST,
  ];

  for (const dir of directions) {
    const ratePerSec = arrivalRates[dir] / 60;
    spawnAccumulators[dir] += ratePerSec * dt;
    if (spawnAccumulators[dir] >= 1) {
      spawnAccumulators[dir] -= 1;
      const existingInLane = prevState.vehicles.filter((v) => v.direction === dir);
      let minPos = Infinity;
      for (const v of existingInLane) {
        if (v.position < minPos) minPos = v.position;
      }
      if (minPos > 24) {
        spawned.push(createVehicle(nextVehicleId++, dir, -24));
      }
    }
  }

  // 2. Move vehicles along each directional lane with car-following & signal physics
  const allVehicles = [...prevState.vehicles, ...spawned];
  const updatedVehicles: Vehicle[] = [];
  let clearedThisStep = 0;
  let waitAccumThisStep = 0;
  let nsQueued = 0;
  let ewQueued = 0;

  for (const dir of directions) {
    const lane = allVehicles
      .filter((v) => v.direction === dir)
      .sort((a, b) => b.position - a.position); // Front-most vehicle first

    const axis = directionToAxis(dir);
    const light =
      axis === Axis.NORTH_SOUTH
        ? prevState.controller.nsLight
        : prevState.controller.ewLight;

    let leadRearEdge = Infinity;

    for (let i = 0; i < lane.length; i++) {
      const v = lane[i];
      const frontEdge = v.position + v.length / 2;
      const rearEdge = v.position - v.length / 2;

      const hasPassedStop = v.passedStopLine || frontEdge > STOP_LINE_POS + 4;

      // Determine stopping barrier: either lead vehicle's rear bumper or the red/amber stop line
      let maxAllowedFront = Infinity;

      if (leadRearEdge < Infinity) {
        // Maintain safe bumper-to-bumper following gap (14 units)
        maxAllowedFront = Math.min(maxAllowedFront, leadRearEdge - 14);
      }

      if (!hasPassedStop && light !== SignalLight.GREEN) {
        // Must stop behind stop line if signal is RED or AMBER (unless already too close to stop safely on amber)
        const distToStop = STOP_LINE_POS - frontEdge;
        if (light === SignalLight.RED || distToStop > 18) {
          maxAllowedFront = Math.min(maxAllowedFront, STOP_LINE_POS);
        }
      }

      const gap = maxAllowedFront - frontEdge;
      let targetSpeed = v.maxSpeed;
      let braking = false;

      if (gap <= 1.5) {
        targetSpeed = 0;
        braking = true;
      } else if (gap < 95) {
        // Smooth deceleration curve approaching stop line or lead vehicle
        const ratio = Math.max(0, Math.min(1, (gap - 2) / 93));
        targetSpeed = v.maxSpeed * Math.pow(ratio, 0.72);
        if (targetSpeed < v.speed - 4) {
          braking = true;
        }
      }

      let nextSpeed = v.speed;
      if (nextSpeed < targetSpeed) {
        nextSpeed = Math.min(targetSpeed, nextSpeed + 145 * dt); // Smooth acceleration
      } else {
        nextSpeed = Math.max(targetSpeed, nextSpeed - 260 * dt); // Responsive braking
      }

      let nextPos = v.position + nextSpeed * dt;
      // Hard safety clamp so vehicles never overlap lead vehicle or cross stop line on red
      if (maxAllowedFront < Infinity && nextPos + v.length / 2 > maxAllowedFront) {
        nextPos = maxAllowedFront - v.length / 2;
        nextSpeed = 0;
        braking = true;
      }

      const nextFront = nextPos + v.length / 2;
      const isQueued = nextSpeed < 12 && nextPos > 0 && nextFront <= STOP_LINE_POS + 6;
      const nextWaitTime = isQueued ? v.waitTime + dt : v.waitTime;
      if (isQueued) {
        if (axis === Axis.NORTH_SOUTH) nsQueued++;
        else ewQueued++;
      }

      const inSensorZone =
        nextPos >= SENSOR_START_POS && nextPos <= SENSOR_END_POS;
      const passedStopLine = hasPassedStop || nextFront > STOP_LINE_POS + 4;

      if (nextPos - v.length / 2 > WORLD_SIZE + 28) {
        clearedThisStep++;
        waitAccumThisStep += nextWaitTime;
      } else {
        updatedVehicles.push({
          ...v,
          position: nextPos,
          speed: nextSpeed,
          waitTime: nextWaitTime,
          inSensorZone,
          passedStopLine,
          braking: braking || nextSpeed < 5,
        });
        leadRearEdge = nextPos - v.length / 2;
      }
    }
  }

  // 3. Read current virtual roadway sensors (instantaneous percept)
  const sensors = computeSensors(updatedVehicles, config.highThreshold);

  // 4. Stateless Simple Reflex Agent evaluates current percepts ONLY
  const prevRuleId = prevState.agentDecision.ruleId;
  const decision = evaluateReflexAgent(sensors, config);

  // 5. Signal Controller Actuator (handles Amber safety clearance & Min Green Hold)
  let controller = {
    ...prevState.controller,
    phaseElapsedSec: prevState.controller.phaseElapsedSec + dt,
  };
  let logEntries = prevState.decisionLog;
  const ruleHits = { ...prevState.metrics.ruleHits };

  if (decision.ruleId !== prevRuleId) {
    ruleHits[decision.ruleId] = (ruleHits[decision.ruleId] ?? 0) + 1;
  }

  if (controller.inTransition) {
    controller.amberRemainingSec -= dt;
    if (controller.amberRemainingSec <= 0 && controller.transitionTargetAxis) {
      const nextActive = controller.transitionTargetAxis;
      controller = {
        activeAxis: nextActive,
        nsLight:
          nextActive === Axis.NORTH_SOUTH
            ? SignalLight.GREEN
            : SignalLight.RED,
        ewLight:
          nextActive === Axis.EAST_WEST ? SignalLight.GREEN : SignalLight.RED,
        inTransition: false,
        transitionTargetAxis: null,
        phaseElapsedSec: 0,
        amberRemainingSec: 0,
      };
    }
  } else if (decision.targetAxis !== controller.activeAxis) {
    const canSwitch = controller.phaseElapsedSec >= config.minGreenHoldSec;
    if (canSwitch) {
      if (config.amberDurationSec <= 0.05) {
        // Immediate reflex switch when amber clearance is disabled
        const nextActive = decision.targetAxis;
        controller = {
          activeAxis: nextActive,
          nsLight:
            nextActive === Axis.NORTH_SOUTH
              ? SignalLight.GREEN
              : SignalLight.RED,
          ewLight:
            nextActive === Axis.EAST_WEST ? SignalLight.GREEN : SignalLight.RED,
          inTransition: false,
          transitionTargetAxis: null,
          phaseElapsedSec: 0,
          amberRemainingSec: 0,
        };
      } else {
        // Enter Amber safety clearance phase for currently active axis
        controller = {
          ...controller,
          nsLight:
            controller.activeAxis === Axis.NORTH_SOUTH
              ? SignalLight.AMBER
              : SignalLight.RED,
          ewLight:
            controller.activeAxis === Axis.EAST_WEST
              ? SignalLight.AMBER
              : SignalLight.RED,
          inTransition: true,
          transitionTargetAxis: decision.targetAxis,
          amberRemainingSec: config.amberDurationSec,
        };
      }

      logEntries = [
        {
          id: nextLogId++,
          simTimeSec: nextTime,
          nsCount: sensors.nsTotal,
          ewCount: sensors.ewTotal,
          nsLevel: sensors.nsLevel,
          ewLevel: sensors.ewLevel,
          ruleId: decision.ruleId,
          ruleLabel: decision.ruleTitle,
          decidedAxis: decision.targetAxis,
          actionTaken: `Switched to ${axisLabel(decision.targetAxis)}`,
          wasHeldByMinGreen: false,
        },
        ...logEntries.slice(0, 49),
      ];
    } else if (decision.ruleId !== prevRuleId) {
      // Log rule change even if physical signal is temporarily held by min green time
      logEntries = [
        {
          id: nextLogId++,
          simTimeSec: nextTime,
          nsCount: sensors.nsTotal,
          ewCount: sensors.ewTotal,
          nsLevel: sensors.nsLevel,
          ewLevel: sensors.ewLevel,
          ruleId: decision.ruleId,
          ruleLabel: decision.ruleTitle,
          decidedAxis: decision.targetAxis,
          actionTaken: `Agent requests ${axisLabel(decision.targetAxis)} (min green hold)`,
          wasHeldByMinGreen: true,
        },
        ...logEntries.slice(0, 49),
      ];
    }
  } else if (decision.ruleId !== prevRuleId) {
    // Same green axis maintained, but active rule changed (e.g., Rule 3 -> Rule 1)
    logEntries = [
      {
        id: nextLogId++,
        simTimeSec: nextTime,
        nsCount: sensors.nsTotal,
        ewCount: sensors.ewTotal,
        nsLevel: sensors.nsLevel,
        ewLevel: sensors.ewLevel,
        ruleId: decision.ruleId,
        ruleLabel: decision.ruleTitle,
        decidedAxis: decision.targetAxis,
        actionTaken: `Maintained ${axisLabel(decision.targetAxis)}`,
        wasHeldByMinGreen: false,
      },
      ...logEntries.slice(0, 49),
    ];
  }

  // 6. Detect overlapping vehicles within the intersection zone
  const collisions = detectIntersectionCollisions(updatedVehicles);
  const prevPairKeys = new Set(prevState.collisions.map((c) => c.pairKey));
  let newCollisionIncidents = 0;
  for (const c of collisions) {
    if (!prevPairKeys.has(c.pairKey)) {
      newCollisionIncidents++;
    }
  }

  // 7. Update Metrics & Rolling History (every 1.0 sim second)
  const totalCleared = prevState.metrics.vehiclesCleared + clearedThisStep;
  const totalWait = prevState.metrics.totalWaitSec + waitAccumThisStep;
  const avgWaitSec = totalCleared > 0 ? totalWait / totalCleared : 0;
  const throughputPerMin =
    nextTime > 1 ? (totalCleared / nextTime) * 60 : 0;

  let history = prevState.history;
  let lastHistorySampleSec = prevState.lastHistorySampleSec;
  if (nextTime - lastHistorySampleSec >= 1.0) {
    lastHistorySampleSec = nextTime;
    history = [
      ...history.slice(-59),
      {
        simTimeSec: nextTime,
        nsCount: sensors.nsTotal,
        ewCount: sensors.ewTotal,
        activeAxis: controller.activeAxis,
      },
    ];
  }

  return {
    vehicles: updatedVehicles,
    nextVehicleId,
    nextLogId,
    sensors,
    agentDecision: decision,
    controller,
    collisions,
    metrics: {
      simTimeSec: nextTime,
      vehiclesCleared: totalCleared,
      totalWaitSec: totalWait,
      avgWaitSec,
      throughputPerMin,
      activeVehicles: updatedVehicles.length,
      nsQueued,
      ewQueued,
      totalCollisions: prevState.metrics.totalCollisions + newCollisionIncidents,
      ruleHits,
    },
    decisionLog: logEntries,
    history,
    lastHistorySampleSec,
    spawnAccumulators,
  };
}
