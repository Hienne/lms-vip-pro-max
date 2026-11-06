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

export const RoomPlayerSchema = RoomIdentitySchema.extend({
  id: z.string(),
  x: z.number(),
  y: z.number(),
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

export const RoomMapSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  speed: z.number().positive(),
  radius: z.number().positive(),
  spawn: z.object({ x: z.number(), y: z.number() }),
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
export const RoomCommandSchema = z.discriminatedUnion('type', [
  RoomIdentitySchema.extend({ type: z.literal('join') }),
  z.object({ type: z.literal('move'), x: z.number(), y: z.number() }),
  z.object({
    type: z.literal('chat'),
    text: z.string().trim().min(1).max(280),
  }),
  z.object({ type: z.literal('ping') }),
]);
export const RoomEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    id: z.string(),
    players: z.array(RoomPlayerSchema),
    history: z.array(RoomChatSchema),
  }),
  z.object({ type: z.literal('joined'), player: RoomPlayerSchema }),
  z.object({ type: z.literal('left'), id: z.string(), name: z.string() }),
  z.object({
    type: z.literal('moved'),
    id: z.string(),
    x: z.number(),
    y: z.number(),
  }),
  z.object({ type: z.literal('correction'), x: z.number(), y: z.number() }),
  RoomChatSchema.extend({ type: z.literal('chat') }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('pong') }),
]);
export type RoomEvent = z.infer<typeof RoomEventSchema>;
export type RoomCommand = z.infer<typeof RoomCommandSchema>;
