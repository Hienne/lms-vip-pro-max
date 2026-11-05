import { computed, inject, Injectable, signal } from '@angular/core';
import { programAssessmentEndpoints, type QuizSummary } from '@lms/contracts';
import { invalidation } from '../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { CourseEditorStore } from '../../../data-access/course-editor.store';

/**
 * Step 3's final exam: the course's `FINAL_EXAM` quiz and how many active questions the program's
 * bank holds for it. A quiz the quiz screen made as `FIXED` is the author's own selection, so the
 * wizard only shows it.
 */
@Injectable()
export class CourseExamStore {
  private readonly client = inject(EndpointClient);
  private readonly editor = inject(CourseEditorStore);

  private readonly state = {
    /** The short exam form (create or edit) is open. */
    formOpen: signal(false),
  };

  private readonly bankChanges = invalidation();

  /** Only the count is needed, so one row is asked for. */
  private readonly bankData = serverData(
    (query: { programId: number; courseId: number }) =>
      this.client.call(programAssessmentEndpoints.questions, {
        query: { ...query, status: 'ACTIVE', page: 0, size: 1 },
      }),
    {
      params: () => {
        const course = this.editor.course$();
        const programId = this.editor.storedProgram$()?.id;
        return course && programId
          ? { programId, courseId: course.course.id }
          : undefined;
      },
      reloadOn: this.bankChanges,
    },
  );

  readonly exam$ = computed((): QuizSummary | undefined =>
    this.editor.quizzes$().find((quiz) => quiz.quizType === 'FINAL_EXAM'),
  );
  /** The wizard writes the pool of every exam but a `FIXED` one. */
  readonly isWizardManaged$ = computed(
    () => this.exam$()?.selectionMode !== 'FIXED',
  );
  readonly programName$ = computed(() => this.editor.storedProgram$()?.name);
  readonly activeBank$ = computed(() => this.bankData.value()?.totalElements);
  readonly isBankLoading$ = this.bankData.isLoading;
  readonly bankError$ = this.bankData.error;
  readonly quizzesError$ = this.editor.quizzesError$;

  readonly formOpen$ = this.state.formOpen.asReadonly();

  private setFormOpen(open: boolean): void {
    this.state.formOpen.set(open);
  }

  openForm(): void {
    this.setFormOpen(true);
  }

  closeForm(): void {
    this.setFormOpen(false);
  }

  retryBank(): void {
    this.bankData.reload();
  }

  retryQuizzes(): void {
    this.editor.reloadQuizzes();
  }
}
