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
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import type { AgentSkill } from '@lms/contracts';
import { Icon, IconButton } from '@lms/ui';
import { filter } from 'rxjs';
import {
  AGENT_LAUNCHER_ID,
  AGENT_PANEL_ID,
} from '../../core/assistant/agent-launcher';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import { ConversationsStore } from '../../core/assistant/conversations.store';
import { ConversationList } from '../../shared/assistant/conversation-list/conversation-list';
import { suggestionsFor } from '../../core/assistant/agent-suggestions';
import { BackgroundJobsStore } from '../../core/background/background-jobs.store';
import { CourseJobAccess } from '../../core/course-jobs/course-job-access';
import { AgentComposer } from './components/agent-composer/agent-composer';
import { OwlFace } from '../owl/owl-face/owl-face';
import { AgentMessage } from './components/agent-message/agent-message';

/** The opening questions of a conversation about a lesson. */
const LESSON_SUGGESTIONS: readonly { text: string; skill?: AgentSkill }[] = [
  { text: 'Bài này nói gì?' },
  { text: 'Tóm tắt bài này', skill: 'tom_tat_bai' },
];

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
  imports: [
    AgentComposer,
    AgentMessage,
    ConversationList,
    Icon,
    IconButton,
    OwlFace,
  ],
  host: {
    '[class.chat-widget--beside-toolbar]': 'besideToolbar()',
    '[class.chat-widget--docked]': 'store.isDocked$()',
  },
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
})
export class ChatWidget {
  protected readonly store = inject(AgentChatStore);
  protected readonly history = inject(ConversationsStore);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly background = inject(BackgroundJobsStore);
  private readonly navigated = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );
  private readonly path = computed(() => {
    this.navigated();
    return this.router.url;
  });

  /** Moves the panel left with the owl, off the dev toolbar that is pinned to the same corner. */
  readonly besideToolbar = input(false);

  protected readonly panelId = AGENT_PANEL_ID;
  /** The opening questions follow the page the panel is open on. */
  protected readonly suggestions = computed(() =>
    this.store.lesson$() ? LESSON_SUGGESTIONS : suggestionsFor(this.path()),
  );
  /** Follow-up questions, only under the newest answer once it is finished. */
  protected readonly followUps = computed(() => {
    const last = this.store.turns$().at(-1);
    return last?.reply.status === 'done' && !this.store.isAnswering$()
      ? (last.suggestions ?? [])
      : [];
  });
  /**
   * A follow-up from a turn that read shared content is sent with the Q&A skill: its tools only
   * read, so text planted in a document cannot reach a profile change or a screen through a button.
   */
  protected readonly followUpSkill = computed<AgentSkill | undefined>(() =>
    this.store.turns$().at(-1)?.suggestionsReadOnly ? 'qa_tai_lieu' : undefined,
  );
  /**
   * A course generation that failed, kept here until dismissed: the owl hides while this panel is
   * open, so the panel shows the same notice.
   */
  protected readonly failure = computed(() => {
    const notice = this.background.notice$();
    return notice?.kind === 'course' && !notice.ok ? notice : null;
  });
  protected readonly isEmpty = computed(() => this.store.turns$().length === 0);

  private readonly composer = viewChild(AgentComposer);
  protected readonly canAttach = inject(CourseJobAccess).canGenerate$;
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
    // "Soạn cùng trợ lý" asked for the file picker: offered once the composer shows.
    afterRenderEffect(() => {
      const composer = this.composer();
      if (!composer || !this.store.isPickingSource$()) return;
      untracked(() => {
        this.store.sourcePickOffered();
        composer.pickSource();
      });
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

  protected openFailure(): void {
    const href = this.failure()?.href;
    if (href) void this.router.navigateByUrl(href);
    this.background.dismiss();
  }

  protected dismissFailure(): void {
    this.background.dismiss();
  }

  protected trackScroll(): void {
    const log = this.log()?.nativeElement;
    if (!log) return;
    this.following =
      log.scrollHeight - log.scrollTop - log.clientHeight <= FOLLOW_DISTANCE;
  }

  /** Sends a suggested question as it stands; the list goes away, so the cursor goes to the box. */
  protected suggest(question: string, skill?: AgentSkill): void {
    this.store.ask(question, skill);
    this.composer()?.focus();
  }

  protected retry(turnId: number): void {
    this.store.retry(turnId);
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
