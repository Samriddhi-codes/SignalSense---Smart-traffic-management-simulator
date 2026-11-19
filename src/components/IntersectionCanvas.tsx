import React, { useEffect, useRef, useState } from 'react';
import {
  INTERSECTION_CENTER,
  LANE_OFFSET,
  ROAD_HALF_WIDTH,
  SENSOR_END_POS,
  SENSOR_START_POS,
  STOP_LINE_POS,
  WORLD_SIZE,
} from '../engine/simulation';
import {
  Direction,
  SignalLight,
  SimulationState,
  TrafficLevel,
  Vehicle,
} from '../types/traffic';

interface IntersectionCanvasProps {
  simState: SimulationState;
  highThreshold: number;
  onSpawnDirection: (dir: Direction) => void;
}

function getVehicleTransform(v: Vehicle): { x: number; y: number; angle: number } {
  switch (v.direction) {
    case Direction.NORTH:
      return {
        x: INTERSECTION_CENTER - LANE_OFFSET,
        y: v.position,
        angle: Math.PI / 2,
      };
    case Direction.SOUTH:
      return {
        x: INTERSECTION_CENTER + LANE_OFFSET,
        y: WORLD_SIZE - v.position,
        angle: -Math.PI / 2,
      };
    case Direction.WEST:
      return {
        x: v.position,
        y: INTERSECTION_CENTER + LANE_OFFSET,
        angle: 0,
      };
    case Direction.EAST:
      return {
        x: WORLD_SIZE - v.position,
        y: INTERSECTION_CENTER - LANE_OFFSET,
        angle: Math.PI,
      };
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle) {
  const { x, y, angle } = getVehicleTransform(v);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const halfL = v.length / 2;
  const halfW = v.width / 2;

  // Ground contact shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
  drawRoundedRect(ctx, -halfL + 1, -halfW + 2, v.length, v.width, 5);
  ctx.fill();

  // Chassis body
  ctx.fillStyle = v.color;
  drawRoundedRect(ctx, -halfL, -halfW, v.length, v.width, 5);
  ctx.fill();

  // Subtle chassis outline
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Roof & windshield glass (vehicle faces +X in local coords)
  ctx.fillStyle = '#0F172A';
  if (v.vehicleType === 'van') {
    drawRoundedRect(ctx, -halfL + 4, -halfW + 3, v.length * 0.45, v.width - 6, 3);
    ctx.fill();
    // Front windshield
    ctx.fillStyle = '#334155';
    drawRoundedRect(ctx, halfL - 10, -halfW + 3, 6, v.width - 6, 2);
    ctx.fill();
  } else {
    // Cabin glass
    drawRoundedRect(ctx, -halfL + 6, -halfW + 3, v.length - 13, v.width - 6, 3);
    ctx.fill();
    // Roof panel matching body
    ctx.fillStyle = v.color;
    drawRoundedRect(ctx, -halfL + 10, -halfW + 4.5, v.length - 22, v.width - 9, 2);
    ctx.fill();
  }

  // Headlights (front = +X)
  ctx.fillStyle = '#FEF9C3';
  ctx.fillRect(halfL - 2, -halfW + 2.5, 2.5, 3.5);
  ctx.fillRect(halfL - 2, halfW - 6, 2.5, 3.5);

  // Brake lights (rear = -X)
  if (v.braking) {
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 7;
  } else {
    ctx.fillStyle = '#991B1B';
  }
  ctx.fillRect(-halfL - 0.5, -halfW + 2.5, 2.5, 3.5);
  ctx.fillRect(-halfL - 0.5, halfW - 6, 2.5, 3.5);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawSignalHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  light: SignalLight,
  orientation: 'horizontal' | 'vertical',
  axisTag: string
) {
  ctx.save();
  ctx.translate(x, y);

  const housingW = orientation === 'horizontal' ? 66 : 26;
  const housingH = orientation === 'horizontal' ? 26 : 66;

  // Signal housing
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, -housingW / 2, -housingH / 2, housingW, housingH, 6);
  ctx.fill();
  ctx.stroke();

  const lights: { state: SignalLight; active: string; dim: string }[] = [
    { state: SignalLight.RED, active: '#EF4444', dim: '#450A0A' },
    { state: SignalLight.AMBER, active: '#F59E0B', dim: '#451A03' },
    { state: SignalLight.GREEN, active: '#22C55E', dim: '#052E16' },
  ];

  lights.forEach((item, idx) => {
    const offset = (idx - 1) * 19;
    const lx = orientation === 'horizontal' ? offset : 0;
    const ly = orientation === 'horizontal' ? 0 : offset;
    const isOn = light === item.state;

    ctx.beginPath();
    ctx.arc(lx, ly, 6.2, 0, Math.PI * 2);
    ctx.fillStyle = isOn ? item.active : item.dim;
    if (isOn) {
      ctx.shadowColor = item.active;
      ctx.shadowBlur = 12;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fill();
  });

  ctx.shadowBlur = 0;

  // Explicit non-hue-only text tag adjacent to signal head
  const stateWord =
    light === SignalLight.GREEN
      ? 'GO'
      : light === SignalLight.AMBER
        ? 'SLOW'
        : 'STOP';
  const tagColor =
    light === SignalLight.GREEN
      ? '#15803D'
      : light === SignalLight.AMBER
        ? '#B45309'
        : '#B91C1C';

  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labelY = orientation === 'horizontal' ? housingH / 2 + 12 : housingH / 2 + 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  drawRoundedRect(ctx, -31, labelY - 8, 62, 16, 4);
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = tagColor;
  ctx.fillText(`${axisTag} ${stateWord}`, 0, labelY + 0.5);

  ctx.restore();
}

function hitTestDirection(px: number, py: number): Direction | null {
  const minRoad = INTERSECTION_CENTER - ROAD_HALF_WIDTH;
  const maxRoad = INTERSECTION_CENTER + ROAD_HALF_WIDTH;

  // North arm (top)
  if (px >= minRoad && px <= INTERSECTION_CENTER && py >= 0 && py < minRoad) {
    return Direction.NORTH;
  }
  // South arm (bottom)
  if (px >= INTERSECTION_CENTER && px <= maxRoad && py > maxRoad && py <= WORLD_SIZE) {
    return Direction.SOUTH;
  }
  // West arm (left)
  if (py >= INTERSECTION_CENTER && py <= maxRoad && px >= 0 && px < minRoad) {
    return Direction.WEST;
  }
  // East arm (right)
  if (py >= minRoad && py <= INTERSECTION_CENTER && px > maxRoad && px <= WORLD_SIZE) {
    return Direction.EAST;
  }
  return null;
}

export const IntersectionCanvas: React.FC<IntersectionCanvasProps> = ({
  simState,
  highThreshold,
  onSpawnDirection,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredDir, setHoveredDir] = useState<Direction | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetPx = WORLD_SIZE * dpr;
    if (canvas.width !== targetPx || canvas.height !== targetPx) {
      canvas.width = targetPx;
      canvas.height = targetPx;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Urban ground / landscaped architectural quadrants
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    const minRoad = INTERSECTION_CENTER - ROAD_HALF_WIDTH;
    const maxRoad = INTERSECTION_CENTER + ROAD_HALF_WIDTH;
    const blockPads = [
      { x: 14, y: 14, w: minRoad - 28, h: minRoad - 28 },
      { x: maxRoad + 14, y: 14, w: minRoad - 28, h: minRoad - 28 },
      { x: 14, y: maxRoad + 14, w: minRoad - 28, h: minRoad - 28 },
      { x: maxRoad + 14, y: maxRoad + 14, w: minRoad - 28, h: minRoad - 28 },
    ];

    blockPads.forEach((pad) => {
      // Sidewalk outer border
      ctx.fillStyle = '#F1F5F9';
      drawRoundedRect(ctx, pad.x, pad.y, pad.w, pad.h, 14);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner urban park / block lawn
      ctx.fillStyle = '#DCE7DF';
      drawRoundedRect(ctx, pad.x + 16, pad.y + 16, pad.w - 32, pad.h - 32, 8);
      ctx.fill();
    });

    // 2. Asphalt Roads (North-South and East-West corridors)
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(minRoad, 0, ROAD_HALF_WIDTH * 2, WORLD_SIZE);
    ctx.fillRect(0, minRoad, WORLD_SIZE, ROAD_HALF_WIDTH * 2);

    // Subtle road shoulder edges
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    // Vertical edges
    ctx.beginPath();
    ctx.moveTo(minRoad, 0);
    ctx.lineTo(minRoad, minRoad);
    ctx.moveTo(maxRoad, 0);
    ctx.lineTo(maxRoad, minRoad);
    ctx.moveTo(minRoad, maxRoad);
    ctx.lineTo(minRoad, WORLD_SIZE);
    ctx.moveTo(maxRoad, maxRoad);
    ctx.lineTo(maxRoad, WORLD_SIZE);
    // Horizontal edges
    ctx.moveTo(0, minRoad);
    ctx.lineTo(minRoad, minRoad);
    ctx.moveTo(maxRoad, minRoad);
    ctx.lineTo(WORLD_SIZE, minRoad);
    ctx.moveTo(0, maxRoad);
    ctx.lineTo(minRoad, maxRoad);
    ctx.moveTo(maxRoad, maxRoad);
    ctx.lineTo(WORLD_SIZE, maxRoad);
    ctx.stroke();

    // 3. Double Yellow Centerlines
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    const drawDoubleCenterline = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      dx: number,
      dy: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x1 - dx, y1 - dy);
      ctx.lineTo(x2 - dx, y2 - dy);
      ctx.moveTo(x1 + dx, y1 + dy);
      ctx.lineTo(x2 + dx, y2 + dy);
      ctx.stroke();
    };
    drawDoubleCenterline(INTERSECTION_CENTER, 0, INTERSECTION_CENTER, STOP_LINE_POS, 2.5, 0);
    drawDoubleCenterline(
      INTERSECTION_CENTER,
      WORLD_SIZE - STOP_LINE_POS,
      INTERSECTION_CENTER,
      WORLD_SIZE,
      2.5,
      0
    );
    drawDoubleCenterline(0, INTERSECTION_CENTER, STOP_LINE_POS, INTERSECTION_CENTER, 0, 2.5);
    drawDoubleCenterline(
      WORLD_SIZE - STOP_LINE_POS,
      INTERSECTION_CENTER,
      WORLD_SIZE,
      INTERSECTION_CENTER,
      0,
      2.5
    );

    // 4. Crosswalk Zebra Stripes
    ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
    const stripeCount = 7;
    const stripeSpan = (ROAD_HALF_WIDTH * 2 - 16) / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const offset = minRoad + 8 + i * stripeSpan + 3;
      // North & South crosswalks
      ctx.fillRect(offset, STOP_LINE_POS + 8, stripeSpan - 8, 20);
      ctx.fillRect(offset, WORLD_SIZE - STOP_LINE_POS - 28, stripeSpan - 8, 20);
      // West & East crosswalks
      ctx.fillRect(STOP_LINE_POS + 8, offset, 20, stripeSpan - 8);
      ctx.fillRect(WORLD_SIZE - STOP_LINE_POS - 28, offset, 20, stripeSpan - 8);
    }

    // 5. Stop Lines
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // North incoming (left half of top arm)
    ctx.moveTo(minRoad + 4, STOP_LINE_POS);
    ctx.lineTo(INTERSECTION_CENTER - 4, STOP_LINE_POS);
    // South incoming (right half of bottom arm)
    ctx.moveTo(INTERSECTION_CENTER + 4, WORLD_SIZE - STOP_LINE_POS);
    ctx.lineTo(maxRoad - 4, WORLD_SIZE - STOP_LINE_POS);
    // West incoming (bottom half of left arm)
    ctx.moveTo(STOP_LINE_POS, INTERSECTION_CENTER + 4);
    ctx.lineTo(STOP_LINE_POS, maxRoad - 4);
    // East incoming (top half of right arm)
    ctx.moveTo(WORLD_SIZE - STOP_LINE_POS, minRoad + 4);
    ctx.lineTo(WORLD_SIZE - STOP_LINE_POS, INTERSECTION_CENTER - 4);
    ctx.stroke();

    // 6. Virtual Inductive Sensor Zones (embedded pavement loops)
    const sensorLen = SENSOR_END_POS - SENSOR_START_POS;
    const { sensors } = simState;

    const sensorZones: {
      dir: Direction;
      x: number;
      y: number;
      w: number;
      h: number;
      count: number;
      axisHigh: boolean;
      label: string;
    }[] = [
      {
        dir: Direction.NORTH,
        x: minRoad + 10,
        y: SENSOR_START_POS,
        w: ROAD_HALF_WIDTH - 20,
        h: sensorLen,
        count: sensors.northCount,
        axisHigh: sensors.nsLevel === TrafficLevel.HIGH,
        label: `N · ${sensors.northCount}`,
      },
      {
        dir: Direction.SOUTH,
        x: INTERSECTION_CENTER + 10,
        y: WORLD_SIZE - SENSOR_END_POS,
        w: ROAD_HALF_WIDTH - 20,
        h: sensorLen,
        count: sensors.southCount,
        axisHigh: sensors.nsLevel === TrafficLevel.HIGH,
        label: `S · ${sensors.southCount}`,
      },
      {
        dir: Direction.WEST,
        x: SENSOR_START_POS,
        y: INTERSECTION_CENTER + 10,
        w: sensorLen,
        h: ROAD_HALF_WIDTH - 20,
        count: sensors.westCount,
        axisHigh: sensors.ewLevel === TrafficLevel.HIGH,
        label: `W · ${sensors.westCount}`,
      },
      {
        dir: Direction.EAST,
        x: WORLD_SIZE - SENSOR_END_POS,
        y: minRoad + 10,
        w: sensorLen,
        h: ROAD_HALF_WIDTH - 20,
        count: sensors.eastCount,
        axisHigh: sensors.ewLevel === TrafficLevel.HIGH,
        label: `E · ${sensors.eastCount}`,
      },
    ];

    sensorZones.forEach((zone) => {
      const isHovered = hoveredDir === zone.dir;
      const fill = zone.axisHigh
        ? 'rgba(245, 158, 11, 0.16)'
        : zone.count > 0
          ? 'rgba(56, 189, 248, 0.14)'
          : 'rgba(148, 163, 184, 0.06)';
      const stroke = isHovered
        ? '#38BDF8'
        : zone.axisHigh
          ? '#F59E0B'
          : zone.count > 0
            ? '#38BDF8'
            : '#64748B';

      ctx.save();
      ctx.fillStyle = fill;
      drawRoundedRect(ctx, zone.x, zone.y, zone.w, zone.h, 6);
      ctx.fill();

      ctx.strokeStyle = stroke;
      ctx.lineWidth = isHovered ? 2.2 : 1.5;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.restore();

      if (isHovered) {
        ctx.save();
        ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
        drawRoundedRect(ctx, zone.x - 4, zone.y - 4, zone.w + 8, zone.h + 8, 8);
        ctx.fill();
        ctx.restore();
      }
    });

    // Subtle directional lane arrows inside outgoing/incoming lanes
    ctx.fillStyle = 'rgba(248, 250, 252, 0.22)';
    const drawArrow = (cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-4, -7);
      ctx.lineTo(-4, -2.5);
      ctx.lineTo(-12, -2.5);
      ctx.lineTo(-12, 2.5);
      ctx.lineTo(-4, 2.5);
      ctx.lineTo(-4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    drawArrow(INTERSECTION_CENTER - LANE_OFFSET, 255, Math.PI / 2);
    drawArrow(INTERSECTION_CENTER + LANE_OFFSET, WORLD_SIZE - 255, -Math.PI / 2);
    drawArrow(255, INTERSECTION_CENTER + LANE_OFFSET, 0);
    drawArrow(WORLD_SIZE - 255, INTERSECTION_CENTER - LANE_OFFSET, Math.PI);

    // 7. Vehicles
    for (const v of simState.vehicles) {
      drawVehicle(ctx, v);
    }

    // 8. Traffic Signal Heads at the 4 corners adjacent to stop lines
    const { nsLight, ewLight } = simState.controller;
    // Northbound / Southbound signals
    drawSignalHead(ctx, minRoad - 28, STOP_LINE_POS - 24, nsLight, 'vertical', 'NS');
    drawSignalHead(
      ctx,
      maxRoad + 28,
      WORLD_SIZE - STOP_LINE_POS + 24,
      nsLight,
      'vertical',
      'NS'
    );
    // Eastbound / Westbound signals
    drawSignalHead(
      ctx,
      STOP_LINE_POS - 24,
      maxRoad + 28,
      ewLight,
      'horizontal',
      'EW'
    );
    drawSignalHead(
      ctx,
      WORLD_SIZE - STOP_LINE_POS + 24,
      minRoad - 28,
      ewLight,
      'horizontal',
      'EW'
    );

    // 9. Clean Virtual Sensor Readouts in the 4 inner sidewalk corners
    const drawCornerSensorTag = (
      x: number,
      y: number,
      title: string,
      count: number,
      axisHigh: boolean
    ) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      drawRoundedRect(ctx, x, y, 108, 36, 8);
      ctx.fill();
      ctx.strokeStyle = axisHigh ? '#D97706' : '#CBD5E1';
      ctx.lineWidth = axisHigh ? 1.5 : 1;
      ctx.stroke();

      ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(title, x + 9, y + 6);

      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = axisHigh ? '#B45309' : '#0F172A';
      ctx.fillText(`${count} veh`, x + 9, y + 19);

      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = axisHigh ? '#D97706' : '#0284C7';
      ctx.fillText(axisHigh ? 'HIGH' : 'LOW', x + 99, y + 20);
      ctx.restore();
    };

    drawCornerSensorTag(
      minRoad - 122,
      54,
      'North Sensor',
      sensors.northCount,
      sensors.nsLevel === TrafficLevel.HIGH
    );
    drawCornerSensorTag(
      maxRoad + 14,
      WORLD_SIZE - 90,
      'South Sensor',
      sensors.southCount,
      sensors.nsLevel === TrafficLevel.HIGH
    );
    drawCornerSensorTag(
      54,
      maxRoad + 14,
      'West Sensor',
      sensors.westCount,
      sensors.ewLevel === TrafficLevel.HIGH
    );
    drawCornerSensorTag(
      WORLD_SIZE - 162,
      minRoad - 50,
      'East Sensor',
      sensors.eastCount,
      sensors.ewLevel === TrafficLevel.HIGH
    );

    // Subtle threshold note at very bottom-left sidewalk pad
    ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Click any incoming road lane to add a vehicle · High ≥ ${highThreshold}/axis`,
      24,
      WORLD_SIZE - 24
    );

    ctx.restore();
  }, [simState, highThreshold, hoveredDir]);

  const toWorldCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORLD_SIZE / rect.width;
    const scaleY = WORLD_SIZE / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toWorldCoords(e);
    if (!pt) return;
    setHoveredDir(hitTestDirection(pt.x, pt.y));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toWorldCoords(e);
    if (!pt) return;
    const dir = hitTestDirection(pt.x, pt.y);
    if (dir) {
      onSpawnDirection(dir);
    }
  };

  return (
    <div className="relative w-full aspect-square max-w-[680px] mx-auto rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredDir(null)}
        onClick={handleClick}
        aria-label="Interactive four-way traffic intersection simulation"
        className={`w-full h-full block ${hoveredDir ? 'cursor-pointer' : 'cursor-default'}`}
      />
    </div>
  );
};
