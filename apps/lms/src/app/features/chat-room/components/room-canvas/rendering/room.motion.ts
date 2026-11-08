import type { RoomFacing, RoomMap } from '@lms/contracts';
import type { TimedRoomGesture } from '../../../data-access/chat-room.model';

export interface GesturePose {
  lift: number;
  wave: number;
  facing?: RoomFacing;
  highFive?: {
    amount: number;
    x: number;
    y: number;
    yaw: number;
    leading: boolean;
  };
}

const RESTING_POSE: GesturePose = { lift: 0, wave: 0 };

export function gesturePose(
  gesture: TimedRoomGesture | undefined,
  now: number,
  reducedMotion: boolean,
): GesturePose {
  if (!gesture) return RESTING_POSE;
  if (gesture.kind === 'high-five') {
    const progress = (now - gesture.startedAt) / 950;
    if (progress < 0 || progress >= 1) return RESTING_POSE;
    const dx = gesture.partner.x - gesture.origin.x;
    const dy = gesture.partner.y - gesture.origin.y;
    const distance = Math.hypot(dx, dy);
    const amount = reducedMotion ? 1 : Math.sin(progress * Math.PI);
    const step = ((distance - 78) * amount) / (2 * (distance || 1));
    return {
      lift: 0,
      wave: amount,
      facing: facingFromVector(dx, dy),
      highFive: {
        amount,
        x: dx * step,
        y: dy * step,
        yaw: Math.atan2(-dx, -dy),
        leading: gesture.leading,
      },
    };
  }
  const progress =
    (now - gesture.startedAt) / (gesture.kind === 'jump' ? 760 : 1150);
  if (progress < 0 || progress >= 1) return RESTING_POSE;
  if (gesture.kind === 'jump') {
    return reducedMotion
      ? RESTING_POSE
      : { lift: 4 * progress * (1 - progress), wave: 0 };
  }
  const raise = Math.min(1, progress * 7, (1 - progress) * 7);
  return {
    lift: 0,
    wave: reducedMotion
      ? 1
      : raise * (1 + Math.sin(progress * 6 * Math.PI) * 0.14),
    facing: reducedMotion ? undefined : gesture.facing,
  };
}

export function seatCenter(
  map: RoomMap,
  index: number | undefined,
): { x: number; y: number } | undefined {
  const chair = index === undefined ? undefined : map.objects[index];
  if (chair?.kind === 'chair')
    return { x: chair.x + chair.w / 2, y: chair.y + chair.h / 2 };
  return undefined;
}

const OCTANTS: readonly RoomFacing[] = [
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
];

export function facingFromVector(
  x: number,
  y: number,
  fallback: RoomFacing = 'south',
): RoomFacing {
  if (Math.hypot(x, y) < 0.001) return fallback;
  return OCTANTS[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
}

export function facingYaw(facing: RoomFacing): number {
  return {
    north: 0,
    northeast: -Math.PI / 4,
    east: -Math.PI / 2,
    southeast: (-Math.PI * 3) / 4,
    south: Math.PI,
    southwest: (Math.PI * 3) / 4,
    west: Math.PI / 2,
    northwest: Math.PI / 4,
  }[facing];
}

export function walkable(map: RoomMap, x: number, y: number): boolean {
  const r = map.radius;
  return (
    x >= 32 + r &&
    y >= 48 + r &&
    x <= map.width - 32 - r &&
    y <= map.height - 32 - r &&
    !map.objects.some(
      (o) =>
        x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h,
    )
  );
}

export function moveInRoom(
  map: RoomMap,
  position: { x: number; y: number },
  dx: number,
  dy: number,
): { x: number; y: number } {
  const result = { ...position };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 0; i < steps; i++) {
    if (walkable(map, result.x + dx / steps, result.y)) result.x += dx / steps;
    if (walkable(map, result.x, result.y + dy / steps)) result.y += dy / steps;
  }
  return result;
}
