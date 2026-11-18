import { Dialog } from '@angular/cdk/dialog';
import {
  Component,
  afterNextRender,
  Injector,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { form, FormRoot, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { type CourseDetail, type DraftingStepNumber } from '@lms/contracts';
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
  Toaster,
} from '@lms/ui';
import { AgentChatStore } from '../../../core/assistant/agent-chat.store';
import { KeptDrafts } from '../../../core/session/kept-drafts';
import { CourseJobAccess } from '../../../core/course-jobs/course-job-access';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { BottomBar } from '../../../layout/shell-insets';
import { CatalogStatus } from '../../../shared/status/catalog-status';
import { firstValueFrom } from 'rxjs';
import { CourseAiStatus } from './components/course-ai-status/course-ai-status';
import { DraftingBar } from './components/drafting-bar/drafting-bar';
import { CourseInfo } from './components/course-info/course-info';
import { CourseOutline } from './components/course-outline/course-outline';
import { CourseReview } from './components/course-review/course-review';
import { CourseRules } from './components/course-rules/course-rules';
import { LessonForm } from './components/lesson-form/lesson-form';
import {
  emptyDraftValue,
  draftChecks,
  mergeLive,
  toCreateCourseCommand,
  toDraftValue,
  toSaveDraftCommand,
  withAsset,
  type CourseDraftValue,
  type LessonValue,
} from './course-draft';
import { courseCodeSchema, courseDraftSchema } from './course-draft.schema';
import { CourseAiJobStore } from './data-access/course-ai-job.store';
import { DraftingFillStore } from './data-access/drafting-fill.store';
import {
  COVER_KEY,
  CourseEditorStore,
  EDITOR_STEPS,
} from './data-access/course-editor.store';

export const KEPT_DRAFT_TITLE =
  'Có thay đổi chưa lưu từ trước khi phiên đăng nhập hết hạn.';
export const RESTORE_LABEL = 'Khôi phục';

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
    DraftingBar,
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
  providers: [CourseEditorStore, CourseAiJobStore, DraftingFillStore],
  templateUrl: './course-editor.html',
  styleUrl: './course-editor.scss',
})
export class CourseEditor implements HasUnsavedChanges {
  protected readonly store = inject(CourseEditorStore);
  protected readonly steps = EDITOR_STEPS;
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  protected readonly validationRequested = signal<readonly boolean[]>([
    false,
    false,
    false,
  ]);
  protected readonly ai = inject(CourseAiJobStore);
  /** The assistant's proposal written into the form, on a course drafted with it. */
  protected readonly fill = inject(DraftingFillStore);
  private readonly keptDrafts = inject(KeptDrafts);
  private readonly toaster = inject(Toaster);
  private readonly chat = inject(AgentChatStore);
  private readonly canGenerate = inject(CourseJobAccess).canGenerate$;
  /**
   * "Soạn cùng trợ lý" is offered on a new course that no session fills yet, to instructors and
   * admins who have the assistant.
   */
  protected readonly canDraftWithAssistant = computed(
    () =>
      this.store.isCreate$() &&
      !this.fill.attached$() &&
      this.canGenerate() &&
      this.chat.available$(),
  );

