import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
  type Signal,
} from '@angular/core';
import {
  assessmentV1Endpoints,
  programAssessmentEndpoints,
  type CourseExamCommand,
  type QuizDetailV1,
  type QuizSummary,
} from '@lms/contracts';
import { finalize } from 'rxjs';
import { invalidation } from '../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../../../core/session/session.store';
import {
  toCreateCourseCommand,
  toSaveDraftCommand,
  type CourseDraftValue,
} from '../../../course-draft';
import {
  COVER_KEY,
  CourseEditorStore,
} from '../../../data-access/course-editor.store';
import { activeBankQuestions } from './exam-pool';
import {
  POOL_LIMIT,
  toExamValue,
  toNewQuizRequest,
  toUpdatedQuizRequest,
  type ExamFormValue,
} from './course-exam.model';

/** The course, final exam and selected questions are committed together by the backend. */
@Injectable()
export class CourseExamStore {
  private readonly client = inject(EndpointClient);
  private readonly editor = inject(CourseEditorStore);
  private readonly session = inject(SessionStore);
  private readonly state = {
    formOpen: signal(false),
    importOpen: signal(false),
    draft: signal<Signal<CourseDraftValue> | null>(null),
  };
  private readonly bankChanges = invalidation();
  private readonly draft = computed(() => this.state.draft()?.());
  readonly programId$ = computed(
    () =>
      Number(this.draft()?.programId) ||
      this.editor.course$()?.revision.programId ||
      undefined,
  );
  readonly programName$ = computed(
    () => this.editor.programs$().find((p) => p.id === this.programId$())?.name,
  );
  private readonly source = computed(() => {
    const programId = this.programId$();
    const courseId = this.editor.course$()?.course.id;
    return programId
      ? { programId, ...(courseId ? { courseId } : {}) }
      : undefined;
  });
  private readonly bankData = serverData(
    (query: { programId: number; courseId?: number }) =>
      this.client.call(programAssessmentEndpoints.questions, {
        query: { ...query, status: 'ACTIVE', page: 0, size: 1 },
      }),
    { params: this.source, reloadOn: this.bankChanges },
  );
  private readonly pickerData = serverData(
    (source: { programId: number; courseId?: number }) =>
      activeBankQuestions(this.client, source),
    {
      params: () => (this.state.formOpen() ? this.source() : undefined),
      reloadOn: this.bankChanges,
    },
  );
  readonly exam$ = computed((): QuizSummary | undefined =>
    this.editor.quizzes$().find((q) => q.quizType === 'FINAL_EXAM'),
  );
  private readonly detailData = serverData(
    (id: number) =>
      this.client.call(assessmentV1Endpoints.quiz, { params: { id } }),
    { params: () => (this.state.formOpen() ? this.exam$()?.id : undefined) },
  );
  private readonly saveMutation = serverMutation(
    (input: { value: ExamFormValue; detail?: QuizDetailV1 }) => {
      const command = this.command(input.value, input.detail);
      this.editor.setExamSaving(true);
      return this.client
        .call(assessmentV1Endpoints.saveCourseExam, { body: command })
        .pipe(finalize(() => this.editor.setExamSaving(false)));
    },
    {
      errors: 'alert',
      success: () => 'Đã lưu khóa học và bài kiểm tra',
      onSuccess: (saved) => {
        this.editor.setExamEditing(false);
        this.editor.acceptExamCourse(saved);
        this.state.formOpen.set(false);
      },
    },
  );
  readonly formOpen$ = this.state.formOpen.asReadonly();
  readonly importOpen$ = this.state.importOpen.asReadonly();
  readonly activeBank$ = computed(() => this.bankData.value()?.totalElements);
  readonly isBankLoading$ = this.bankData.isLoading;
  readonly bankError$ = this.bankData.error;
  readonly questions$ = computed(() => this.pickerData.value() ?? []);
  readonly questionsLoading$ = this.pickerData.isLoading;
  readonly questionsError$ = this.pickerData.error;
  readonly isBankCapped$ = computed(
    () => (this.activeBank$() ?? 0) > POOL_LIMIT,
  );
  readonly poolLimit = POOL_LIMIT;
  readonly isSaving$ = this.saveMutation.isPending;
  readonly saveError$ = this.saveMutation.error;
  readonly quizzesError$ = this.editor.quizzesError$;
  readonly publishError$ = this.editor.examPublishError$;
  readonly editError$ = this.detailData.error;
  readonly editValue$ = computed(() => {
    const detail = this.detailData.value();
    return detail
      ? {
          ...toExamValue(detail),
          questionIds: detail.pool.map((q) => q.questionId),
        }
      : undefined;
  });
  readonly canOpenBank$ = computed(() =>
    this.session.menus$().includes('QUESTION_BANK'),
  );
  readonly importCourse$ = computed(() => {
    const course = this.editor.course$();
    return course
      ? { courseId: course.course.id, title: course.revision.title }
      : undefined;
  });
  readonly bankShortfall$ = computed(() => {
    const quiz = this.exam$();
    const active = this.activeBank$();
    return quiz && active !== undefined && active < quiz.questionCount
      ? { active, needed: quiz.questionCount }
      : undefined;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.editor.setExamEditing(false));
  }

