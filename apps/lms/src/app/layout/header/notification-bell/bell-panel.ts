import { Component, computed, inject, output } from '@angular/core';
import { feedbackEndpoints, type LearningReminder } from '@lms/contracts';
import { RouterLink } from '@angular/router';
import { FmtRelativePipe, Skeleton } from '@lms/ui';
import { catchError, map, of } from 'rxjs';
import { serverData } from '../../../core/data-access/server-data';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { dueReminders } from '../../../core/learning/due-reminders';
import { SessionStore } from '../../../core/session/session.store';

const SHOWN = 3;

/**
 * What the bell's dropdown lists: the first few due reminders and unanswered questions, read when
 * it opens. A refusal or a failure is an empty section: the dropdown has no error state, and the
 * full page says what went wrong.
 */
@Component({
  selector: 'app-bell-panel',
  imports: [FmtRelativePipe, RouterLink, Skeleton],
  templateUrl: './bell-panel.html',
  styleUrl: './bell-panel.scss',
})
export class BellPanel {
  readonly navigated = output<void>();

  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);

  private readonly canLearn = computed(() =>
    this.session.menus$().includes('COURSE_LEARNING'),
  );
  private readonly canManage = computed(() =>
    this.session.menus$().includes('COURSE_MANAGEMENT'),
  );

  private readonly reminders = serverData(
    (_: { readonly learner: true }) =>
      dueReminders(this.client).pipe(
        catchError(() => of([] as LearningReminder[])),
      ),
    {
      params: () => (this.canLearn() ? { learner: true as const } : undefined),
    },
  );

  private readonly questions = serverData(
    (_: { readonly manager: true }) =>
      this.client
        .call(feedbackEndpoints.instructorFeedback, {
          query: { status: 'new', page: 0, size: SHOWN },
        })
        .pipe(
          map((page) => ({ items: page.items, total: page.totalElements })),
          catchError(() => of({ items: [], total: 0 })),
        ),
    {
      params: () => (this.canManage() ? { manager: true as const } : undefined),
    },
  );

  protected readonly dueReminders$ = computed(() =>
    (this.reminders.value() ?? []).slice(0, SHOWN),
  );
  protected readonly dueTotal$ = computed(
    () => this.reminders.value()?.length ?? 0,
  );
  protected readonly questions$ = computed(
    () => this.questions.value()?.items ?? [],
  );
  protected readonly questionTotal$ = computed(
    () => this.questions.value()?.total ?? 0,
  );

  protected readonly showReminders = this.canLearn;
  protected readonly showQuestions = this.canManage;
  protected readonly isLoading$ = computed(
    () =>
      (this.canLearn() && this.reminders.isLoading()) ||
      (this.canManage() && this.questions.isLoading()),
  );
  protected readonly isEmpty$ = computed(
    () =>
      !this.isLoading$() &&
      this.dueTotal$() === 0 &&
      this.questionTotal$() === 0,
  );
}
