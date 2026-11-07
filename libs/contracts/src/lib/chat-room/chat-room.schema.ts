import { z } from 'zod';

export const RoomColorSchema = z.enum([
  'teal',
  'slate',
  'amber',
  'blue',
  'rose',
]);
export type RoomColor = z.infer<typeof RoomColorSchema>;

export const RoomIdentitySchema = z.object({
  name: z.string().trim().min(1).max(24),
  color: RoomColorSchema,
});
export type RoomIdentity = z.infer<typeof RoomIdentitySchema>;

export const RoomFacingSchema = z.enum([
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
]);
export type RoomFacing = z.infer<typeof RoomFacingSchema>;
export const RoomMovementSchema = z.object({
  x: z.number(),
  y: z.number(),
  facing: RoomFacingSchema.optional(),
});
export type RoomMovement = z.infer<typeof RoomMovementSchema>;

export const RoomPlayerSchema = RoomIdentitySchema.extend({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  facing: RoomFacingSchema.optional(),
});
export type RoomPlayer = z.infer<typeof RoomPlayerSchema>;

export const RoomChatSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  name: z.string(),
  color: RoomColorSchema,
  text: z.string().max(280),
  at: z.iso.datetime(),
});
export type RoomChat = z.infer<typeof RoomChatSchema>;

const RoomGestureKindSchema = z.enum(['jump', 'wave']);
export type RoomGestureKind = z.infer<typeof RoomGestureKindSchema>;
const RoomGestureSchema = z.object({
  type: z.literal('gesture'),
  kind: RoomGestureKindSchema,
  playerId: z.string(),
  targetId: z.string().optional(),
  facing: RoomFacingSchema.optional(),
});
export type RoomGesture = z.infer<typeof RoomGestureSchema>;

export const RoomMapSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  speed: z.number().positive(),
  radius: z.number().positive(),
  spawn: z.object({ x: z.number(), y: z.number() }),
  activityArea: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
    })
    .nullish(),
  objects: z.array(
    z.object({
      kind: z.enum(['board', 'shelf', 'plant', 'desk', 'chair']),
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
    }),
  ),
});
export type RoomMap = z.infer<typeof RoomMapSchema>;
export type RoomFurniture = RoomMap['objects'][number];

export const RoomTicketSchema = z.object({
  ticket: z.string(),
  expiresAt: z.iso.datetime(),
});
const RoomGameStateSchema = z.object({
  type: z.literal('game'),
  hostId: z.string(),
  round: z
    .object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.string()).length(4),
      answered: z.int().nonnegative(),
      yourChoice: z
        .int()
        .min(0)
        .max(3)
        .nullish()
        .transform((choice) => choice ?? null),
      correctIndex: z.int().min(0).max(3).optional(),
      correctCount: z.int().nonnegative().optional(),
    })
    .optional(),
});
export type RoomGameState = z.infer<typeof RoomGameStateSchema>;

export const RoomCommandSchema = z.discriminatedUnion('type', [
  RoomIdentitySchema.extend({
    type: z.literal('join'),
    activities: z.literal(true).optional(),
    gestures: z.literal(true).optional(),
  }),
  RoomMovementSchema.extend({ type: z.literal('move') }),
  z.object({
    type: z.literal('chat'),
    text: z.string().trim().min(1).max(280),
  }),
  z.object({ type: z.literal('game-start') }),
  z.object({ type: z.literal('gesture'), kind: RoomGestureKindSchema }),
  z.object({ type: z.literal('game-close'), roundId: z.string() }),
  z.object({
    type: z.literal('game-answer'),
    roundId: z.string(),
    choice: z.int().min(0).max(3),
  }),
  z.object({ type: z.literal('ping') }),
]);
export const RoomEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    id: z.string(),
    players: z.array(RoomPlayerSchema),
    gestures: z.boolean().optional(),
    // Older servers may send this field; clients never retain or display it.
    history: z.array(RoomChatSchema).optional(),
  }),
  z.object({ type: z.literal('joined'), player: RoomPlayerSchema }),
  z.object({ type: z.literal('left'), id: z.string(), name: z.string() }),
  z.object({
    type: z.literal('moved'),
    id: z.string(),
    x: z.number(),
    y: z.number(),
    facing: RoomFacingSchema.optional(),
  }),
  z.object({ type: z.literal('correction'), x: z.number(), y: z.number() }),
  RoomChatSchema.extend({ type: z.literal('chat') }),
  RoomGestureSchema,
  RoomGameStateSchema,
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('pong') }),
]);
export type RoomEvent = z.infer<typeof RoomEventSchema>;
export type RoomCommand = z.infer<typeof RoomCommandSchema>;
