import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { AgentChatStore } from '../../../core/assistant/agent-chat.store';
import {
  BackgroundUploads,
  type BackgroundUpload,
} from '../../../core/uploads/background-uploads';

/** How many uploads the panel lists before "Xem tất cả". */
export const PANEL_ROWS = 3;
/** How long a finished upload shows ✓ before it leaves. */
export const DONE_VISIBLE_MS = 4000;

/**
 * What the upload panel in the owl's corner shows: the registry's uploads, three at a time unless
 * expanded, a finished one for a few seconds, and the panel itself open or minimised. It
 * minimises itself when the chat panel opens, and stays so until the author opens it again.
 */
@Injectable()
export class UploadPanelStore {
  private readonly registry = inject(BackgroundUploads);
  private readonly chat = inject(AgentChatStore);

  private readonly state = {
    expanded: signal(false),
    minimised: linkedSignal<boolean, boolean>({
      source: () => this.chat.isOpen$(),
      computation: (chatOpen, previous) =>
        chatOpen || (previous?.value ?? false),
    }),
    /** Finished uploads whose ✓ has been shown long enough. */
    gone: signal<ReadonlySet<string>>(new Set()),
  };

  /** The timers that take a finished upload off the list, by upload id. */
  private readonly expiries = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Starts a timer for each upload that has just finished. The effect is the boundary between the
   * registry's list and real time, one concern, one trigger; the timers belong to the store and
   * are cleared with it (an effect cleanup would clear them at every run).
   */
  private readonly expireFinished = effect(() => {
    const items = this.registry.items$();
    untracked(() => this.trackFinished(items));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      this.expiries.forEach((timer) => clearTimeout(timer)),
    );
  }

  readonly chatOpen$ = computed(() => this.chat.isOpen$());
  readonly expanded$ = this.state.expanded.asReadonly();
  readonly minimised$ = this.state.minimised.asReadonly();

  /** Every upload still worth showing. */
  readonly items$ = computed((): readonly BackgroundUpload[] =>
    this.registry.items$().filter((item) => !this.state.gone().has(item.id)),
  );
  /** The panel is up while there is something to show and the lesson drawer is shut. */
  readonly shown$ = computed(
    () => this.items$().length > 0 && !this.registry.drawerOpen$(),
  );
  readonly rows$ = computed(() =>
    this.state.expanded() ? this.items$() : this.items$().slice(0, PANEL_ROWS),
  );
  readonly canExpand$ = computed(() => this.items$().length > PANEL_ROWS);
  /** Uploads not finished yet: the number in the header. */
  readonly running$ = computed(
    () => this.items$().filter((item) => item.state !== 'done').length,
  );
  /** The mean progress of the uploads on their way, shown while minimised. */
  readonly overall$ = computed(() => {
    const running = this.items$().filter((item) => item.state !== 'done');
    return running.length
      ? Math.round(
          running.reduce((sum, item) => sum + item.percent, 0) / running.length,
        )
      : 100;
  });

  private setExpanded(expanded: boolean): void {
    this.state.expanded.set(expanded);
  }

  private setMinimised(minimised: boolean): void {
    this.state.minimised.set(minimised);
  }

  private setGone(gone: ReadonlySet<string>): void {
    this.state.gone.set(gone);
  }

  toggleExpanded(): void {
    this.setExpanded(!this.state.expanded());
  }

  toggleMinimised(): void {
    this.setMinimised(!this.state.minimised());
  }

  cancel(id: string): void {
    this.registry.cancel(id);
  }

  open(id: string): void {
    this.registry.open(id);
  }

  private trackFinished(items: readonly BackgroundUpload[]): void {
    const finished = new Set(
      items.filter((item) => item.state === 'done').map((item) => item.id),
    );
    // An upload that started again, or left, is no longer a finished one.
    for (const [id, timer] of this.expiries) {
      if (finished.has(id)) continue;
      clearTimeout(timer);
      this.expiries.delete(id);
    }
    const gone = this.state.gone();
    const stillGone = [...gone].filter((id) => finished.has(id));
    if (stillGone.length !== gone.size) this.setGone(new Set(stillGone));
    for (const id of finished) {
      if (this.expiries.has(id) || this.state.gone().has(id)) continue;
      this.expiries.set(
        id,
        setTimeout(() => {
          this.expiries.delete(id);
          this.setGone(new Set([...this.state.gone(), id]));
        }, DONE_VISIBLE_MS),
      );
    }
  }
}
