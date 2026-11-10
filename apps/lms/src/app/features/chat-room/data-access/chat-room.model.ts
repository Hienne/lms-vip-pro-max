import type {
  RoomArea,
  RoomChat,
  RoomDiceResult,
  RoomGesture,
  RoomHighFive,
  RoomPlayer,
} from '@lms/contracts';

export function inRoomArea(
  area: RoomArea | null | undefined,
  x: number,
  y: number,
): boolean {
  return (
    !!area &&
    x >= area.x &&
    x <= area.x + area.w &&
    y >= area.y &&
    y <= area.y + area.h
  );
}

export interface RoomSpeech extends RoomChat {
  readonly expiresAt: number;
}
export type TimedRoomGesture = (
  | RoomGesture
  | {
      kind: 'high-five';
      origin: RoomHighFive['from'];
      partner: RoomHighFive['to'];
      leading: boolean;
    }
) & { readonly startedAt: number };

export interface RoomInvitationView {
  readonly id: string;
  readonly name: string;
  readonly incoming: boolean;
}

/** Immutable input of the non-Angular game renderer. World coordinates are pixels, not CSS sizes. */
export interface RoomCanvasState {
  readonly online: boolean;
  readonly me: string;
  readonly players: readonly RoomPlayer[];
  readonly chatting: boolean;
  readonly dice?: RoomDiceResult;
  readonly speech: Readonly<Record<string, RoomSpeech>>;
  readonly gestures: Readonly<Record<string, TimedRoomGesture>>;
  readonly correction: { readonly x: number; readonly y: number } | null;
}
