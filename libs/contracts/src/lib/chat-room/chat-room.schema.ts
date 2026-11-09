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
  approaching: z.boolean().optional(),
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
const RoomDiceSideSchema = z.enum(['lower', 'upper']);
export type RoomDiceSide = z.infer<typeof RoomDiceSideSchema>;
export const ROOM_MAX_STAKE = 1_000_000;
const RoomDiceBetSchema = z.object({
  side: RoomDiceSideSchema,
  stake: z.int().positive().max(ROOM_MAX_STAKE),
});
export type RoomDiceBet = z.infer<typeof RoomDiceBetSchema>;
const DiceFaceSchema = z.int().min(1).max(6);
const RoomDiceResultSchema = z.object({
  round: z.int().positive(),
  dice: z.tuple([DiceFaceSchema, DiceFaceSchema, DiceFaceSchema]),
  total: z.int().min(3).max(18),
  outcome: z.enum(['lower', 'upper', 'triple']),
});
export type RoomDiceResult = z.infer<typeof RoomDiceResultSchema>;
const RoomDiceStateSchema = z.object({
  type: z.literal('dice-state'),
  round: z.int().positive(),
  closesAt: z.int().positive(),
  serverTime: z.int().positive(),
  history: z.array(RoomDiceResultSchema).max(12),
  bet: RoomDiceBetSchema.optional(),
  lastBet: RoomDiceBetSchema.optional(),
});
export type RoomDiceState = z.infer<typeof RoomDiceStateSchema>;

const RoomRankSchema = z.object({
  name: z.string(),
  balance: z.int().nonnegative(),
});
export type RoomRank = z.infer<typeof RoomRankSchema>;
const CaroPieceSchema = z.enum(['X', 'O']);
const CaroStakeSchema = z.int().min(0).max(ROOM_MAX_STAKE);
export const ROOM_CARO_BOARD_SIZE = 50;
const CARO_MAX_CELLS = ROOM_CARO_BOARD_SIZE ** 2;
const RoomCaroInvitationSchema = z.object({
  type: z.literal('caro-invite'),
  id: z.string(),
  from: z.string(),
  fromName: z.string(),
  to: z.string(),
  toName: z.string(),
  stake: CaroStakeSchema,
});
export type RoomCaroInvitation = z.infer<typeof RoomCaroInvitationSchema>;
const RoomCaroStateSchema = z.object({
  type: z.literal('caro-state'),
  id: z.uuid(),
  xName: z.string(),
  oName: z.string(),
  piece: CaroPieceSchema,
  stake: CaroStakeSchema,
  board: z
    .string()
    .length(CARO_MAX_CELLS)
    .refine((board) => !/[^.XO]/.test(board)),
  moves: z.int().min(0).max(CARO_MAX_CELLS),
  expiresAt: z.int().positive(),
  serverTime: z.int().positive(),
  result: z.enum(['X', 'O', 'draw']).optional(),
});
export type RoomCaroState = z.infer<typeof RoomCaroStateSchema>;

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
    roomGames: z.literal(true).optional(),
    gestures: z.literal(true).optional(),
    interactions: z.literal(true).optional(),
  }),
  RoomMovementSchema.extend({ type: z.literal('move') }),
  z.object({
    type: z.literal('chat'),
    text: z.string().trim().min(1).max(280),
  }),
  z.object({ type: z.literal('dice-open') }),
  z.object({ type: z.literal('dice-close') }),
  RoomDiceBetSchema.extend({
    type: z.literal('dice-bet'),
    round: z.int().positive(),
  }),
  z.object({ type: z.literal('wallet-rank') }),
  z.object({
    type: z.literal('caro-invite'),
    target: z.string(),
    stake: CaroStakeSchema,
  }),
  z.object({
    type: z.literal('caro-reply'),
    inviteId: z.string(),
    accept: z.boolean(),
  }),
  z.object({
    type: z.literal('caro-move'),
    gameId: z.uuid(),
    move: z
      .int()
      .min(0)
      .max(CARO_MAX_CELLS - 1),
    cell: z
      .int()
      .min(0)
      .max(CARO_MAX_CELLS - 1),
  }),
  z.object({ type: z.literal('approach-cancel') }),
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
    approaching: z.boolean().optional(),
  }),
  z.object({ type: z.literal('correction'), x: z.number(), y: z.number() }),
  RoomChatSchema.extend({ type: z.literal('chat') }),
  RoomGestureSchema,
  HighFiveInviteSchema,
  z.object({ type: z.literal('high-five-end'), id: z.string() }),
  HighFiveSchema,
  RoomDiceStateSchema,
  z.object({ type: z.literal('wallet'), balance: z.int().nonnegative() }),
  z.object({
    type: z.literal('wallet-rank'),
    ranks: z.array(RoomRankSchema).max(10),
  }),
  RoomCaroInvitationSchema,
  z.object({ type: z.literal('caro-invite-end'), id: z.string() }),
  RoomCaroStateSchema,
  z.object({ type: z.literal('caro-error'), message: z.string() }),
  z.object({ type: z.literal('dice-error'), message: z.string() }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    scope: z.literal('games').optional(),
  }),
  z.object({ type: z.literal('pong') }),
]);
export type RoomEvent = z.infer<typeof RoomEventSchema>;
export type RoomCommand = z.infer<typeof RoomCommandSchema>;
