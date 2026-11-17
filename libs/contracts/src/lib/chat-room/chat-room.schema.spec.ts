import {
  RoomCommandSchema,
  RoomEventSchema,
  RoomMapSchema,
  ROOM_REACTIONS,
} from './chat-room.schema';

describe('playground socket contracts', () => {
  it('accepts every reaction in both directions and rejects an unknown reaction', () => {
    for (const { id } of ROOM_REACTIONS) {
      expect(
        RoomCommandSchema.safeParse({ type: 'reaction', reaction: id }).success,
      ).toBe(true);
      expect(
        RoomEventSchema.safeParse({
          type: 'reaction',
          reaction: id,
          playerId: 'a',
        }).success,
      ).toBe(true);
    }
    expect(
      RoomCommandSchema.safeParse({ type: 'reaction', reaction: 'other' })
        .success,
    ).toBe(false);
  });

  it('keeps old maps and joins compatible while validating board command bounds', () => {
    const map = RoomMapSchema.parse({
      width: 3200,
      height: 2240,
      speed: 190,
      radius: 12,
      spawn: { x: 1600, y: 1854 },
      objects: [],
    });
    expect(map.boardTables).toEqual([]);
    expect(map.colorTiles).toEqual([]);
    expect(
      RoomCommandSchema.safeParse({ type: 'join', name: 'An', color: 'teal' })
        .success,
    ).toBe(true);
    expect(
      RoomCommandSchema.safeParse({
        type: 'board-ready',
        table: 'chess-1',
        points: 9,
      }).success,
    ).toBe(false);
    expect(
      RoomCommandSchema.safeParse({
        type: 'board-ready',
        table: 'chess-1',
        points: 10,
      }).success,
    ).toBe(true);
    const move = {
      type: 'board-move',
      table: 'chess-1',
      matchId: 'bfb32f1e-6002-4f1f-95eb-a5bbb8bc15e9',
      version: 0,
      from: 52,
      to: 36,
    };
    expect(RoomCommandSchema.safeParse(move).success).toBe(true);
    expect(RoomCommandSchema.safeParse({ ...move, version: 0.5 }).success).toBe(
      false,
    );
    expect(RoomCommandSchema.safeParse({ ...move, to: 90 }).success).toBe(
      false,
    );
  });
});
