import type { RoomChat, RoomPlayer } from '@lms/contracts';

/** Immutable input of the non-Angular game renderer. World coordinates are pixels, not CSS sizes. */
export interface RoomCanvasState {
  readonly online: boolean;
  readonly me: string;
  readonly players: readonly RoomPlayer[];
  readonly lastChat: RoomChat | null;
  readonly correction: { readonly x: number; readonly y: number } | null;
}
