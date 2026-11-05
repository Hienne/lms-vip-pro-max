import { computed, inject, Injectable, signal } from '@angular/core';
import {
  assessmentV1Endpoints,
  programAssessmentEndpoints,
  type QuizDetailV1,
  type QuizSummary,
} from '@lms/contracts';
import { catchError, switchMap, tap, throwError, type Observable } from 'rxjs';
import { invalidation } from '../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../../../core/session/session.store';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { CourseEditorStore } from '../../../data-access/course-editor.store';
import { syncExamPool } from './exam-pool';
import {
  POOL_LIMIT,
  toExamValue,
  toNewQuizRequest,
  toUpdatedQuizRequest,
  type ExamFormValue,
} from './course-exam.model';

/**
 * Step 3's final exam: the course's `FINAL_EXAM` quiz and how many active questions the program's
 * bank holds for it. A quiz the quiz screen made as `FIXED` is the author's own selection, so the
 * wizard only shows it.
 */
@Injectable()
export class CourseExamStore {
  private readonly client = inject(EndpointClient);
  private readonly editor = inject(CourseEditorStore);
  private readonly session = inject(SessionStore);

  private readonly state = {
    /** The short exam form (create or edit) is open. */
    formOpen: signal(false),
    /** A new exam whose pool could not be written: it waits for "Thử lại". */
    poolPendingId: signal<number | null>(null),
    /** The "Nhập từ Excel" drawer is open. */
    importOpen: signal(false),
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

  /**
   * Creates the exam, puts it on the draft, then fills its pool. A refusal of the pool write keeps
   * the exam and remembers it, so only the pool is tried again.
   */
  private readonly createMutation = serverMutation(
    (input: { courseId: number; value: ExamFormValue }) =>
      this.client
        .call(assessmentV1Endpoints.createQuiz, {
          body: toNewQuizRequest(input.courseId, input.value),
        })
        .pipe(
          tap((created) => {
            this.setPoolPendingId(created.quiz.id);
            this.setFormOpen(false);
            this.editor.attachExam(created.quiz.id);
          }),
          switchMap((created) => this.syncPool(created.quiz.id)),
        ),
    {
      errors: 'alert',
      success: () => 'Đã lưu bài thi cuối khóa',
      onSuccess: () => this.poolWritten(),
    },
  );

  /** The exam as stored, read while the form edits it (its version and untouched settings). */
  private readonly detailData = serverData(
    (quizId: number) =>
      this.client.call(assessmentV1Endpoints.quiz, { params: { id: quizId } }),
    {
      params: () => {
        const exam = this.exam$();
        return this.state.formOpen() && exam && this.isWizardManaged$()
          ? exam.id
          : undefined;
      },
    },
  );

  /**
   * Saves the form's values over the stored exam, then rewrites its pool. A refused version reads
   * the exam again, so the next try carries the version the server holds.
   */
  private readonly updateMutation = serverMutation(
    (input: { detail: QuizDetailV1; value: ExamFormValue }) =>
      this.client
        .call(assessmentV1Endpoints.updateQuiz, {
          params: { id: input.detail.quiz.id },
          query: { expectedVersion: input.detail.quiz.rowVersion },
          body: toUpdatedQuizRequest(input.detail, input.value),
        })
        .pipe(
          switchMap(() => this.syncPool(input.detail.quiz.id)),
          catchError((error: unknown) => {
            this.detailData.reload();
            return throwError(() => error);
          }),
        ),
    {
      errors: 'alert',
      success: () => 'Đã lưu bài thi cuối khóa',
      onSuccess: () => {
        this.setFormOpen(false);
        this.editor.reloadQuizzes();
      },
    },
  );

  /** After an import the questions are in the bank: a wizard-managed exam takes them in too. */
  private readonly resyncMutation = serverMutation(
    (quizId: number) => this.syncPool(quizId),
    {
      errors: 'toast',
      onSuccess: () => this.editor.reloadQuizzes(),
    },
  );

  private readonly retryPoolMutation = serverMutation(
    (quizId: number) => this.syncPool(quizId),
    {
      errors: 'alert',
      success: () => 'Đã cập nhật câu hỏi của bài thi',
      onSuccess: () => this.poolWritten(),
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
  /** More active questions than a pool takes: the newest ones are used. */
  readonly isBankCapped$ = computed(
    () => (this.activeBank$() ?? 0) > POOL_LIMIT,
  );
  readonly poolLimit = POOL_LIMIT;
  readonly isSaving$ = computed(
    () =>
      this.createMutation.isPending() ||
      this.updateMutation.isPending() ||
      this.retryPoolMutation.isPending(),
  );
  readonly saveError$ = computed(
    () =>
      this.createMutation.error() ??
      this.updateMutation.error() ??
      this.retryPoolMutation.error(),
  );
  /** The questions the exam draws per attempt, when the bank holds fewer. */
  readonly bankShortfall$ = computed(() => {
    const exam = this.exam$();
    const active = this.activeBank$();
    return exam && active !== undefined && active < exam.questionCount
      ? { active, needed: exam.questionCount }
      : undefined;
  });
  readonly importOpen$ = this.state.importOpen.asReadonly();
  /** The bank screen is for those whose menu has it; others import here or ask someone who can. */
  readonly canOpenBank$ = computed(() =>
    this.session.menus$().includes('QUESTION_BANK'),
  );
  readonly programId$ = computed(() => this.editor.storedProgram$()?.id);
  /** The drawer imports into this course only. */
  readonly importCourse$ = computed(() => {
    const course = this.editor.course$();
    return course
      ? { courseId: course.course.id, title: course.revision.title }
      : undefined;
  });
  /** The form is editing the exam: its stored values, once read. */
  readonly editValue$ = computed(() => {
    const detail = this.detailData.value();
    return detail ? toExamValue(detail) : undefined;
  });
  readonly editError$ = this.detailData.error;
  /** The exam is made and on the draft, but its questions are not written yet. */
  readonly poolPending$ = this.state.poolPendingId.asReadonly();
  readonly quizzesError$ = this.editor.quizzesError$;
  /** Why publishing the course was stopped at this exam. */
  readonly publishError$ = this.editor.examPublishError$;

  readonly formOpen$ = this.state.formOpen.asReadonly();

  private setFormOpen(open: boolean): void {
    this.state.formOpen.set(open);
  }

  private setPoolPendingId(id: number | null): void {
    this.state.poolPendingId.set(id);
  }

  private setImportOpen(open: boolean): void {
    this.state.importOpen.set(open);
  }

  openImport(): void {
    this.setImportOpen(true);
  }

  closeImport(): void {
    this.setImportOpen(false);
  }

  /** A written import: the count is read again and the exam's pool follows the bigger bank. */
  finishImport(): void {
    this.setImportOpen(false);
    this.bankChanges.bump();
    const exam = this.exam$();
    if (exam && this.isWizardManaged$()) this.resyncMutation.run(exam.id);
  }

  openForm(): void {
    this.createMutation.reset();
    this.updateMutation.reset();
    this.setFormOpen(true);
  }

  closeForm(): void {
    this.setFormOpen(false);
  }

  /** Creates the course's final exam from the short form. */
  create(value: ExamFormValue): void {
    const courseId = this.editor.course$()?.course.id;
    if (courseId) this.createMutation.run({ courseId, value });
  }

  /** Saves the edit of a wizard-managed exam; one the quiz screen customised is never written. */
  update(value: ExamFormValue): void {
    const detail = this.detailData.value();
    if (detail && this.isWizardManaged$()) {
      this.updateMutation.run({ detail, value });
    }
  }

  retryEdit(): void {
    this.detailData.reload();
  }

  retryPool(): void {
    const quizId = this.state.poolPendingId();
    if (quizId) this.retryPoolMutation.run(quizId);
  }

  retryBank(): void {
    this.bankData.reload();
  }

  retryQuizzes(): void {
    this.editor.reloadQuizzes();
  }

  private poolWritten(): void {
    this.setPoolPendingId(null);
    this.editor.reloadQuizzes();
  }

  private syncPool(quizId: number): Observable<QuizDetailV1> {
    const course = this.editor.course$();
    const programId = this.editor.storedProgram$()?.id;
    return course && programId
      ? syncExamPool(this.client, quizId, {
          programId,
          courseId: course.course.id,
        })
      : throwError(() => new Error('The course has no program yet.'));
  }
}
