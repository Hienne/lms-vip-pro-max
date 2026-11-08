import { z } from 'zod';

export const RoomColorSchema = z.enum([
  'teal',
  'slate',
  'amber',
  'blue',
  'rose',
]);
export type RoomColor = z.infer<typeof RoomColorSchema>;
export const RoomAvatarStyleSchema = z.enum(['male', 'female']);
export type RoomAvatarStyle = z.infer<typeof RoomAvatarStyleSchema>;

export const RoomIdentitySchema = z.object({
  name: z.string().trim().min(1).max(24),
  color: RoomColorSchema,
  avatar: RoomAvatarStyleSchema.optional(),
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
  seat: z.int().nonnegative().optional(),
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

const RoomAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type RoomArea = z.infer<typeof RoomAreaSchema>;

export const RoomMapSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  speed: z.number().positive(),
  radius: z.number().positive(),
  spawn: z.object({ x: z.number(), y: z.number() }),
  activityArea: RoomAreaSchema.nullish(),
  diceArea: RoomAreaSchema.nullish(),
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
const RoomDiceSideSchema = z.enum(['small', 'big']);
export type RoomDiceSide = z.infer<typeof RoomDiceSideSchema>;
const RoomDiceRollSchema = z.object({
  type: z.literal('dice-roll'),
  turn: z.int().nonnegative(),
  side: RoomDiceSideSchema,
  stake: z.int().positive(),
});
export type RoomDiceBet = Pick<
  z.infer<typeof RoomDiceRollSchema>,
  'side' | 'stake'
>;
const DiceFaceSchema = z.int().min(1).max(6);
const RoomDiceStateSchema = z.object({
  type: z.literal('dice-state'),
  balance: z.int().nonnegative(),
  turn: z.int().nonnegative(),
  result: z
    .object({
      side: RoomDiceSideSchema,
      stake: z.int().positive(),
      dice: z.tuple([DiceFaceSchema, DiceFaceSchema, DiceFaceSchema]),
      total: z.int().min(3).max(18),
      outcome: z.enum(['small', 'big', 'triple']),
      won: z.boolean(),
    })
    .optional(),
});
export type RoomDiceState = z.infer<typeof RoomDiceStateSchema>;

const RoomSeatCommandSchema = z.object({
  type: z.literal('seat'),
  action: z.enum(['sit', 'stand']),
  chair: z.int().nonnegative().optional(),
});
const HighFiveInviteCommandSchema = z.object({
  type: z.literal('high-five-invite'),
});
const HighFiveReplyCommandSchema = z.object({
  type: z.literal('high-five-reply'),
  inviteId: z.string(),
  accept: z.boolean(),
});
export type RoomInteractionCommand = z.infer<
  | typeof RoomSeatCommandSchema
  | typeof HighFiveInviteCommandSchema
  | typeof HighFiveReplyCommandSchema
>;
const HighFiveInviteSchema = z.object({
  type: z.literal('high-five-invite'),
  id: z.string(),
  from: z.string(),
  to: z.string(),
});
export type RoomHighFiveInvite = z.infer<typeof HighFiveInviteSchema>;
const HighFiveParticipantSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
});
const HighFiveSchema = z.object({
  type: z.literal('high-five'),
  from: HighFiveParticipantSchema,
  to: HighFiveParticipantSchema,
});
export type RoomHighFive = z.infer<typeof HighFiveSchema>;

export const RoomCommandSchema = z.discriminatedUnion('type', [
  RoomIdentitySchema.extend({
    type: z.literal('join'),
    dice: z.literal(true).optional(),
    gestures: z.literal(true).optional(),
    interactions: z.literal(true).optional(),
  }),
  RoomMovementSchema.extend({ type: z.literal('move') }),
  z.object({
    type: z.literal('chat'),
    text: z.string().trim().min(1).max(280),
  }),
  RoomDiceRollSchema,
  z.object({ type: z.literal('gesture'), kind: RoomGestureKindSchema }),
  RoomSeatCommandSchema,
  HighFiveInviteCommandSchema,
  HighFiveReplyCommandSchema,
  z.object({ type: z.literal('ping') }),
]);
export const RoomEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    id: z.string(),
    players: z.array(RoomPlayerSchema),
    gestures: z.boolean().optional(),
    interactions: z.boolean().optional(),
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
    seat: z.int().nonnegative().nullish(),
  }),
  z.object({ type: z.literal('correction'), x: z.number(), y: z.number() }),
  RoomChatSchema.extend({ type: z.literal('chat') }),
  RoomGestureSchema,
  HighFiveInviteSchema,
  z.object({ type: z.literal('high-five-end'), id: z.string() }),
  HighFiveSchema,
  RoomDiceStateSchema,
  z.object({ type: z.literal('dice-error'), message: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('pong') }),
]);
export type RoomEvent = z.infer<typeof RoomEventSchema>;
export type RoomCommand = z.infer<typeof RoomCommandSchema>;