  registerDraft(draft: Signal<CourseDraftValue>): void {
    this.state.draft.set(draft);
  }
  openForm(): void {
    this.saveMutation.reset();
    this.editor.setExamEditing(true);
    this.state.formOpen.set(true);
  }
  closeForm(): void {
    if (!this.isSaving$()) {
      this.editor.setExamEditing(false);
      this.state.formOpen.set(false);
    }
  }
  openImport(): void {
    this.state.importOpen.set(true);
  }
  closeImport(): void {
    this.state.importOpen.set(false);
  }
  finishImport(): void {
    this.closeImport();
    this.bankChanges.bump();
  }
  create(value: ExamFormValue): void {
    this.saveMutation.run({ value });
  }
  update(value: ExamFormValue): void {
    const detail = this.detailData.value();
    if (detail) this.saveMutation.run({ value, detail });
  }
  retryEdit(): void {
    this.detailData.reload();
  }
  retryBank(): void {
    this.bankData.reload();
    this.pickerData.reload();
  }
  retryQuizzes(): void {
    this.editor.reloadQuizzes();
  }

  private command(
    value: ExamFormValue,
    detail?: QuizDetailV1,
  ): CourseExamCommand {
    const valueOfDraft = this.draft();
    const cover = this.editor.uploads$()[COVER_KEY];
    const draft =
      valueOfDraft && cover?.state === 'done' && cover.asset
        ? { ...valueOfDraft, coverAssetId: cover.asset.assetId }
        : valueOfDraft;
    const course = this.editor.course$();
    const ownerOrgId = this.editor.ownerOrgId$();
    if (
      !draft ||
      !ownerOrgId ||
      !draft.title.trim() ||
      !draft.code.trim() ||
      !draft.programId ||
      !draft.level
    )
      throw new Error(
        'Hoàn thiện tên, mã, chương trình và mức độ khóa học ở bước Thông tin cơ bản.',
      );
    const config = detail
      ? toUpdatedQuizRequest(detail, value)
      : toNewQuizRequest(course?.course.id ?? 1, value);
    const ids = value.questionIds ?? this.questions$().map((q) => q.id);
    const points = new Map(
      detail?.pool.map((q) => [q.questionId, q.pointsOverride]),
    );
    return {
      ...(course
        ? {
            courseId: course.course.id,
            revisionId: course.revision.id,
            draft: toSaveDraftCommand(draft, course.revision.rowVersion),
          }
        : { course: toCreateCourseCommand(draft, draft.code, ownerOrgId) }),
      ...(detail
        ? {
            quizId: detail.quiz.id,
            expectedQuizVersion: detail.quiz.rowVersion,
          }
        : {}),
      quiz: { ...config, courseId: course?.course.id },
      pool: {
        items: ids.map((questionId, sortNo) => ({
          questionId,
          sortNo,
          points: points.get(questionId) ?? null,
        })),
      },
    };
  }
}
