import type { RoomChat, RoomPlayer } from '@lms/contracts';

export interface RoomSpeech extends RoomChat {
  readonly expiresAt: number;
}
export type RoomViewMode = '3d' | '2d';

/** Immutable input of the non-Angular game renderer. World coordinates are pixels, not CSS sizes. */
export interface RoomCanvasState {
  readonly online: boolean;
  readonly me: string;
  readonly players: readonly RoomPlayer[];
  readonly chatting: boolean;
  readonly speech: Readonly<Record<string, RoomSpeech>>;
  readonly correction: { readonly x: number; readonly y: number } | null;
}