  /** Opens the chat on a new conversation with the file picker; the file picked starts a session. */
  protected draftWithAssistant(): void {
    this.chat.startDrafting();
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
          if (this.store.pendingUploads$()) return;
          this.validationRequested.set([true, true, true]);
          if (this.store.step$() === 2 && this.store.examEditing$()) {
            this.rules()?.submitExam();
            return;
          }
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
   * A 401 ends the session under unsaved edits: they are kept in this tab and, once the user has
   * signed in and the page is open again, offered back. Nothing is restored without asking.
   */
  private keepDraftWhenTheSessionEnds(): void {
    this.keptDrafts.whileOpen(() => {
      if (this.dirty()) {
        this.keptDrafts.keep(this.store.keptDraftKey$(), this.draftValue());
      }
    });
  }

  /** Once the page is ready (edit mode reads the course first), a kept draft is offered back once. */
  private keptDraftChecked = false;
  private readonly offerKeptDraftWhenReady = afterRenderEffect(() => {
    if (this.keptDraftChecked || !this.ready()) return;
    this.keptDraftChecked = true;
    untracked(() => this.offerKeptDraft());
  });

  keepsItsDraft(): boolean {
    return true;
  }

  private offerKeptDraft(): void {
    const kept = this.keptDrafts.take<CourseDraftValue>(
      this.store.keptDraftKey$(),
    );
    if (!kept || fingerprint(kept.value) === fingerprint(this.draftValue())) {
      return;
    }
    this.toaster.offer(KEPT_DRAFT_TITLE, {
      label: RESTORE_LABEL,
      run: () => this.model.set(kept.value),
    });
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
  protected readonly outlineProblems = computed(() =>
    draftChecks(this.draftValue(), this.store.quizzes$())
      .filter((check) => check.step === 1 && !check.optional && !check.ok)
      .map((check) => check.label),
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

  /** "Tiếp theo" on step 1 of a new course creates the course and moves to its URL: the cover must be done. */
  protected readonly continueBlocked = computed(
    () =>
      this.store.isCreate$() &&
      this.store.step$() === 0 &&
      this.store.coverUploading$(),
  );

  /** Why saving waits: a block saved now would have no asset. */
  protected readonly uploadHint = computed(() => {
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
    this.keepDraftWhenTheSessionEnds();
    this.fill.attach(this.model, (step) => this.confirmDraftingStep(step));
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
        invalid: () =>
          fields.some((field) => field().invalid()) ||
          (index === 1 &&
            draftChecks(this.draftValue(), this.store.quizzes$()).some(
              (check) => check.step === 1 && !check.optional && !check.ok,
            )),
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
  private readonly rules = viewChild(CourseRules);
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

  /** A field of the step shown is invalid. */
  private readonly stepInvalid = computed(() =>
    (this.stepFields()[this.store.step$()] ?? []).some((field) =>
      field().invalid(),
    ),
  );

  /**
   * Why "Đã chốt" cannot confirm the step shown yet: the assistant still writes it, a field of
   * the step is invalid, a file still uploads, or there is no unit to own a new course.
   */
  protected readonly draftingProblem = computed((): string | null => {
    if (this.fill.locked$())
      return 'Trợ lý đang soạn bước này. Chờ trợ lý soạn xong hoặc bấm Dừng.';
    if (this.stepInvalid())
      return 'Còn trường chưa hợp lệ ở bước này. Sửa xong rồi bấm Đã chốt.';
    if (this.store.pendingUploads$() > 0 || this.continueBlocked())
      return 'Còn tệp đang tải lên. Chờ tải xong rồi bấm Đã chốt.';
    if (this.store.isCreate$() && !this.store.ownerOrgId$())
      return 'Chưa xác định được đơn vị sở hữu khóa học.';
    if (this.store.step$() === 2) return this.fill.rulesProblem$();
    return null;
  });

  /**
   * "Đã chốt" on the bar or on the chat's card: the step is confirmed with what the page holds
   * now. Step 1 sends the create command, so the server makes the draft course from it; step 2
   * the whole draft, as "Lưu nháp" saves it (lessons without content do not stop it); step 3 the
   * draft with the kept questions and their competency, which become a new final exam. Step 4
   * sends nothing: it ends the flow, and the assign rows wait for the author's own "Xuất bản".
   */
  protected confirmDraftingStep(step: DraftingStepNumber): void {
    if (this.store.step$() !== step - 1 || this.draftingProblem() !== null) {
      if (this.stepInvalid()) this.showInvalidStep();
      return;
    }
    const value = this.draftValue();
    if (step === 1) {
      const ownerOrgId = this.store.ownerOrgId$();
      if (!ownerOrgId) return;
      this.fill.confirm(step, {
        course: toCreateCourseCommand(value, value.code, ownerOrgId),
      });
      return;
    }
    const revision = this.store.course$()?.revision;
    if (step === 2 && revision) {
      this.fill.confirm(step, {
        draft: toSaveDraftCommand(value, revision.rowVersion),
      });
    }
    const rules = this.fill.rulesCommand();
    if (step === 3 && revision && rules) {
      this.fill.confirm(step, {
        draft: toSaveDraftCommand(value, revision.rowVersion),
        ...rules,
      });
    }
    if (step === 4) this.fill.confirm(step, {});
  }

  /** "Tiếp theo": when the step stays because of an error, the first one gets focus. */
  protected continue(): void {
    this.navigate(this.store.step$() + 1);
  }

  protected navigate(target: number): void {
    if (this.store.isSaving$()) return;
    const current = this.store.step$();
    if (target <= current || !this.store.isDraft$()) {
      this.store.goToStep(target);
      return;
    }
    const next = this.store.isCreate$() && current === 0 ? 1 : target;
    if (this.store.validateBefore(next)) {
      if (next > 2 && this.store.examEditing$()) {
        this.store.goToStep(2);
        this.rules()?.submitExam(next);
        return;
      }
      this.store.continue(this.draftValue(), next);
      return;
    }
    const step = this.store.step$();
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
