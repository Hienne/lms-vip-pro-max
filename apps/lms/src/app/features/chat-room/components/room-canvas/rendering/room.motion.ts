import type { RoomFacing, RoomMap } from '@lms/contracts';

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
