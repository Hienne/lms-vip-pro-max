import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  quizExplainEndpoints,
  type AgentStreamEvent,
  type Citation,
} from '@lms/contracts';
import { Subscription } from 'rxjs';
import { toAppError } from '../../../../../core/errors/app-error';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../../core/network/network.store';
import { SessionStore } from '../../../../../core/session/session.store';

export const EXPLAIN_OFFLINE = 'Mất kết nối — chưa giải thích được câu này.';
export const EXPLAIN_FAILED = 'Chưa giải thích được câu này. Bạn thử lại nhé.';

/** The explanation of one question: streaming, finished or failed. */
export interface QuestionExplanation {
  readonly status: 'working' | 'done' | 'error';
  readonly text: string;
  readonly citations: readonly Citation[];
  readonly error: string | null;
}

const WORKING: QuestionExplanation = {
  status: 'working',
  text: '',
  citations: [],
  error: null,
};

/**
 * "Giải thích" on the questions of a reviewed attempt. The server decides whether the review shows
 * answers and writes the explanation; this store streams it in, one question at a time (a second
 * request waits for the first), and keeps each finished one for the page's lifetime.
 */
@Injectable()
export class QuizExplainStore {
  private readonly client = inject(EndpointClient);
  private readonly network = inject(NetworkStore);
  private readonly session = inject(SessionStore);

  private streaming: Subscription | null = null;

  private readonly state = {
    byQuestion: signal<ReadonlyMap<number, QuestionExplanation>>(new Map()),
    working: signal<number | null>(null),
  };

  /** The assistant is the user's to use; without it the button is not offered. */
  readonly available$ = computed(
    () =>
      this.session.isSignedIn$() &&
      this.session.menus$().includes('AI_ASSISTANT'),
  );
  readonly working$ = this.state.working.asReadonly();
  /** Every explanation asked for so far, by the question's order in the review. */
  readonly all$ = this.state.byQuestion.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.streaming?.unsubscribe());
  }

  of(displayOrder: number): QuestionExplanation | undefined {
    return this.state.byQuestion().get(displayOrder);
  }

  /** Streams the explanation of a question; ignored while another is on its way. */
  explain(attemptId: number, displayOrder: number): void {
    if (this.state.working() !== null) return;
    if (this.network.offline$()) {
      this.set(displayOrder, {
        ...WORKING,
        status: 'error',
        error: EXPLAIN_OFFLINE,
      });
      return;
    }
    this.set(displayOrder, WORKING);
    this.state.working.set(displayOrder);
    this.streaming = this.client
      .stream(quizExplainEndpoints.explain, {
        params: { attemptId, displayOrder },
      })
      .subscribe({
        next: (event) => this.apply(displayOrder, event),
        error: (error: unknown) => {
          const app = toAppError(error);
          this.fail(
            displayOrder,
            app.kind === 'offline' ? EXPLAIN_OFFLINE : app.message,
          );
        },
        complete: () => {
          if (this.of(displayOrder)?.status === 'working') {
            this.fail(displayOrder, EXPLAIN_FAILED);
          }
          this.state.working.set(null);
        },
      });
  }

  private apply(displayOrder: number, event: AgentStreamEvent): void {
    const current = this.of(displayOrder) ?? WORKING;
    switch (event.type) {
      case 'delta':
        this.set(displayOrder, { ...current, text: current.text + event.text });
        break;
      case 'done':
        this.set(displayOrder, {
          status: 'done',
          text: event.answer,
          citations: event.citations,
          error: null,
        });
        break;
      case 'error':
        this.fail(displayOrder, event.message);
        break;
      default:
        break;
    }
  }

  private fail(displayOrder: number, message: string): void {
    this.set(displayOrder, {
      status: 'error',
      text: '',
      citations: [],
      error: message,
    });
    this.state.working.set(null);
  }

  private set(displayOrder: number, value: QuestionExplanation): void {
    this.state.byQuestion.update((all) =>
      new Map(all).set(displayOrder, value),
    );
  }
}
