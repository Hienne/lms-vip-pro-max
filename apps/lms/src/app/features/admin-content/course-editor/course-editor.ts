import { Dialog } from '@angular/cdk/dialog';
import {
  Component,
  afterNextRender,
  Injector,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { form, FormRoot, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { courseJobReviewPath, type CourseDetail } from '@lms/contracts';
import {
  Alert,
  AlertAction,
  Breadcrumb,
  Button,
  confirm,
  DrawerOutlet,
  ErrorState,
  FormActions,
  Icon,
  LinkButton,
  Spinner,
  Stepper,
  PageHeader,
} from '@lms/ui';
import { CourseFormPrefillStore } from '../../../core/assistant/course-form-prefill.store';
import { CourseJobAccess } from '../../../core/course-jobs/course-job-access';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { BottomBar } from '../../../layout/shell-insets';
import { CatalogStatus } from '../../../shared/status/catalog-status';
import { StartCourseStore } from '../ai-course/ai-course-section/data-access/start-course.store';
import { firstValueFrom } from 'rxjs';
import { CourseAiStatus } from './components/course-ai-status/course-ai-status';
import { CourseInfo } from './components/course-info/course-info';
import { CourseOutline } from './components/course-outline/course-outline';
import { CourseReview } from './components/course-review/course-review';
import { CourseRules } from './components/course-rules/course-rules';
import { LessonForm } from './components/lesson-form/lesson-form';
import {
  emptyDraftValue,
  mergeLive,
  toDraftValue,
  toSaveDraftCommand,
  withAsset,
  type CourseDraftValue,
  type LessonValue,
} from './course-draft';
import { courseCodeSchema, courseDraftSchema } from './course-draft.schema';
import { CourseAiJobStore } from './data-access/course-ai-job.store';
import {
  COVER_KEY,
  CourseEditorStore,
  EDITOR_STEPS,
} from './data-access/course-editor.store';

/** The draft without its row keys, to tell whether the author changed anything. */
const fingerprint = (value: CourseDraftValue) =>
  JSON.stringify([value.code, toSaveDraftCommand(value, 0)]);

/**
 * The course editor (the mockup's `courseWizard`): four steps over one draft, saved whole. The
 * draft is this page's form model, read again from the server after every save because the
 * server renumbers the tree. Assigning moved to the assignments screen.
 */
@Component({
  selector: 'app-course-editor',
  imports: [
    PageHeader,
    Alert,
    AlertAction,
    BottomBar,
    Breadcrumb,
    Button,
    CatalogStatus,
    CourseAiStatus,
    CourseInfo,
    CourseOutline,
    CourseReview,
    CourseRules,
    DrawerOutlet,
    ErrorState,
    FormActions,
    FormRoot,
    Icon,
    LessonForm,
    LinkButton,
    RouterLink,
    Spinner,
    Stepper,
  ],
  providers: [CourseEditorStore, CourseAiJobStore, StartCourseStore],
  templateUrl: './course-editor.html',
  styleUrl: './course-editor.scss',
})
export class CourseEditor implements HasUnsavedChanges {
  protected readonly store = inject(CourseEditorStore);
  protected readonly steps = EDITOR_STEPS;
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  protected readonly validationRequested = signal<readonly boolean[]>([
    false,
    false,
    false,
  ]);
  protected readonly ai = inject(CourseAiJobStore);
  private readonly starter = inject(StartCourseStore);
  private readonly chatPrefill = inject(CourseFormPrefillStore);
  /** "Tạo bằng AI" is offered to instructors and admins on a new course only. */
  protected readonly canGenerate = inject(CourseJobAccess).canGenerate$;
  protected readonly generating = this.starter.isStarting$;

  /**
   * Why "Tạo bằng AI" is not available yet: step 1's own fields first, then the AI section's.
   * Null when the button may be pressed.
   */
  protected readonly aiProblem = computed((): string | null => {
    if (this.stepFields()[0].some((field) => field().invalid())) {
      return 'Hoàn thành thông tin cơ bản của khóa học ở trên';
    }
    return this.starter.problem$();
  });

  /**
   * Starts the job: the server creates it together with the draft course, and the editor moves
   * to step 2 of that course, where the outline appears as it is written.
   */
  protected generateWithAi(): void {
    if (this.aiProblem() !== null) return;
    const value = this.draftValue();
    this.starter.start(
      {
        title: value.title,
        description: value.summary,
        programmeId: Number(value.programId),
      },
      (job) => {
        if (job.courseId == null) {
          // A job made without a course (an older server): the review screen still shows it.
          void this.router.navigateByUrl(courseJobReviewPath(job.jobId));
          return;
        }
        this.store.moveToCourse(job.courseId, 1);
      },
    );
  }

  /**
   * The form's value. It follows the server's draft; while the AI writes into the course the
   * draft is read again every few seconds, and an edit in progress must survive that, so the
   * lessons the author did not touch are taken from the server and the rest stays as typed.
   */
  private readonly model = linkedSignal<
    CourseDetail | undefined,
    CourseDraftValue
  >({
    source: () => this.store.course$(),
    computation: (detail, previous) => {
      if (!detail) return emptyDraftValue();
      const fresh = toDraftValue(detail);
      const before = previous?.source;
      const followsAi =
        !!before &&
        before.course.id === detail.course.id &&
        untracked(() => this.ai.job$()) !== undefined;
      return followsAi
        ? mergeLive(toDraftValue(before), previous.value, fresh)
        : fresh;
    },
  });
  protected readonly courseForm = form(
    this.model,
    (path) => {
      courseDraftSchema(path);
      if (this.store.isCreate$()) {
        courseCodeSchema(path.code, this.store.takenCode$);
      }
    },
    {
      submission: {
        onInvalid: () => this.showInvalidStep(),
        action: async () => {
          if (this.store.pendingUploads$() || this.store.examEditing$()) return;
          this.validationRequested.set([true, true, true]);
          if (this.store.isCreate$()) this.store.create(this.draftValue());
          else this.store.save(this.command());
        },
      },
    },
  );

  /**
   * The draft as it is saved: the form's value, with the cover image uploaded or picked in this
   * page once it is ready (like a block's file, it joins the draft when it is there).
   */
  protected readonly draftValue = computed((): CourseDraftValue => {
    const cover = this.store.uploads$()[COVER_KEY];
    const value = this.model();
    return cover?.state === 'done' && cover.asset
      ? { ...value, coverAssetId: cover.asset.assetId }
      : value;
  });

  /**
   * A new course opened by the chat (`open_course_form`) starts with what the user said and the
   * file they attached. The hand-over is read once and cleared; it is taken on every open so a
   * prefill is never left for a later one, but only a new course for a role that may generate
   * uses it.
   */
  private applyChatPrefill(): void {
    const prefill = this.chatPrefill.take();
    if (!prefill || !this.store.isCreate$() || !this.canGenerate()) return;
    const title = prefill.fields.title?.trim();
    if (title) this.model.update((value) => ({ ...value, title }));
    this.starter.applyPrefill(prefill.fields, prefill.file);
  }

  /** Create mode shows the form at once; edit mode waits for the course to be read. */
  protected readonly ready = computed(
    () => this.store.isCreate$() || !!this.store.course$(),
  );

  private readonly saved = computed(() => {
    const detail = this.store.course$();
    return detail
      ? fingerprint(toDraftValue(detail))
      : fingerprint(emptyDraftValue());
  });

  protected readonly dirty = computed(
    () =>
      this.store.isDraft$() && fingerprint(this.draftValue()) !== this.saved(),
  );

  /**
   * The fields of steps 1 to 3 in the order the page shows them; the publish step is checked by
   * the publish itself.
   */
  private readonly stepFields = () => {
    const f = this.courseForm;
    return [
      [f.title, f.programId, f.code, f.level, f.summary, f.objectives],
      [f.chapters],
      [f.rewardPoints],
    ];
  };

  /** "Tiếp tục" on step 1 of a new course creates the course and moves to its URL: the cover must be done. */
  protected readonly continueBlocked = computed(
    () =>
      this.store.examEditing$() ||
      (this.store.isCreate$() &&
        this.store.step$() === 0 &&
        this.store.coverUploading$()),
  );

  /** Why saving waits: a block saved now would have no asset. */
  protected readonly uploadHint = computed(() => {
    if (this.store.examEditing$())
      return 'Lưu bài kiểm tra hoặc Hủy trước khi chuyển bước.';
    const pending = this.store.pendingUploads$();
    if (this.continueBlocked()) return 'Ảnh bìa đang tải lên';
    return pending ? `Còn ${pending} tệp đang tải` : '';
  });

  /** Where each block of the draft sits, by key: what a kept upload records. */
  private readonly blockPositions = computed(
    (): ReadonlyMap<string, string> =>
      new Map(
        this.model().chapters.flatMap((chapter, ci) =>
          chapter.lessons.flatMap((lesson, li) =>
            lesson.blocks.map(
              (block, bi) => [block.key, `${ci}.${li}.${bi}`] as const,
            ),
          ),
        ),
      ),
  );

  constructor() {
    this.applyChatPrefill();
    this.store.registerBlockPositions(this.blockPositions);
    this.store.registerAssetAttacher((blockKey, asset) =>
      this.model.update((value) => ({
        ...value,
        chapters: value.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) =>
            lesson.blocks.some((b) => b.key === blockKey)
              ? {
                  ...lesson,
                  blocks: lesson.blocks.map((b) =>
                    b.key === blockKey ? withAsset(b, asset) : b,
                  ),
                }
              : lesson,
          ),
        })),
      })),
    );
    this.store.registerBlockDropper((blockKey) =>
      this.model.update((value) => ({
        ...value,
        chapters: value.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) => ({
            ...lesson,
            blocks: lesson.blocks.filter(
              (b) => b.key !== blockKey || b.assets.length > 0,
            ),
          })),
        })),
      })),
    );
    this.store.registerExamAttacher((quizId) => {
      this.model.update((value) => ({ ...value, finalQuizId: String(quizId) }));
      this.store.save(this.command());
    });
    this.store.registerStepChecks(
      this.stepFields().map((fields, index) => ({
        invalid: () => fields.some((field) => field().invalid()),
        touched: () => this.validationRequested()[index],
        touch: () => {
          this.validationRequested.update((steps) =>
            steps.map((shown, step) => step === index || shown),
          );
          fields.forEach((field) => field().markAsTouched());
        },
      })),
    );
  }

  /**
   * The lesson in the drawer as it was when opened. The draft is read untracked: a finished
   * upload joins its block in the draft while the drawer is open, and that must not reset the
   * form the author is typing in (the form's own files already include the finished upload).
   */
  private readonly lessonForm = viewChild(LessonForm);
  protected readonly inlineUploading = computed(
    () => this.lessonForm()?.inlineUploading$() ?? false,
  );

  protected readonly editingLesson = computed((): LessonValue | undefined => {
    const target = this.store.editingLesson$();
    return target
      ? untracked(this.model).chapters[target.chapter]?.lessons[target.lesson]
      : undefined;
  });

  /** Unsaved edits, or files still uploading (leaving stops them): one question for both. */
  hasUnsavedChanges(): boolean {
    return (
      !this.store.left$() &&
      (this.dirty() ||
        this.store.pendingUploads$() > 0 ||
        this.store.examEditing$() ||
        this.inlineUploading())
    );
  }

  leaveMessage(): string | undefined {
    const pending = this.store.pendingUploads$();
    return pending
      ? `Còn ${pending} tệp đang tải. Rời trang sẽ dừng tải; lần sau mở lại, chọn lại đúng tệp để tải tiếp.`
      : undefined;
  }

  /** "Tiếp tục": when the step stays because of an error, the first one gets focus. */
  protected continue(): void {
    const step = this.store.step$();
    if (this.store.continue(this.draftValue())) return;
    this.stepFields()
      [step]?.find((field) => field().invalid())?.()
      .errorSummary()[0]
      ?.fieldTree()
      .focusBoundControl();
  }

  protected publish(): void {
    if (this.store.pendingUploads$() || this.store.examEditing$()) return;
    this.validationRequested.set([true, true, true]);
    void submit(this.courseForm, {
      onInvalid: () => this.showInvalidStep(),
      action: async () =>
        this.store.isCreate$()
          ? this.store.createAndPublish(this.draftValue())
          : this.store.publish(this.command()),
    });
  }

  private showInvalidStep(): void {
    this.validationRequested.set([true, true, true]);
    const index = this.stepFields().findIndex((fields) =>
      fields.some((field) => field().invalid()),
    );
    if (index < 0) return;
    this.store.goToStep(index);
    afterNextRender(
      () =>
        this.stepFields()
          [index].find((field) => field().invalid())?.()
          .errorSummary()[0]
          ?.fieldTree()
          .focusBoundControl(),
      { injector: this.injector },
    );
  }

  /** "Gỡ ảnh bìa": the cover chosen in this page is dropped, and the stored one with it. */
  protected removeCover(): void {
    this.store.dropCover();
    this.model.update((value) => ({ ...value, coverAssetId: null }));
  }

  /** Esc, the backdrop or a close button while a file begun here uploads: ask what to do first. */
  protected askToCloseLesson(): void {
    if (this.inlineUploading()) {
      void this.lessonForm()?.save();
      return;
    }
    this.store.askToCloseLesson(() => this.lessonForm()?.save());
  }

  protected applyLesson(lesson: LessonValue): void {
    const target = this.store.editingLesson$();
    if (!target) return;
    this.model.update((value) => ({
      ...value,
      chapters: value.chapters.map((chapter, ci) =>
        ci === target.chapter
          ? {
              ...chapter,
              lessons: chapter.lessons.map((l, li) =>
                li === target.lesson ? lesson : l,
              ),
            }
          : chapter,
      ),
    }));
    this.store.closeLesson();
    // A lesson edited while the AI writes is saved at once, so the job finds it already the author's.
    if (this.ai.running$()) this.store.save(this.command());
  }

  /** Whether the open lesson can be rewritten by the AI. */
  protected readonly canRewrite = computed(() => {
    const target = this.store.editingLesson$();
    return !!target && this.ai.canRewrite(target.chapter, target.lesson);
  });

  /** "Viết lại bằng AI": only this lesson is written again; the drawer closes, the edit in it is dropped. */
  protected async rewriteWithAi(): Promise<void> {
    const target = this.store.editingLesson$();
    if (!target) return;
    const confirmed = await firstValueFrom(
      confirm(this.dialog, {
        title: 'Viết lại bài này bằng AI?',
        message:
          'Nội dung hiện tại của bài, kể cả phần bạn đã sửa, sẽ được thay bằng bản AI viết lại. Các bài khác giữ nguyên.',
        confirmLabel: 'Viết lại',
        tone: 'danger',
      }),
    );
    if (!confirmed) return;
    this.store.closeLesson();
    this.ai.rewrite(target.chapter, target.lesson);
  }

  private command() {
    const { expectedVersion: _version, ...command } = toSaveDraftCommand(
      this.draftValue(),
      0,
    );
    return command;
  }
}
