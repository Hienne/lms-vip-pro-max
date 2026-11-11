import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Icon, Tooltip } from '@lms/ui';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import {
  AGENT_LAUNCHER_ID,
  AGENT_PANEL_ID,
} from '../../core/assistant/agent-launcher';
import { BackgroundJobsStore } from '../../core/background/background-jobs.store';
import { ShellInsets } from '../shell-insets';
import { OwlFace } from './owl-face/owl-face';

const capitalised = (text: string): string =>
  text.charAt(0).toLocaleUpperCase('vi') + text.slice(1);

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
  private readonly jobs = inject(BackgroundJobsStore);
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

  protected readonly state = this.jobs.state$;
  protected readonly notice = this.jobs.notice$;

  protected readonly launcherId = AGENT_LAUNCHER_ID;
  protected readonly panelId = AGENT_PANEL_ID;
  protected readonly available = this.chat.available$;
  protected readonly panelOpen = computed(
    () => this.available() && this.chat.isOpen$(),
  );

  private readonly processing = computed(() => this.jobs.pendingText$());
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
      return processing ? capitalised(processing) : 'Trợ lý AI';
    return this.label();
  });

  /** What a screen reader hears when the state changes. */
  protected readonly announcement = this.jobs.announcement$;

  /** The owl button: the panel for a user who has the assistant, the assistant screen otherwise. */
  protected activate(): void {
    if (this.available()) this.chat.toggle();
    else this.open();
  }

  /** Follows the notice's link: the course review screen, or the assistant for a document. */
  protected open(): void {
    void this.router.navigateByUrl(this.notice()?.href ?? '/assistant');
    this.dismiss();
  }

  protected dismiss(): void {
    this.jobs.dismiss();
  }
}
