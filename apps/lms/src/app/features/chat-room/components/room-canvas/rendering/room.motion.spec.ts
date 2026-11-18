import type { RoomMap } from '@lms/contracts';
import {
  facingFromVector,
  facingYaw,
  moveInRoom,
  walkable,
} from './room.motion';

const map: RoomMap = {
  width: 400,
  height: 400,
  radius: 12,
  speed: 190,
  spawn: { x: 80, y: 100 },
  objects: [{ kind: 'desk', x: 150, y: 150, w: 100, h: 60 }],
  boardTables: [],
  colorTiles: [],
};

describe('shared room movement', () => {
  it('uses eight directions, keeping the last direction when idle', () => {
    expect(facingFromVector(1, 0)).toBe('east');
    expect(facingFromVector(-1, -1)).toBe('northwest');
    expect(facingFromVector(0, 0, 'west')).toBe('west');
    expect(facingYaw('north')).toBe(0);
    expect(facingYaw('east')).toBe(-Math.PI / 2);
  });
  it('blocks furniture and tunneling with the same footprint in both renderers', () => {
    expect(walkable(map, 160, 160)).toBe(false);
    const end = moveInRoom(map, { x: 100, y: 180 }, 200, 0);
    expect(end.x).toBeLessThanOrEqual(138);
    expect(end.x).toBeGreaterThan(130);
    expect(end.y).toBe(180);
  });
  it('slides along a blocked object and cannot leave room boundaries', () => {
    const end = moveInRoom(map, { x: 130, y: 140 }, 50, 50);
    expect(walkable(map, end.x, end.y)).toBe(true);
    const edge = moveInRoom(map, { x: 50, y: 70 }, -200, -200);
    expect(edge.x).toBeGreaterThanOrEqual(44);
    expect(edge.y).toBeGreaterThanOrEqual(60);
  });
});
