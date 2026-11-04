import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Icon, Tooltip } from '@lms/ui';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import {
  AGENT_LAUNCHER_ID,
  AGENT_PANEL_ID,
} from '../../core/assistant/agent-launcher';
import { DocumentTrackerStore } from '../../core/knowledge/document-tracker.store';
import { ShellInsets } from '../shell-insets';
import { OwlFace } from './owl-face/owl-face';

/**
 * The owl in the corner of every app page: it chews while the user's uploads are being processed,
 * smiles when one is ready and shows a plain face when one failed. It is also the launcher of the
 * quick assistant: a click opens and closes the panel, and without the assistant function it takes
 * the user to the assistant screen instead. It keeps no state of its own; the tracker owns what
 * is pending and what finished, and the chat store owns whether the panel is open.
 */
@Component({
  selector: 'app-owl',
  imports: [Icon, OwlFace, Tooltip],
  host: {
    '[class.owl--beside-toolbar]': 'besideToolbar()',
    '[class.owl--with-panel]': 'panelOpen()',
    '[style.--owl-inset.px]': 'inset()',
    '(keydown.escape)': 'dismiss()',
  },
  templateUrl: './owl.html',
  styleUrl: './owl.scss',
})
export class Owl {
  private readonly tracker = inject(DocumentTrackerStore);
  private readonly chat = inject(AgentChatStore);
  private readonly router = inject(Router);
  /** Height of a bar pinned to the bottom of the page; the owl rises above it. */
  protected readonly inset = inject(ShellInsets).bottom;

  /** Moves the owl left, off the dev toolbar that is pinned to the same corner. */
  readonly besideToolbar = input(false);
  /**
   * Keeps only the screen-reader announcement: a workspace page (the assistant) docks its
   * composer and panel along the bottom edge where the owl sits, and shows the document status
   * itself.
   */
  readonly quiet = input(false);

  protected readonly state = this.tracker.owlState$;
  protected readonly finished = computed(
    () => this.tracker.lastFinished$()?.document ?? null,
  );
  protected readonly pendingCount = computed(
    () => this.tracker.pending$().length,
  );

  protected readonly launcherId = AGENT_LAUNCHER_ID;
  protected readonly panelId = AGENT_PANEL_ID;
  protected readonly available = this.chat.available$;
  protected readonly panelOpen = computed(
    () => this.available() && this.chat.isOpen$(),
  );

  private readonly processing = computed(() =>
    this.state() === 'processing'
      ? `đang xử lý ${this.pendingCount()} tài liệu`
      : null,
  );
  protected readonly label = computed(() => {
    const processing = this.processing();
    if (!this.available())
      return processing ? `Trợ lý AI: ${processing}` : 'Trợ lý AI';
    const action = this.panelOpen() ? 'Đóng Trợ lý nhanh' : 'Mở Trợ lý nhanh';
    return processing ? `${action}, ${processing}` : action;
  });
  /** The same words as the label; the panel being open says it all, so no tooltip then. */
  protected readonly tip = computed(() => {
    if (this.panelOpen()) return '';
    const processing = this.processing();
    if (!this.available())
      return processing
        ? `Đang xử lý ${this.pendingCount()} tài liệu`
        : 'Trợ lý AI';
    return this.label();
  });

  /** What a screen reader hears when the state changes; it names no count, so it speaks once. */
  protected readonly announcement = computed(() => {
    const document = this.finished();
    if (this.state() === 'processing') return 'Đang xử lý tài liệu.';
    if (!document) return '';
    return this.state() === 'done'
      ? `Đã xử lý xong tài liệu ${document.fileName}.`
      : `Không xử lý được tài liệu ${document.fileName}.`;
  });

  /** The owl button: the panel for a user who has the assistant, the assistant screen otherwise. */
  protected activate(): void {
    if (this.available()) this.chat.toggle();
    else this.open();
  }

  protected open(): void {
    void this.router.navigateByUrl('/assistant');
    this.dismiss();
  }

  protected dismiss(): void {
    this.tracker.dismiss();
  }
}
