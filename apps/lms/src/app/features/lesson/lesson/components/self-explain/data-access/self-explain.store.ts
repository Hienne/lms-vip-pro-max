import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
} from '@angular/core';
import {
  LESSON_TEXT_UNAVAILABLE_CODE,
  SELF_EXPLAIN_MAX_LENGTH,
  SELF_EXPLAIN_MIN_LENGTH,
  selfExplainEndpoints,
  type AgentStreamEvent,
  type Citation,
} from '@lms/contracts';
import { Subscription } from 'rxjs';
import { toAppError } from '../../../../../../core/errors/app-error';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../../../core/network/network.store';
import { SessionStore } from '../../../../../../core/session/session.store';
import { LessonStore } from '../../../data-access/lesson.store';

export const SELF_EXPLAIN_OFFLINE = 'Mất kết nối — chưa nhận xét được.';
export const SELF_EXPLAIN_FAILED =
  'Chưa nhận xét được lần này. Bạn thử lại nhé.';
export const SELF_EXPLAIN_NO_TEXT =
  'Bài học này chưa có nội dung để đối chiếu nên chưa dùng được tính năng này.';

/** Where the learner is: writing, waiting for the feedback, reading it, or told it failed. */
export type SelfExplainPhase = 'writing' | 'working' | 'done' | 'error';

/**
 * "Giải thích lại bằng lời của bạn": the learner's own summary of the lesson and the assistant's
 * three-section comparison with the lesson text. The server decides what the feedback says; this
 * store keeps the draft, streams the answer in, and hands the learner's text (never the feedback) to
 * the lesson's notes.
 */
@Injectable()
export class SelfExplainStore {
  private readonly client = inject(EndpointClient);
  private readonly network = inject(NetworkStore);
  private readonly session = inject(SessionStore);
  private readonly lesson = inject(LessonStore);

  private streaming: Subscription | null = null;

  private readonly state = {
    text: linkedSignal<number | undefined, string>({
      source: () => this.lesson.lessonId$(),
      computation: () => '',
    }),
    phase: linkedSignal<number | undefined, SelfExplainPhase>({
      source: () => this.lesson.lessonId$(),
      computation: () => 'writing',
    }),
    answer: linkedSignal<number | undefined, string>({
      source: () => this.lesson.lessonId$(),
      computation: () => '',
    }),
    citations: linkedSignal<number | undefined, readonly Citation[]>({
      source: () => this.lesson.lessonId$(),
      computation: () => [],
    }),
    error: linkedSignal<number | undefined, string | null>({
      source: () => this.lesson.lessonId$(),
      computation: () => null,
    }),
    /** The server said the lesson has no text; asking again would get the same answer. */
    noText: linkedSignal<number | undefined, boolean>({
      source: () => this.lesson.lessonId$(),
      computation: () => false,
    }),
  };

  readonly minLength = SELF_EXPLAIN_MIN_LENGTH;
  readonly maxLength = SELF_EXPLAIN_MAX_LENGTH;

  // Selectors
  /** The assistant is the user's to use; without it the feature is not offered. */
  readonly available$ = computed(
    () =>
      this.session.isSignedIn$() &&
      this.session.menus$().includes('AI_ASSISTANT'),
  );
  readonly text$ = this.state.text.asReadonly();
  readonly phase$ = this.state.phase.asReadonly();
  readonly answer$ = this.state.answer.asReadonly();
  readonly citations$ = this.state.citations.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly noText$ = this.state.noText.asReadonly();
  readonly noteSaving$ = this.lesson.noteSaving$;

  /** What the server counts: the text after trimming. */
  readonly length$ = computed(() => this.text$().trim().length);
  readonly lengthOk$ = computed(
    () =>
      this.length$() >= SELF_EXPLAIN_MIN_LENGTH &&
      this.length$() <= SELF_EXPLAIN_MAX_LENGTH,
  );
  readonly canSend$ = computed(
    () => this.phase$() !== 'working' && this.lengthOk$() && !this.noText$(),
  );
  readonly canSave$ = computed(() => this.lengthOk$() && !this.noteSaving$());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.streaming?.unsubscribe());
  }

  // Setters: the only writers of state
  setText(text: string): void {
    this.state.text.set(text);
  }

  // Commands
  /** "Gửi để nhận xét". */
  send(): void {
    const lessonId = this.lesson.lessonId$();
    if (lessonId === undefined || !this.canSend$()) return;
    if (this.network.offline$()) {
      this.fail(SELF_EXPLAIN_OFFLINE);
      return;
    }
    this.streaming?.unsubscribe();
    this.state.phase.set('working');
    this.state.answer.set('');
    this.state.citations.set([]);
    this.state.error.set(null);
    this.streaming = this.client
      .stream(selfExplainEndpoints.selfExplain, {
        params: { lessonId },
        body: { text: this.text$().trim() },
      })
      .subscribe({
        next: (event) => this.apply(event),
        error: (error: unknown) => {
          const app = toAppError(error);
          if (app.messageCode === LESSON_TEXT_UNAVAILABLE_CODE) {
            this.state.noText.set(true);
            this.fail(SELF_EXPLAIN_NO_TEXT);
          } else {
            this.fail(
              app.kind === 'offline' ? SELF_EXPLAIN_OFFLINE : app.message,
            );
          }
        },
        complete: () => {
          if (this.phase$() === 'working') this.fail(SELF_EXPLAIN_FAILED);
        },
      });
  }

  /** "Viết lại": back to the draft, which is kept. */
  rewrite(): void {
    this.streaming?.unsubscribe();
    this.state.phase.set('writing');
    this.state.answer.set('');
    this.state.citations.set([]);
    this.state.error.set(null);
  }

  /** "Lưu vào ghi chú": the learner's text goes to the lesson's notes; the feedback does not. */
  saveToNotes(): void {
    if (!this.canSave$()) return;
    this.lesson.saveLessonNote(this.text$().trim());
  }

  private apply(event: AgentStreamEvent): void {
    switch (event.type) {
      case 'delta':
        this.state.answer.update((text) => text + event.text);
        break;
      case 'done':
        this.state.answer.set(event.answer);
        this.state.citations.set(event.citations);
        this.state.phase.set('done');
        break;
      case 'error':
        this.fail(event.message);
        break;
      default:
        break;
    }
  }

  private fail(message: string): void {
    this.state.error.set(message);
    this.state.phase.set('error');
  }
}
