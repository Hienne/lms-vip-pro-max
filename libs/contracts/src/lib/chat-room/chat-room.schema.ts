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

const RoomApproachSchema = z.object({
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(2),
  speed: z.number().positive(),
});
export type RoomApproach = z.infer<typeof RoomApproachSchema>;

export const RoomPlayerSchema = RoomIdentitySchema.extend({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  facing: RoomFacingSchema.optional(),
  seat: z.int().nonnegative().optional(),
  approaching: z.boolean().optional(),
  route: RoomApproachSchema.optional(),
});
export type RoomPlayer = z.infer<typeof RoomPlayerSchema>;

export const ROOM_REACTIONS = [
  { id: 'hello', icon: '👋', label: 'Chào' },
  { id: 'laugh', icon: '😂', label: 'Cười' },
  { id: 'clap', icon: '👏', label: 'Vỗ tay' },
  { id: 'love', icon: '❤️', label: 'Yêu thích' },
  { id: 'celebrate', icon: '🎉', label: 'Ăn mừng' },
  { id: 'surprise', icon: '😮', label: 'Bất ngờ' },
] as const;
const RoomReactionIdSchema = z.enum([
  'hello',
  'laugh',
  'clap',
  'love',
  'celebrate',
  'surprise',
]);
export type RoomReactionId = z.infer<typeof RoomReactionIdSchema>;

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
  caroTables: z
    .array(
      z.object({
        desk: z.int().nonnegative(),
        chairs: z.tuple([z.int().nonnegative(), z.int().nonnegative()]),
      }),
    )
    .optional(),
  playgroundArea: RoomAreaSchema.nullish(),
  presentation: z
    .object({
      board: z.int().nonnegative(),
      desk: z.int().nonnegative(),
      chair: z.int().nonnegative(),
    })
    .optional(),
  boardTables: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(['chess', 'xiangqi']),
        name: z.string(),
        desk: z.int().nonnegative(),
        chairs: z.tuple([z.int().nonnegative(), z.int().nonnegative()]),
      }),
    )
    .default([]),
  boardClock: z
    .object({
      baseMillis: z.int().positive(),
      incrementMillis: z.int().nonnegative(),
    })
    .optional(),
  colorFloor: RoomAreaSchema.nullish(),
  colorTiles: z
    .array(
      z.object({
        color: z.string(),
        label: z.string(),
        symbol: z.string(),
        fill: z.string(),
        area: RoomAreaSchema,
      }),
    )
    .default([]),
  objects: z.array(
    z.object({
      kind: z.enum(['board', 'shelf', 'plant', 'desk', 'chair']),
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
      facing: z.enum(['north', 'south']).nullish(),
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
export const ROOM_MIN_CARO_STAKE = 10;
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
const RoomCaroTableSchema = z.object({
  type: z.literal('caro-table'),
  table: z.int().positive().optional(),
  host: z.boolean().optional(),
  partner: z.string().optional(),
  stake: CaroStakeSchema.optional(),
  playing: z.boolean().optional(),
  paused: z.boolean().optional(),
});
export type RoomCaroTable = z.infer<typeof RoomCaroTableSchema>;
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
  lastCell: z
    .int()
    .min(0)
    .max(CARO_MAX_CELLS - 1)
    .optional(),
  timedOut: z.boolean().optional(),
  timeout: z.enum(['turn', 'away']).optional(),
  waitingForReturn: z.boolean().optional(),
  expiresAt: z.int().positive(),
  serverTime: z.int().positive(),
  result: z.enum(['X', 'O', 'draw']).optional(),
});
export type RoomCaroState = z.infer<typeof RoomCaroStateSchema>;

const RoomSeatCommandSchema = z.object({
  type: z.literal('seat'),
  action: z.enum(['sit', 'stand']),
  chair: z.int().nonnegative().optional(),
  caro: z.literal(true).optional(),
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

const BoardMoveSchema = z.object({
  from: z.int().min(0).max(89),
  to: z.int().min(0).max(89),
  promotion: z.enum(['', 'q', 'r', 'b', 'n']).default(''),
});
const BoardMatchSchema = z.object({
  id: z.uuid(),
  board: z.string().min(64).max(90),
  side: z.int().min(-1).max(1),
  turn: z.int().min(0).max(1),
  version: z.int().nonnegative(),
  players: z.array(z.string()).length(2),
  clocks: z.array(z.number().nonnegative()).length(2),
  serverTime: z.number(),
  check: z.boolean(),
  history: z.array(z.string()),
  legal: z.array(BoardMoveSchema),
  result: z.enum(['playing', 'draw', '0', '1']),
  reason: z.string(),
  drawOffer: z.int().min(-1).max(1),
  mustChange: z.int().min(-1).max(1),
  lastCells: z.array(z.int().nonnegative()),
});
const BoardStateSchema = z.object({
  type: z.literal('board-state'),
  table: z.string(),
  kind: z.enum(['chess', 'xiangqi']),
  name: z.string(),
  points: z.int().min(10),
  seated: z.boolean(),
  ready: z.boolean(),
  players: z.array(z.string()).length(2),
  readyNames: z.array(z.string()),
  baseMillis: z.number().positive(),
  incrementMillis: z.number().nonnegative(),
  match: BoardMatchSchema.optional(),
});
export type RoomBoardState = z.infer<typeof BoardStateSchema>;
export type RoomBoardMove = z.infer<typeof BoardMoveSchema>;
const BoardTablesSchema = z.object({
  type: z.literal('board-tables'),
  tables: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['empty', 'waiting', 'playing']),
      players: z.array(z.string()).length(2),
    }),
  ),
});
export type RoomBoardTables = z.infer<typeof BoardTablesSchema>['tables'];
const ColorFloorStateSchema = z.object({
  type: z.literal('floor-state'),
  id: z.uuid(),
  phase: z.enum(['waiting', 'countdown', 'running', 'finished']),
  round: z.int().min(0).max(5),
  target: z.string(),
  deadline: z.number(),
  serverTime: z.number(),
  players: z.array(z.string()),
  queued: z.int().nonnegative(),
  joined: z.boolean(),
  alive: z.boolean(),
  eliminated: z.boolean(),
  winners: z.array(z.string()),
});
export type RoomColorFloorState = z.infer<typeof ColorFloorStateSchema>;

