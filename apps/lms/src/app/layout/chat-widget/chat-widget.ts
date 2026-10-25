import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { Icon, IconButton } from '@lms/ui';
import {
  AGENT_LAUNCHER_ID,
  AGENT_PANEL_ID,
} from '../../core/assistant/agent-launcher';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import { AgentComposer } from './components/agent-composer/agent-composer';
import { OwlFace } from '../owl/owl-face/owl-face';
import { AgentMessage } from './components/agent-message/agent-message';

/** One question for each thing the assistant does: documents, screens, the profile. */
export const SUGGESTIONS = [
  'Quy trình EOD gồm những bước nào?',
  'Mở trang Hồ sơ cá nhân',
  'Đổi chức danh của tôi',
] as const;

/** How close to the end of the log counts as "following" the newest message, in pixels. */
const FOLLOW_DISTANCE = 48;

/**
 * "Trợ lý nhanh": the panel in the owl's corner on every app page (the owl steps aside while it is
 * open), a full-screen sheet on a phone, and docked to the right edge on a wide screen when the
 * user asks. It is a non-modal dialog (the page
 * stays usable beside it), opens with the cursor in the message box, and `Escape` or the close
 * button hands focus back to the owl. The store owns the conversation; the panel only shows it.
 */
@Component({
  selector: 'app-chat-widget',
  imports: [AgentComposer, AgentMessage, Icon, IconButton, OwlFace],
  host: {
    '[class.chat-widget--beside-toolbar]': 'besideToolbar()',
    '[class.chat-widget--docked]': 'store.isDocked$()',
  },
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
})
export class ChatWidget {
  protected readonly store = inject(AgentChatStore);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Moves the panel left with the owl, off the dev toolbar that is pinned to the same corner. */
  readonly besideToolbar = input(false);

  protected readonly panelId = AGENT_PANEL_ID;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly isEmpty = computed(() => this.store.turns$().length === 0);

  private readonly composer = viewChild(AgentComposer);
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  /** Whether the user is at the end of the log, so streamed text keeps it in view. */
  private following = true;

  /** Changes whenever the log grows: a new turn, a new piece of text, a new state. */
  private readonly growth = computed(() => {
    const last = this.store.turns$().at(-1);
    return `${last?.id}:${last?.reply.status}:${last?.reply.text.length}:${last?.reply.action?.status}`;
  });

  constructor() {
    // The composer exists only while the panel is open, so this runs once per opening.
    afterRenderEffect(() => {
      const composer = this.composer();
      if (composer) untracked(() => composer.focus());
    });
    // Every opening starts at the newest message, whatever the last opening ended on.
    afterRenderEffect(() => {
      const log = this.log()?.nativeElement;
      if (!log) return;
      this.following = true;
      log.scrollTop = log.scrollHeight;
    });
    afterRenderEffect(() => {
      this.growth();
      const log = untracked(() => this.log())?.nativeElement;
      if (log && this.following) log.scrollTop = log.scrollHeight;
    });
  }

  protected trackScroll(): void {
    const log = this.log()?.nativeElement;
    if (!log) return;
    this.following =
      log.scrollHeight - log.scrollTop - log.clientHeight <= FOLLOW_DISTANCE;
  }

  /** Sends a suggested question as it stands; the list goes away, so the cursor goes to the box. */
  protected suggest(question: string): void {
    this.store.ask(question);
    this.composer()?.focus();
  }

  protected confirm(turnId: number): void {
    this.store.confirm(turnId);
    this.composer()?.focus();
  }

  protected cancel(turnId: number): void {
    this.store.cancel(turnId);
    this.composer()?.focus();
  }

  /**
   * Closes the panel and puts focus back on the owl that opened it, once the owl shows again (it
   * hides behind the phone sheet and the docked panel).
   */
  protected dismiss(): void {
    this.store.close();
    afterNextRender(
      () => this.document.getElementById(AGENT_LAUNCHER_ID)?.focus(),
      { injector: this.injector },
    );
  }
}
