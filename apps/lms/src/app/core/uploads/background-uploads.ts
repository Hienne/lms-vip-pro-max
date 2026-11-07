import { computed, Injectable, signal } from '@angular/core';

/** Where a background upload stands, as the shell panel needs to say it. */
export type BackgroundUploadState =
  | 'hashing'
  | 'uploading'
  /** No network: it goes on by itself when it is back. */
  | 'waiting'
  | 'processing'
  /** The server did not finish in time. */
  | 'stalled'
  | 'done'
  | 'error';

/** One file on its way in the background. */
export interface BackgroundUpload {
  /** The publisher's own id for the file; handed back to `cancel` and `open`. */
  readonly id: string;
  readonly name: string;
  /** Where it belongs: "Chương 1 · Bài 2", or "Ảnh bìa". */
  readonly place: string;
  /** 0–100. */
  readonly percent: number;
  readonly state: BackgroundUploadState;
  /** What the upload is doing, for the states that need a line of text ("Mất kết nối…"). */
  readonly status?: string;
  /** Whether the author can still stop it. */
  readonly cancellable: boolean;
}

/** What the page that publishes uploads can do with one of them. */
export interface BackgroundUploadActions {
  cancel(id: string): void;
  /** Takes the author to where the file belongs. */
  open(id: string): void;
}

export interface BackgroundUploadSnapshot extends BackgroundUploadActions {
  readonly items: readonly BackgroundUpload[];
  /** The lesson drawer is open: the panel stays out of its way. */
  readonly drawerOpen: boolean;
}

/**
 * The one link between a page that runs uploads in the background (the course editor) and the
 * shell panel that shows them. The page publishes a snapshot of its uploads and the two actions;
 * the shell reads the list and calls the actions, and neither knows the other. The page clears it
 * when it goes away.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundUploads {
  private readonly state = {
    snapshot: signal<BackgroundUploadSnapshot | null>(null),
  };

  readonly items$ = computed(() => this.state.snapshot()?.items ?? []);
  readonly drawerOpen$ = computed(
    () => this.state.snapshot()?.drawerOpen ?? false,
  );

  private setSnapshot(snapshot: BackgroundUploadSnapshot | null): void {
    this.state.snapshot.set(snapshot);
  }

  /** The publishing page replaces what the panel shows. */
  publish(snapshot: BackgroundUploadSnapshot): void {
    this.setSnapshot(snapshot);
  }

  /** The publishing page is gone: nothing is shown. */
  clear(): void {
    this.setSnapshot(null);
  }

  cancel(id: string): void {
    this.state.snapshot()?.cancel(id);
  }

  open(id: string): void {
    this.state.snapshot()?.open(id);
  }
}