const MediaSourceSchema = z.enum([
  'idle',
  'video',
  'image',
  'screen',
  'youtube',
]);
const IceServersSchema = z.array(
  z.object({
    urls: z.string(),
    username: z.string().optional(),
    credential: z.string().optional(),
  }),
);
const MediaStateSchema = z.object({
  type: z.literal('media-state'),
  id: z.uuid(),
  controller: z.string(),
  name: z.string(),
  source: MediaSourceSchema,
  title: z.string().max(100),
  videoId: z.string(),
  paused: z.boolean(),
  position: z.number().nonnegative(),
  updatedAt: z.number(),
  serverTime: z.number(),
  iceServers: IceServersSchema,
});
export type RoomMediaState = z.infer<typeof MediaStateSchema>;
const MediaSignalSchema = z.object({
  id: z.uuid(),
  connection: z.uuid(),
  kind: z.enum(['offer', 'answer', 'ice']),
  payload: z.string().max(20000),
});
const VoiceWatchSchema = z.object({ id: z.uuid(), speaker: z.string() });
const VoiceSignalSchema = MediaSignalSchema.omit({ connection: true }).extend({
  speaker: z.string(),
  type: z.literal('voice-signal'),
});

export const RoomCommandSchema = z.discriminatedUnion('type', [
  RoomIdentitySchema.extend({
    type: z.literal('join'),
    roomGames: z.literal(true).optional(),
    gestures: z.literal(true).optional(),
    interactions: z.literal(true).optional(),
    reactions: z.literal(true).optional(),
    boardGames: z.literal(true).optional(),
    floorGame: z.literal(true).optional(),
    presentation: z.literal(true).optional(),
    voice: z.literal(true).optional(),
  }),
  RoomMovementSchema.extend({ type: z.literal('move') }),
  z.object({
    type: z.literal('chat'),
    text: z.string().trim().min(1).max(280),
  }),
  z.object({ type: z.literal('dice-open') }),
  z.object({ type: z.literal('dice-approach') }),
  z.object({ type: z.literal('dice-close') }),
  RoomDiceBetSchema.extend({
    type: z.literal('dice-bet'),
    round: z.int().positive(),
  }),
  z.object({ type: z.literal('wallet-rank') }),
  z.object({
    type: z.literal('caro-stake'),
    stake: CaroStakeSchema.min(ROOM_MIN_CARO_STAKE),
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
  z.object({ type: z.literal('reaction'), reaction: RoomReactionIdSchema }),
  z.object({ type: z.literal('floor-join') }),
  z.object({
    type: z.literal('media-start'),
    id: z.uuid(),
    source: MediaSourceSchema.exclude(['idle']),
    title: z.string().max(100),
    videoId: z.string().optional(),
  }),
  z.object({ type: z.literal('media-stop') }),
  z.object({
    type: z.literal('media-control'),
    id: z.uuid(),
    paused: z.boolean(),
    position: z.number().min(0).max(864000),
  }),
  z.object({
    type: z.literal('media-watch'),
    id: z.uuid(),
    connection: z.uuid(),
  }),
  MediaSignalSchema.extend({ type: z.literal('media-signal'), to: z.string() }),
  z.object({ type: z.literal('voice-talk'), id: z.uuid().nullable() }),
  VoiceWatchSchema.extend({ type: z.literal('voice-watch') }),
  VoiceSignalSchema.extend({ to: z.string() }),
  z.object({ type: z.literal('board-watch'), table: z.string() }),
  z.object({
    type: z.literal('board-ready'),
    table: z.string(),
    points: z.int().min(10).max(ROOM_MAX_STAKE),
  }),
  BoardMoveSchema.extend({
    type: z.literal('board-move'),
    table: z.string(),
    matchId: z.uuid(),
    version: z.int().nonnegative(),
  }),
  z.object({
    type: z.literal('board-action'),
    table: z.string(),
    matchId: z.uuid(),
    version: z.int().nonnegative(),
    action: z.enum(['resign', 'offer-draw', 'accept-draw', 'claim-draw']),
    from: z.int().min(0).max(89).optional(),
    to: z.int().min(0).max(89).optional(),
    promotion: z.enum(['', 'q', 'r', 'b', 'n']).optional(),
  }),
  RoomSeatCommandSchema,
  HighFiveInviteCommandSchema,
  HighFiveReplyCommandSchema,
  z.object({ type: z.literal('ping') }),
]);
export const RoomEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('voice-ready'), iceServers: IceServersSchema }),
  z.object({ type: z.literal('voice-peer'), id: z.uuid(), peer: z.string() }),
  z.object({
    type: z.literal('voice-state'),
    speaker: z.string(),
    name: z.string(),
    id: z.uuid().or(z.literal('')),
  }),
  VoiceSignalSchema.extend({ from: z.string() }),
  MediaStateSchema,
  MediaSignalSchema.extend({
    type: z.literal('media-signal'),
    from: z.string(),
  }),
  z.object({
    type: z.literal('media-peer'),
    id: z.uuid(),
    peer: z.string(),
    connection: z.uuid(),
  }),
  z.object({ type: z.literal('media-error'), message: z.string() }),
  z.object({
    type: z.literal('welcome'),
    id: z.string(),
    players: z.array(RoomPlayerSchema),
    gestures: z.boolean().optional(),
    interactions: z.boolean().optional(),
    history: z.array(RoomChatSchema).max(50).optional(),
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
    route: RoomApproachSchema.optional(),
  }),
  z.object({ type: z.literal('correction'), x: z.number(), y: z.number() }),
  RoomChatSchema.extend({ type: z.literal('chat') }),
  z.object({
    type: z.literal('playground-ready'),
    reactions: z.boolean(),
    boardGames: z.boolean(),
    floorGame: z.boolean(),
  }),
  z.object({
    type: z.literal('reaction'),
    playerId: z.string(),
    reaction: RoomReactionIdSchema,
  }),
  BoardStateSchema,
  BoardTablesSchema,
  ColorFloorStateSchema,
  z.object({ type: z.literal('board-error'), message: z.string() }),
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
  RoomCaroTableSchema,
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
