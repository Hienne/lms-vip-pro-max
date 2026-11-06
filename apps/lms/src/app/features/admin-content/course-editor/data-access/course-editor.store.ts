import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  assessmentV1Endpoints,
  assignmentEndpoints,
  courseEndpoints,
  MAX_PAGE_SIZE,
  organizationEndpoints,
  PUBLISH_LIMITS,
  trainingCatalogEndpoints,
  type BlockType,
  type CourseDetail,
  type CreateCourseCommand,
  type LibraryAsset,
  type SaveDraftCommand,
} from '@lms/contracts';
import { confirm, NOW, Toaster, type StepperItem } from '@lms/ui';
import {
  catchError,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
  takeUntil,
  tap,
  throwError,
  timer,
  type Subscription,
} from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../core/network/network.store';
import { SessionStore } from '../../../../core/session/session.store';
import { toAppError, type AppError } from '../../../../core/errors/app-error';
import {
  sameTarget,
  type TargetPick,
} from '../../../../shared/assignment-target/target-labels';
import {
  coverPreview,
  type CoverPreview,
} from '../../../../shared/course/cover-image';
import { courseCatalogStatus } from '../../../../shared/status/catalog-status';
import {
  FILE_USAGE,
  toCreateCourseCommand,
  type AssetValue,
  type CourseDraftValue,
} from '../course-draft';
import {
  cancelUpload,
  chunkedUpload,
  pollUpload,
  reprocessUpload,
  SERVER_RETRY_MS,
  type UploadProgress,
} from './chunked-upload';
import { KeptUploads, type KeptUpload } from './kept-uploads.storage';
import {
  completedSteps,
  shownInvalidSteps,
  type StepCheck,
} from './step-progress';
import {
  countsText,
  dateInput,
  namesPublishRow,
  refusedRows,
  rowIssue,
  toPublishCommand,
  type PublishRow,
  type PublishTargets,
} from './publish-targets';
import { Sha256Hasher } from './sha256-hasher';
import { syncExamPool } from '../components/course-rules/data-access/exam-pool';
import {
  hashingStatus,
  isBusy,
  isCancellable,
  MISMATCH_MESSAGE,
  PROCESSING_STATUS,
  sendingStatus,
  STALLED_MESSAGE,
  WAITING_STATUS,
  type UploadEntry,
} from './upload-entry';

export const EDITOR_STEPS: readonly StepperItem[] = [
  { label: 'Thông tin cơ bản', subtitle: 'Tên, mã, chương trình' },
  { label: 'Nội dung khóa học', subtitle: 'Chương, bài, khối nội dung' },
  {
    label: 'Bài thi & điều kiện',
    subtitle: 'Điều kiện hoàn thành, điểm thưởng',
  },
  { label: 'Đối tượng & xuất bản', subtitle: 'Kiểm tra trước khi xuất bản' },
];

/** The lesson open in the drawer, by position in the model. */
export interface LessonTarget {
  readonly chapter: number;
  readonly lesson: number;
}

export interface UploadRequest {
  readonly blockKey: string;
  readonly blockType: BlockType;
  /** The block's place in its lesson: the key does not survive a reload, the place does. */
  readonly blockIndex: number;
  readonly file: File;
}

/** An upload the page lost in a reload: the author picks the file again to continue it. */
export interface InterruptedUpload extends KeptUpload {
  /** Why the last file the author picked was refused. */
  readonly message?: string;
}

/** What a row needs to know about its block once the file itself is out of sight. */
interface UploadContext {
  readonly blockKey: string;
  readonly blockType: BlockType;
  readonly name: string;
  readonly sizeBytes: number;
  /** `chapter.lesson.block`, or none when no lesson is open. */
  readonly position: string | undefined;
  /** The kept upload this one continues. */
  readonly resumed?: KeptUpload;
}

/**
 * The key the cover image's upload runs under, beside the blocks' keys. The cover is not in a
 * lesson, so its upload is not kept across reloads: the author picks the file again.
 */
export const COVER_KEY = 'cover';

/** The code the server answers with when a course code is already taken. */
export const DUPLICATE_CODE = 'LEARNING-DUPLICATE';

/** What a publish starts from: the open draft to save, or a new course to create first. */
type PublishInput = {
  readonly targets: PublishTargets;
  /** The draft exam the publish brings along: the wizard's, still a draft. */
  readonly exam?: { readonly id: number; readonly title: string };
} & (
  | { readonly kind: 'save'; readonly command: SaveDraftCommand }
  | { readonly kind: 'create'; readonly command: CreateCourseCommand }
);

/** A unit in step 4's share list, with what decides whether it can be ticked. */
export interface ShareUnit {
  readonly orgId: number;
  readonly name: string;
  /** The owner unit and a unit with an active share are shown ticked and locked. */
  readonly locked: 'owner' | 'shared' | null;
  readonly checked: boolean;
  /** The limit of shares per publish is reached and this one is not ticked. */
  readonly full: boolean;
  /** The server's refusal of this share, until the box changes or the next publish. */
  readonly error?: string;
}

const MISMATCH_CODE = 'LEARNING-UPLOAD_FILE_MISMATCH';
const EXPIRED_CODE = 'LEARNING-UPLOAD_EXPIRED';

/** The mockup's upload settings: accepted extensions and the size limit of each file block. */
const UPLOAD_RULES: Partial<
  Record<
    BlockType,
    { readonly extensions: readonly string[]; readonly maxMb: number }
  >
> = {
  video: { extensions: ['mp4', 'webm'], maxMb: 500 },
  pdf: { extensions: ['pdf'], maxMb: 20 },
  image: { extensions: ['png', 'jpg', 'jpeg', 'webp'], maxMb: 5 },
  attachment: { extensions: ['pdf', 'docx', 'xlsx', 'pptx'], maxMb: 10 },
};

export const acceptOf = (type: BlockType): string =>
  (UPLOAD_RULES[type]?.extensions ?? []).map((e) => `.${e}`).join(',');

export const uploadHintOf = (type: BlockType): string => {
  const rule = UPLOAD_RULES[type];
  return rule
    ? `Định dạng: ${rule.extensions.join(', ').toUpperCase()} · tối đa ${rule.maxMb} MB`
    : '';
};

/**
 * The course editor (the mockup's `courseWizard`). The server keeps one draft per course and
 * saves it whole; this store reads it, opens a draft from the published revision when the author
 * asks, saves, publishes and uploads files. The draft itself is the page's form model.
 *
 * In create mode (the route's `data.mode`) there is no course yet, so nothing is read for it:
 * the first save creates the course with the whole draft, then the page moves to its edit URL.
 */
@Injectable()
export class CourseEditorStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly hasher = inject(Sha256Hasher);
  private readonly network = inject(NetworkStore);
  private readonly keptStorage = inject(KeptUploads);
  private readonly toaster = inject(Toaster);
  private readonly now = inject(NOW);
  /** Ids for the assignment rows, so a row keeps its identity while others come and go. */
  private nextRowId = 0;
  /**
   * The uploads running in this page, by block key. Raw RxJS subscriptions on purpose: an upload
   * is a long stream with its own pauses and polls, not one request, so `serverMutation` (one run,
   * cancelled by the next) does not fit it.
   */
  private readonly running = new Map<string, Subscription>();
  /** What each running or stopped row needs to go on once the picked file is out of sight. */
  private readonly contexts = new Map<string, UploadContext>();

  private readonly state = {
    step: signal(this.initialStep()),
    /** The steps the author has opened, which may show ✓ once they are valid and left. */
    visited: signal<readonly number[]>([this.initialStep()]),
    /** The checks of steps 1 to 3 over the form, handed over once by the page. */
    stepChecks: signal<readonly StepCheck[]>([]),
    /** The exam a publish already published: a retry of the course does not publish it again. */
    publishedExamId: signal<number | null>(null),
    /** Why the exam of the last publish was refused, shown on step 3. */
    examPublishError: signal<AppError | null>(null),
    /** The last publish told its failure elsewhere (step 3, a toast): the page alert stays out. */
    failureShown: signal(false),
    /** How the page puts a new final exam into its form and saves the draft, handed over once. */
    examAttacher: signal<((quizId: number) => void) | null>(null),
    /** How the page puts a finished upload's asset into its block of the draft, handed over once. */
    assetAttacher: signal<
      ((blockKey: string, asset: AssetValue) => void) | null
    >(null),
    editingLesson: signal<LessonTarget | null>(null),
    /** When the last save went through, as the page shows it ("14:05"). */
    savedAt: signal<string | null>(null),
    /** Set once the course is created or published, so leaving does not ask about unsaved changes. */
    left: signal(false),
    /** The course code the server refused as taken, so the code field can say so. */
    takenCode: signal<string | null>(null),
    /** The program whose field lists the modules; follows the course until the author picks. */
    programId: linkedSignal<number | undefined>(
      () => this.courseData.value()?.revision.programId ?? undefined,
    ),
    uploads: signal<Readonly<Record<string, UploadEntry>>>({}),
    /** The uploads the server still holds for this course, kept across reloads. */
    kept: linkedSignal<readonly KeptUpload[]>(() => {
      const userId = this.userId();
      const courseId = this.courseId();
      return userId && courseId ? this.keptStorage.read(userId, courseId) : [];
    }),
    /** Why the file picked to continue an interrupted upload was refused, by upload id. */
    refusals: signal<Readonly<Record<string, string>>>({}),
    // Step 4. Not part of the draft: "Lưu nháp" does not save them and leaving loses them.
    publishRows: signal<readonly PublishRow[]>([]),
    reminderEnabled: signal(true),
    newShareOrgIds: signal<readonly number[]>([]),
    /** The server's refusal of a share, by the unit's id. */
    shareErrors: signal<Readonly<Record<number, string>>>({}),
  };

  private readonly courseId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
  );

  private readonly orgId = computed(() => this.session.user$()?.org?.id);
  private readonly userId = computed(() => this.session.user$()?.userId);

  private readonly changes = invalidation();

  private readonly courseData = serverData(
    (courseId: number) =>
      this.client.call(courseEndpoints.getCourse, {
        params: { courseId },
        query: {},
      }),
    { params: () => this.courseId(), reloadOn: this.changes },
  );

  /** The course's quizzes, for a quiz lesson to pick from. */
  private readonly quizzesData = serverData(
    (courseId: number) =>
      this.client.call(assessmentV1Endpoints.courseQuizList, {
        query: { courseId, size: 100 },
      }),
    { params: () => this.courseId() },
  );

  private readonly programsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listPrograms, {
        query: { ownerOrgId, size: 100 },
      }),
    { params: () => this.orgId() },
  );

  private readonly fieldId = computed(() => {
    const programId = this.state.programId();
    return (
      this.programsData.value()?.items.find((p) => p.id === programId)
        ?.fieldId ?? undefined
    );
  });

  private readonly modulesData = serverData(
    (fieldId: number) =>
      this.client.call(trainingCatalogEndpoints.listModules, {
        query: { fieldId, size: 100 },
      }),
    { params: () => this.fieldId() },
  );

  /** The units the course is already shared with; read only for a stored course. */
  private readonly sharesData = serverData(
    (courseId: number) =>
      this.client.call(courseEndpoints.shares, { params: { courseId } }),
    { params: () => this.courseId(), reloadOn: this.changes },
  );

  /** The units to share with: needed in create mode too, where the course has no shares yet. */
  private readonly orgsData = serverData(() =>
    this.client.call(organizationEndpoints.listOrgs, {
      query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
    }),
  );

  /** How many assignments the owner unit already made of the course ("Đã giao trước đó"). */
  private readonly assignmentsData = serverData(
    ({ courseId, orgId }: { courseId: number; orgId: number }) =>
      this.client.call(assignmentEndpoints.courseAssignments, {
        params: { courseId },
        query: { assigningOrgId: orgId, size: 1 },
      }),
    {
      params: () => {
        const courseId = this.courseId();
        const orgId = this.courseData.value()?.course.ownerOrgId;
        return courseId && orgId ? { courseId, orgId } : undefined;
      },
      reloadOn: this.changes,
    },
  );

  private readonly openDraftMutation = serverMutation(
    (courseId: number) =>
      this.client.call(courseEndpoints.openDraft, { params: { courseId } }),
    {
      errors: 'toast',
      success: () => 'Đã mở bản nháp để sửa',
      invalidates: this.changes,
    },
  );

  private readonly saveMutation = serverMutation(
    (command: SaveDraftCommand) => this.saveDraft(command),
    {
      errors: 'alert',
      success: () => 'Đã lưu nháp',
      onSuccess: () =>
        this.setSavedAt(
          new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
      invalidates: this.changes,
    },
  );

  /** "Lưu nháp" on a new course: it continues on the same step of the edit URL. */
  private readonly createMutation = this.newCreateMutation(() =>
    this.state.step(),
  );

  /** "Tiếp tục" on step 1 of a new course: the edit URL opens on step 2. */
  private readonly createAndContinueMutation = this.newCreateMutation(() => 1);

  /**
   * Saves the draft (or creates the course), then publishes the revision that came back. A refusal
   * to publish leaves the save done and the revision's version moved on, so the course is read
   * again: the next try then carries the version the server holds. A refusal after a create leaves
   * the new course behind, so the page moves on to its edit URL and says so. The assignment rows
   * and shares go with the publish and are all or nothing with it: a refusal that names a row
   * marks that row on step 4.
   */
  private readonly publishMutation = serverMutation(
    (input: PublishInput) => {
      this.setExamPublishError(null);
      this.setFailureShown(false);
      const saved$ =
        input.kind === 'create'
          ? this.createCourse(input.command)
          : this.saveDraft(input.command);
      return saved$.pipe(
        switchMap((saved) =>
          this.publishExam(input, saved).pipe(
            switchMap(() => this.publishCourse(input, saved)),
          ),
        ),
      );
    },
    {
      errors: 'alert',
      success: ({ targets }) => ({
        title: 'Đã xuất bản khóa học',
        detail:
          targets.rows.length || targets.shareOrgIds.length
            ? countsText(targets.rows.length, targets.shareOrgIds.length)
            : 'Học viên được giao thấy nội dung mới ngay.',
      }),
      onSuccess: () => {
        this.setLeft(true);
        this.clearPublishTargets();
        void this.router.navigate(['/admin/courses']);
      },
      invalidates: this.changes,
    },
  );

  constructor() {
    this.destroyRef.onDestroy(() =>
      this.running.forEach((upload) => upload.unsubscribe()),
    );
  }

  // Selectors
  readonly step$ = this.state.step.asReadonly();
  readonly visited$ = this.state.visited.asReadonly();
  /** The stepper's steps, each completed only while visited, valid and not open. */
  readonly steps$ = computed((): readonly StepperItem[] => {
    const done = completedSteps(
      EDITOR_STEPS.length,
      this.state.stepChecks(),
      this.state.visited(),
      this.state.step(),
    );
    return EDITOR_STEPS.map((step, index) => ({
      ...step,
      completed: done[index],
    }));
  });
  /** Steps holding a field whose error the author has been shown. */
  readonly invalidSteps$ = computed(() =>
    shownInvalidSteps(this.state.stepChecks()),
  );
  readonly editingLesson$ = this.state.editingLesson.asReadonly();
  readonly savedAt$ = this.state.savedAt.asReadonly();
  readonly left$ = this.state.left.asReadonly();

  /** True on `/admin/courses/new`: the draft is not stored until the first save. */
  readonly isCreate$ = computed(
    () => this.route.snapshot.data['mode'] === 'create',
  );
  /** Whether the user may open the quiz screen to author the course's final exam. */
  readonly canCreateQuiz$ = computed(() =>
    this.session.menus$().includes('QUIZ_MANAGEMENT'),
  );
  /** The code the last create was refused for, because it is taken. */
  readonly takenCode$ = this.state.takenCode.asReadonly();
  readonly ownerName$ = computed(() => this.session.user$()?.org?.name ?? '');

  readonly course$ = this.courseData.value;
  readonly isLoading$ = this.courseData.isLoading;
  readonly loadError$ = this.courseData.error;
  readonly isDraft$ = computed(
    () =>
      this.isCreate$() ||
      this.course$()?.revision.state.toLowerCase() === 'draft',
  );
  readonly status$ = computed(() => {
    const detail = this.course$();
    return detail
      ? courseCatalogStatus({
          publicationState: detail.course.publishedRevisionId
            ? 'published'
            : 'draft',
          lifecycleStatus: detail.course.lifecycleStatus,
        })
      : 'draft';
  });
  readonly quizzes$ = computed(() => this.quizzesData.value()?.items ?? []);
  readonly quizzesError$ = this.quizzesData.error;
  /** Why the exam of the last publish was refused: step 3 says so. */
  readonly examPublishError$ = this.state.examPublishError.asReadonly();
  /** The stored program of the course: where its exam's questions come from. */
  readonly storedProgram$ = computed(() => {
    const programId = this.courseData.value()?.revision.programId;
    return programId
      ? {
          id: programId,
          name: this.programsData.value()?.items.find((p) => p.id === programId)
            ?.name,
        }
      : undefined;
  });
  readonly programs$ = computed(() => this.programsData.value()?.items ?? []);
  readonly modules$ = computed(() =>
    this.fieldId() ? (this.modulesData.value()?.items ?? []) : [],
  );

  readonly isOpeningDraft$ = this.openDraftMutation.isPending;
  readonly isSaving$ = computed(
    () =>
      this.saveMutation.isPending() ||
      this.createMutation.isPending() ||
      this.createAndContinueMutation.isPending() ||
      this.publishMutation.isPending(),
  );
  /**
   * The last failure to show in the alert. A taken code is shown on the code field instead, and a
   * refusal that names a row or a share is shown on that row or unit.
   */
  readonly saveError$ = computed(() => {
    const error =
      this.saveMutation.error() ??
      this.createMutation.error() ??
      this.createAndContinueMutation.error() ??
      this.publishMutation.error();
    return error?.messageCode === DUPLICATE_CODE ||
      namesPublishRow(error?.fieldErrors) ||
      this.state.failureShown()
      ? undefined
      : error;
  });

  // Step 4: the rows, the reminder and the shares that go with the publish.
  readonly publishRows$ = this.state.publishRows.asReadonly();
  readonly reminderEnabled$ = this.state.reminderEnabled.asReadonly();
  readonly newShareOrgIds$ = this.state.newShareOrgIds.asReadonly();
  /** The unit that owns the course: its own while stored, else the author's. */
  readonly ownerOrgId$ = computed(
    () => this.course$()?.course.ownerOrgId ?? this.orgId(),
  );
  /** Each row with the line to show under it: the server's refusal, else what the form finds. */
  readonly rowViews$ = computed(() =>
    this.state.publishRows().map((row, index) => ({
      row,
      message: row.error ?? rowIssue(row, index),
    })),
  );
  readonly canAddRow$ = computed(
    () => this.state.publishRows().length < PUBLISH_LIMITS.assignments,
  );
  /** Assignments the owner unit already made of this course; undefined while unknown. */
  readonly assignmentCount$ = computed(
    () => this.assignmentsData.value()?.totalElements,
  );
  readonly shareUnits$ = computed((): readonly ShareUnit[] => {
    const ownerId = this.ownerOrgId$();
    const shared = new Set(
      (this.sharesData.value() ?? [])
        .filter((share) => share.status.toLowerCase() === 'active')
        .map((share) => share.orgId),
    );
    const ticked = new Set(this.state.newShareOrgIds());
    const errors = this.state.shareErrors();
    const full = ticked.size >= PUBLISH_LIMITS.shares;
    return (this.orgsData.value()?.items ?? [])
      .filter((org) => org.status.toLowerCase() === 'active')
      .map((org) => {
        const locked =
          org.id === ownerId ? 'owner' : shared.has(org.id) ? 'shared' : null;
        const checked = locked !== null || ticked.has(org.id);
        return {
          orgId: org.id,
          name: org.name,
          locked,
          checked,
          full: full && !checked,
          ...(errors[org.id] ? { error: errors[org.id] } : {}),
        };
      });
  });
  readonly sharesError$ = computed(
    () => this.sharesData.error() ?? this.orgsData.error(),
  );

  /** The files chosen in this editor by block key, and where each one's upload stands. */
  readonly uploads$ = this.state.uploads.asReadonly();

  /** Files still on their way (the cover included): a block saved now would have no asset. */
  readonly pendingUploads$ = computed(
    () => Object.values(this.state.uploads()).filter(isBusy).length,
  );
  /** Whether the cover image is still on its way. */
  readonly coverUploading$ = computed(() =>
    isBusy(this.state.uploads()[COVER_KEY]),
  );

  /** The open lesson's blocks (by index) with an upload to continue; a running one is not listed. */
  readonly interrupted$ = computed(
    (): Readonly<Record<number, InterruptedUpload>> => {
      const target = this.state.editingLesson();
      if (!target) return {};
      const running = new Set(
        Object.values(this.state.uploads()).map((entry) => entry.uploadId),
      );
      const refusals = this.state.refusals();
      const prefix = `${target.chapter}.${target.lesson}.`;
      return Object.fromEntries(
        this.state
          .kept()
          .filter(
            (upload) =>
              upload.position.startsWith(prefix) &&
              !running.has(upload.uploadId),
          )
          .map((upload) => [
            Number(upload.position.slice(prefix.length)),
            { ...upload, message: refusals[upload.uploadId] },
          ]),
      );
    },
  );

  // Setters
  private setStep(step: number): void {
    this.state.step.set(step);
  }

  private setVisited(visited: readonly number[]): void {
    this.state.visited.set(visited);
  }

  private setPublishedExamId(id: number | null): void {
    this.state.publishedExamId.set(id);
  }

  private setExamPublishError(error: AppError | null): void {
    this.state.examPublishError.set(error);
  }

  private setFailureShown(shown: boolean): void {
    this.state.failureShown.set(shown);
  }

  private setExamAttacher(attach: ((quizId: number) => void) | null): void {
    this.state.examAttacher.set(attach);
  }

  private setAssetAttacher(
    attach: ((blockKey: string, asset: AssetValue) => void) | null,
  ): void {
    this.state.assetAttacher.set(attach);
  }

  private setStepChecks(checks: readonly StepCheck[]): void {
    this.state.stepChecks.set(checks);
  }

  private setEditingLesson(target: LessonTarget | null): void {
    this.state.editingLesson.set(target);
  }

  private setSavedAt(at: string | null): void {
    this.state.savedAt.set(at);
  }

  private setLeft(left: boolean): void {
    this.state.left.set(left);
  }

  private setTakenCode(code: string | null): void {
    this.state.takenCode.set(code);
  }

  private setProgramId(programId: number | undefined): void {
    this.state.programId.set(programId);
  }

  private setPublishRows(rows: readonly PublishRow[]): void {
    this.state.publishRows.set(rows);
  }

  private setReminderEnabled(on: boolean): void {
    this.state.reminderEnabled.set(on);
  }

  private setNewShareOrgIds(orgIds: readonly number[]): void {
    this.state.newShareOrgIds.set(orgIds);
  }

  private setShareErrors(errors: Readonly<Record<number, string>>): void {
    this.state.shareErrors.set(errors);
  }

  private setUpload(key: string, entry: UploadEntry): void {
    this.state.uploads.update((all) => ({ ...all, [key]: entry }));
  }

  /** Changes a row that is still there: a late answer for a dismissed row is dropped. */
  private patchUpload(key: string, patch: Partial<UploadEntry>): void {
    this.state.uploads.update((all) =>
      all[key] ? { ...all, [key]: { ...all[key], ...patch } } : all,
    );
  }

  private removeUpload(key: string): void {
    this.state.uploads.update(
      ({ [key]: _gone, ...rest }) => rest as Record<string, UploadEntry>,
    );
  }

  private setKept(kept: readonly KeptUpload[]): void {
    this.state.kept.set(kept);
    const userId = this.userId();
    const courseId = this.courseId();
    if (userId && courseId) this.keptStorage.write(userId, courseId, kept);
  }

  private setRefusal(uploadId: string, message: string | undefined): void {
    this.state.refusals.update(({ [uploadId]: _old, ...rest }) =>
      message === undefined ? rest : { ...rest, [uploadId]: message },
    );
  }

  // Commands
  goToStep(step: number): void {
    const target = Math.max(0, Math.min(EDITOR_STEPS.length - 1, step));
    this.setStep(target);
    if (!this.state.visited().includes(target)) {
      this.setVisited([...this.state.visited(), target]);
    }
  }

  /** The page hands over how to check each step's fields, once, when it builds its form. */
  registerStepChecks(checks: readonly StepCheck[]): void {
    this.setStepChecks(checks);
  }

  /** The page hands over how a newly made final exam joins the draft (the form's field, then a save). */
  registerExamAttacher(attach: (quizId: number) => void): void {
    this.setExamAttacher(attach);
  }

  /**
   * The page hands over how a finished upload's asset joins its block of the draft, once. The
   * block is found by its key wherever it sits then, so moving things around mixes nothing up.
   */
  registerAssetAttacher(
    attach: (blockKey: string, asset: AssetValue) => void,
  ): void {
    this.setAssetAttacher(attach);
  }

  /** A final exam was made for this course: the draft references it, and the quizzes are read again. */
  attachExam(quizId: number): void {
    this.state.examAttacher()?.(quizId);
    this.quizzesData.reload();
  }

  /**
   * "Tiếp tục": shows the current step's errors and stays while it has any, else opens the next
   * step. Returns whether it moved, so the page can focus the first error when it did not.
   * Leaving step 1 of a new course stores it as a draft first (the page moves on to the edit URL
   * when that is done), so the later steps always have a course to attach to.
   */
  continue(draft: CourseDraftValue): boolean {
    const step = this.state.step();
    const check = this.state.stepChecks()[step];
    check?.touch();
    if (check?.invalid()) return false;
    if (this.isCreate$() && step === 0) {
      const command = this.createCommand(draft);
      if (!command) return false;
      this.createAndContinueMutation.run(command);
      return true;
    }
    this.goToStep(step + 1);
    return true;
  }

  /** The modules select lists the modules of the chosen program's field. */
  pickProgram(value: string): void {
    const id = Number(value);
    this.setProgramId(Number.isInteger(id) && id > 0 ? id : undefined);
  }

  /** Opens a lesson in the drawer; a published revision is not edited, so it stays shut. */
  editLesson(target: LessonTarget): void {
    if (!this.isDraft$()) return;
    this.setEditingLesson(target);
  }

  closeLesson(): void {
    this.setEditingLesson(null);
  }

  openDraft(): void {
    const courseId = this.course$()?.course.id;
    if (courseId) this.openDraftMutation.run(courseId);
  }

  save(command: Omit<SaveDraftCommand, 'expectedVersion'>): void {
    const revision = this.course$()?.revision;
    if (revision) {
      this.saveMutation.run({
        ...command,
        expectedVersion: revision.rowVersion,
      });
    }
  }

  /** The first save of a new course: it is created with the whole draft in one call. */
  create(value: CourseDraftValue): void {
    const command = this.createCommand(value);
    if (command) this.createMutation.run(command);
  }

  /** Asks first: learners in scope see the new content at once. */
  publish(command: Omit<SaveDraftCommand, 'expectedVersion'>): void {
    const revision = this.course$()?.revision;
    const targets = this.targetsToPublish();
    if (!revision || !targets) return;
    const exam = this.examToPublish(command.finalQuizId);
    this.confirmPublish(
      targets,
      () =>
        this.publishMutation.run({
          kind: 'save',
          command: { ...command, expectedVersion: revision.rowVersion },
          targets,
          exam,
        }),
      exam?.title,
    );
  }

  /** Publishing a course that is not stored yet creates it first, then publishes it. */
  createAndPublish(value: CourseDraftValue): void {
    const command = this.createCommand(value);
    const targets = this.targetsToPublish();
    if (!command || !targets) return;
    this.confirmPublish(targets, () =>
      this.publishMutation.run({ kind: 'create', command, targets }),
    );
  }

  /** "Thêm đối tượng": the picked target becomes a row starting today; a repeated pick is one row. */
  addPublishRow(pick: TargetPick): void {
    const rows = this.state.publishRows();
    if (!this.canAddRow$() || rows.some((row) => sameTarget(row.pick, pick))) {
      return;
    }
    this.setPublishRows([
      ...rows,
      {
        id: this.nextRowId++,
        pick,
        startDate: dateInput(this.now()),
        dueDate: '',
      },
    ]);
  }

  /** "Xóa dòng". */
  removePublishRow(id: number): void {
    this.setPublishRows(
      this.state.publishRows().filter((row) => row.id !== id),
    );
  }

  /** Changing a row clears the server's refusal of it. */
  setRowDates(
    id: number,
    dates: { startDate?: string; dueDate?: string },
  ): void {
    this.setPublishRows(
      this.state.publishRows().map((row) => {
        if (row.id !== id) return row;
        const { error: _refused, ...rest } = row;
        return { ...rest, ...dates };
      }),
    );
  }

  /** The switch applies to every new row. */
  setReminder(on: boolean): void {
    this.setReminderEnabled(on);
  }

  /** Ticks or unticks a unit to share the course with; owner and already shared units stay locked. */
  toggleShare(orgId: number, on: boolean): void {
    const unit = this.shareUnits$().find((u) => u.orgId === orgId);
    if (!unit || unit.locked || (on && unit.full)) return;
    const { [orgId]: _error, ...errors } = this.state.shareErrors();
    this.setShareErrors(errors);
    const others = this.state.newShareOrgIds().filter((id) => id !== orgId);
    this.setNewShareOrgIds(on ? [...others, orgId] : others);
  }

  /** Checks the file against the block's rules, then uploads it. */
  upload(request: UploadRequest): void {
    if (this.refuse(request)) return;
    this.begin(request);
  }

  /** The author picked the file of an interrupted upload again: it goes on where it stopped. */
  resume(request: UploadRequest): void {
    const kept = this.interrupted$()[request.blockIndex];
    if (!kept || kept.blockType !== request.blockType) {
      this.upload(request);
      return;
    }
    if (this.refuse(request)) return;
    this.begin(request, kept);
  }

  /** The author picked a file already in the library: it joins the block like a finished upload. */
  attach(pick: {
    readonly blockKey: string;
    readonly blockType: BlockType;
    readonly asset: LibraryAsset;
  }): void {
    const { blockKey, blockType, asset } = pick;
    this.release(blockKey);
    this.setUpload(blockKey, {
      state: 'done',
      name: asset.originalName,
      sizeBytes: asset.sizeBytes,
      asset: {
        assetId: asset.id,
        usage: FILE_USAGE[blockType] ?? 'attachment',
        name: asset.originalName,
        sizeBytes: asset.sizeBytes,
      },
    });
  }

  /** The cover image to show for the asset `assetId` names; an author reads it with no block. */
  coverPreview(assetId: () => number | null): Signal<CoverPreview> {
    return coverPreview(this.client, this.injector, assetId);
  }

  /** Checks a picked cover image against the image rules, then uploads it. */
  uploadCover(file: File): void {
    this.upload({
      blockKey: COVER_KEY,
      blockType: 'image',
      blockIndex: -1,
      file,
    });
  }

  /** A ready image of the library becomes the cover like a finished upload. */
  pickCover(asset: LibraryAsset): void {
    this.attach({ blockKey: COVER_KEY, blockType: 'image', asset });
  }

  /** Forgets the cover chosen in this page: a running upload stops, a finished one is dropped. */
  dropCover(): void {
    this.cancel(COVER_KEY);
  }

  /** "Hủy" on a row that is hashing or sending: stops it and cancels it on the server. */
  cancel(blockKey: string): void {
    this.release(blockKey);
    this.removeUpload(blockKey);
  }

  /** "Hủy" on an interrupted upload: the server forgets it. */
  cancelInterrupted(uploadId: string): void {
    this.cancelOnServer(uploadId);
    this.setRefusal(uploadId, undefined);
  }

  /** "Kiểm tra lại": asks the server whether it finished the file. */
  recheck(blockKey: string): void {
    const context = this.contexts.get(blockKey);
    const uploadId = this.state.uploads()[blockKey]?.uploadId;
    if (!context || !uploadId) return;
    this.patchUpload(blockKey, {
      state: 'processing',
      status: PROCESSING_STATUS,
      message: undefined,
    });
    this.follow(
      context,
      pollUpload(this.client, uploadId, { online: this.online }),
    );
  }

  /** "Xử lý lại": the server could not check the file the first time, so it completes again. */
  reprocess(blockKey: string): void {
    const context = this.contexts.get(blockKey);
    const uploadId = this.state.uploads()[blockKey]?.uploadId;
    if (!context || !uploadId) return;
    this.patchUpload(blockKey, {
      state: 'processing',
      status: PROCESSING_STATUS,
      message: undefined,
      reprocess: false,
    });
    this.follow(
      context,
      reprocessUpload(this.client, uploadId, { online: this.online }),
    );
  }

  retryLoad(): void {
    this.courseData.reload();
  }

  /** Reads the course's quizzes again (after a failed read, or a quiz made elsewhere). */
  reloadQuizzes(): void {
    this.quizzesData.reload();
  }

  /** Shows why the file is not acceptable for the block, or returns false when it is. */
  private refuse({ blockKey, blockType, file }: UploadRequest): boolean {
    const rule = UPLOAD_RULES[blockType];
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const base = { name: file.name, sizeBytes: file.size };
    const message =
      rule && !rule.extensions.includes(extension)
        ? `Sai định dạng: chỉ chấp nhận ${rule.extensions.join(', ').toUpperCase()}.`
        : rule && file.size > rule.maxMb * 1024 * 1024
          ? `Tệp vượt giới hạn ${rule.maxMb} MB.`
          : undefined;
    if (message === undefined) return false;
    this.release(blockKey);
    this.setUpload(blockKey, { ...base, state: 'error', message });
    return true;
  }

  private begin(request: UploadRequest, resumed?: KeptUpload): void {
    const { blockKey, blockType, blockIndex, file } = request;
    this.release(blockKey);
    const target = this.state.editingLesson();
    const position =
      target && blockKey !== COVER_KEY
        ? `${target.chapter}.${target.lesson}.${blockIndex}`
        : undefined;
    // A file picked over an interrupted upload replaces it: the old one is forgotten.
    for (const stale of this.state.kept()) {
      if (stale.position === position && stale.uploadId !== resumed?.uploadId) {
        this.cancelOnServer(stale.uploadId);
      }
    }
    const context: UploadContext = {
      blockKey,
      blockType,
      name: file.name,
      sizeBytes: file.size,
      position,
      resumed,
    };
    this.setUpload(blockKey, {
      state: 'hashing',
      name: file.name,
      sizeBytes: file.size,
      percent: 0,
      status: hashingStatus(0),
      uploadId: resumed?.uploadId,
    });
    this.follow(
      context,
      chunkedUpload(this.client, this.hasher, file, this.orgId() ?? 0, {
        resume: resumed,
        online: this.online,
      }),
    );
  }

  private follow(
    context: UploadContext,
    source: Observable<UploadProgress>,
  ): void {
    this.running.get(context.blockKey)?.unsubscribe();
    this.contexts.set(context.blockKey, context);
    this.running.set(
      context.blockKey,
      source.subscribe((event) => this.progressed(context, event)),
    );
  }

  private progressed(context: UploadContext, event: UploadProgress): void {
    const { blockKey } = context;
    switch (event.type) {
      case 'hashing':
        this.patchUpload(blockKey, {
          state: 'hashing',
          percent: event.percent,
          status: hashingStatus(event.percent),
        });
        return;
      case 'started':
        this.patchUpload(blockKey, { uploadId: event.uploadId });
        if (context.position) {
          this.setKept([
            ...this.state.kept().filter((k) => k.uploadId !== event.uploadId),
            {
              uploadId: event.uploadId,
              position: context.position,
              blockType: context.blockType,
              name: context.name,
              sizeBytes: context.sizeBytes,
              checksumSha256: event.checksumSha256,
              expiresAt: event.expiresAt,
            },
          ]);
        }
        return;
      case 'uploading':
        this.patchUpload(blockKey, {
          state: 'uploading',
          uploadId: event.uploadId,
          percent: Math.floor((event.uploadedBytes / event.totalBytes) * 100),
          status: sendingStatus(event.uploadedBytes, event.totalBytes),
        });
        return;
      case 'waiting':
        this.patchUpload(blockKey, {
          state: 'waiting',
          status: WAITING_STATUS,
        });
        return;
      case 'processing':
        this.patchUpload(blockKey, {
          state: 'processing',
          uploadId: event.uploadId,
          percent: undefined,
          status: PROCESSING_STATUS,
        });
        return;
      case 'stalled':
        this.patchUpload(blockKey, {
          state: 'stalled',
          uploadId: event.uploadId,
          status: undefined,
          message: STALLED_MESSAGE,
        });
        return;
      case 'ready':
        this.finished(context, event.upload.assetId, event.upload.uploadId);
        return;
      case 'failed':
        this.failed(context, event);
    }
  }

  private finished(
    context: UploadContext,
    assetId: number | null | undefined,
    uploadId: string,
  ): void {
    const { blockKey, blockType, name, sizeBytes } = context;
    this.running.delete(blockKey);
    this.dropKept(uploadId);
    if (!assetId) {
      this.setUpload(blockKey, {
        state: 'error',
        name,
        sizeBytes,
        message: 'Máy chủ không trả về tệp đã xử lý.',
      });
      return;
    }
    const asset: AssetValue = {
      assetId,
      usage: FILE_USAGE[blockType] ?? 'attachment',
      name,
      sizeBytes,
    };
    this.setUpload(blockKey, {
      state: 'done',
      name,
      sizeBytes,
      uploadId,
      asset,
    });
    if (blockKey !== COVER_KEY) this.state.assetAttacher()?.(blockKey, asset);
    this.toaster.success(
      'Tải lên thành công',
      `${name} · đã kiểm tra định dạng và dung lượng`,
    );
  }

  private failed(
    context: UploadContext,
    event: Extract<UploadProgress, { type: 'failed' }>,
  ): void {
    const { blockKey, name, sizeBytes, resumed } = context;
    this.running.delete(blockKey);
    const uploadId =
      this.state.uploads()[blockKey]?.uploadId ?? resumed?.uploadId;
    if (resumed && event.code === MISMATCH_CODE) {
      // The wrong file: the kept upload is untouched and still waits for the right one.
      this.removeUpload(blockKey);
      this.setRefusal(resumed.uploadId, MISMATCH_MESSAGE);
      return;
    }
    // A refusal from the app's own domain ends the upload; a network or system failure leaves it
    // on the server to be continued.
    const final =
      (event.code?.startsWith('LEARNING-') ?? false) && !event.retryProcessing;
    if (final && uploadId) this.dropKept(uploadId);
    this.setUpload(blockKey, {
      state: 'error',
      name,
      sizeBytes,
      uploadId,
      message: event.message,
      reprocess: event.retryProcessing,
      expired: event.code === EXPIRED_CODE,
    });
  }

  /** Stops the upload running on a block, and cancels it on the server while it is still sending. */
  private release(blockKey: string): void {
    this.running.get(blockKey)?.unsubscribe();
    this.running.delete(blockKey);
    const entry = this.state.uploads()[blockKey];
    if (entry?.uploadId && isCancellable(entry)) {
      this.cancelOnServer(entry.uploadId);
    }
  }

  /** The server forgets the upload; if it cannot be reached the upload simply expires there. */
  private cancelOnServer(uploadId: string): void {
    this.dropKept(uploadId);
    cancelUpload(this.client, uploadId).subscribe({ error: () => undefined });
  }

  private dropKept(uploadId: string): void {
    if (this.state.kept().some((k) => k.uploadId === uploadId)) {
      this.setKept(this.state.kept().filter((k) => k.uploadId !== uploadId));
    }
    this.setRefusal(uploadId, undefined);
  }

  /**
   * Waits for the network to come back, never less than the pause between two tries; a cancelled
   * upload (`signal`) stops the wait at once so it holds nothing.
   */
  private readonly online = async (signal: AbortSignal): Promise<void> => {
    const cancelled = new Observable<void>((subscriber) => {
      const stop = () => {
        subscriber.next();
        subscriber.complete();
      };
      if (signal.aborted) stop();
      else signal.addEventListener('abort', stop, { once: true });
      return () => signal.removeEventListener('abort', stop);
    });
    await firstValueFrom(
      timer(SERVER_RETRY_MS).pipe(
        switchMap(() =>
          toObservable(this.network.offline$, { injector: this.injector }),
        ),
        filter((offline) => !offline),
        takeUntil(cancelled),
      ),
      { defaultValue: undefined },
    );
  };

  /**
   * What the publish carries, or null while a row is not valid: step 4 then shows the line under
   * the row and nothing is sent.
   */
  private targetsToPublish(): PublishTargets | null {
    const rows = this.state.publishRows();
    if (rows.some((row, index) => rowIssue(row, index))) {
      this.goToStep(EDITOR_STEPS.length - 1);
      return null;
    }
    return {
      rows,
      reminderEnabled: this.state.reminderEnabled(),
      shareOrgIds: this.state.newShareOrgIds(),
    };
  }

  private clearPublishTargets(): void {
    this.setPublishRows([]);
    this.setNewShareOrgIds([]);
    this.setShareErrors({});
  }

  /** Marks the rows and shares a refusal names, and clears the marks of the last try. */
  private markRefused(error: unknown, targets: PublishTargets): void {
    const refused = refusedRows(toAppError(error).fieldErrors ?? [], targets);
    this.setPublishRows(
      this.state.publishRows().map(({ error: _old, ...row }) => {
        const message = refused.rows.get(row.id);
        return message ? { ...row, error: message } : row;
      }),
    );
    this.setShareErrors(Object.fromEntries(refused.shares));
  }

  /** The toast text when the page leaves step 4: the server's line, with the row it belongs to. */
  private refusalText(error: unknown, targets: PublishTargets): string {
    const { title, message, fieldErrors = [] } = toAppError(error);
    const refused = refusedRows(fieldErrors, targets);
    const lines = [
      ...targets.rows.flatMap((row, index) =>
        refused.rows.has(row.id)
          ? [`Dòng ${index + 1}: ${refused.rows.get(row.id)}`]
          : [],
      ),
      ...targets.shareOrgIds.flatMap((orgId) => {
        const text = refused.shares.get(orgId);
        const name = this.shareUnits$().find((u) => u.orgId === orgId)?.name;
        return text ? [`${name ?? 'Đơn vị'}: ${text}`] : [];
      }),
    ];
    return lines.length
      ? `${lines.join(' ')} Thêm lại đối tượng và đơn vị ở bước 4.`
      : title
        ? `${title}: ${message}`
        : message;
  }

  private confirmPublish(
    targets: PublishTargets,
    publish: () => void,
    examTitle?: string,
  ): void {
    const counts =
      targets.rows.length || targets.shareOrgIds.length
        ? ` ${countsText(targets.rows.length, targets.shareOrgIds.length)}`
        : '';
    confirm(this.dialog, {
      title: 'Xuất bản khóa học?',
      message: `Bản nháp được lưu rồi xuất bản. Học viên được giao thấy nội dung mới ngay, tiến độ đã có được giữ.${counts}${
        examTitle
          ? ` Bài thi cuối khóa “${examTitle}” sẽ được xuất bản cùng khóa học.`
          : ''
      }`,
      confirmLabel: 'Xuất bản',
      tone: 'primary',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(publish);
  }

  private createCommand(value: CourseDraftValue): CreateCourseCommand | null {
    const ownerOrgId = this.orgId();
    return ownerOrgId
      ? toCreateCourseCommand(value, value.code, ownerOrgId)
      : null;
  }

  /** A taken code goes back to the code field, on the first step; other failures are the alert's. */
  private createCourse(command: CreateCourseCommand): Observable<CourseDetail> {
    return this.client
      .call(courseEndpoints.createCourse, { body: command })
      .pipe(
        catchError((error: unknown) => {
          if (toAppError(error).messageCode === DUPLICATE_CODE) {
            this.setTakenCode(command.code);
            this.goToStep(0);
          }
          return throwError(() => error);
        }),
      );
  }

  /**
   * The exam the course publish brings along: the draft's final exam when it is a draft the
   * wizard manages (a `FIXED` one is the author's own and is published on the quiz screen), and
   * not one this page already published on an earlier try.
   */
  private examToPublish(
    finalQuizId: number | undefined,
  ): { id: number; title: string } | undefined {
    const exam = this.quizzesData
      .value()
      ?.items.find((quiz) => quiz.id === finalQuizId);
    return exam &&
      exam.status === 'DRAFT' &&
      exam.selectionMode !== 'FIXED' &&
      exam.id !== this.state.publishedExamId()
      ? { id: exam.id, title: exam.title }
      : undefined;
  }

  /**
   * Fills the exam's pool from the bank as it is now, then publishes it. A refusal stops the
   * publish: the course stays a draft and step 3 shows the reason.
   */
  private publishExam(
    input: PublishInput,
    saved: CourseDetail,
  ): Observable<unknown> {
    const exam = input.exam;
    const programId = saved.revision.programId;
    if (input.kind !== 'save' || !exam || !programId) return of(null);
    return syncExamPool(this.client, exam.id, {
      programId,
      courseId: saved.course.id,
    }).pipe(
      switchMap((pool) =>
        this.client.call(assessmentV1Endpoints.publishQuiz, {
          params: { id: exam.id },
          body: { expectedVersion: pool.quiz.rowVersion },
        }),
      ),
      tap(() => this.setPublishedExamId(exam.id)),
      catchError((error: unknown) => {
        this.setExamPublishError(toAppError(error));
        this.setFailureShown(true);
        this.goToStep(2);
        this.changes.bump();
        this.quizzesData.reload();
        return throwError(() => error);
      }),
    );
  }

  private publishCourse(input: PublishInput, saved: CourseDetail) {
    return this.client
      .call(courseEndpoints.publish, {
        params: {
          courseId: saved.course.id,
          revisionId: saved.revision.id,
        },
        body: toPublishCommand(saved.revision.rowVersion, input.targets),
      })
      .pipe(
        catchError((error: unknown) => {
          this.markRefused(error, input.targets);
          if (input.kind === 'create') {
            this.toaster.error(
              'Đã lưu nháp, chưa xuất bản',
              this.refusalText(error, input.targets),
            );
            this.moveToEditor(saved);
          } else {
            this.changes.bump();
            if (input.exam && input.exam.id === this.state.publishedExamId()) {
              this.toaster.error(
                'Bài thi đã xuất bản, khóa học chưa xuất bản',
                this.refusalText(error, input.targets),
              );
              this.setFailureShown(true);
              this.quizzesData.reload();
            }
          }
          return throwError(() => error);
        }),
      );
  }

  /**
   * The course exists now: leaving does not ask, and the page continues as the edit screen of the
   * new course, on the same step, without a history entry for `/new`.
   */
  private moveToEditor(
    created: CourseDetail,
    step: number = this.state.step(),
  ): void {
    this.setLeft(true);
    void this.router.navigate(['/admin/courses', created.course.id, 'edit'], {
      replaceUrl: true,
      queryParams: { step },
    });
  }

  private newCreateMutation(landOn: () => number) {
    return serverMutation(
      (command: CreateCourseCommand) => this.createCourse(command),
      {
        errors: 'alert',
        success: () => 'Đã lưu nháp',
        onSuccess: (created) => this.moveToEditor(created, landOn()),
      },
    );
  }

  /** The step the URL names (`?step=`), read once when the editor opens. */
  private initialStep(): number {
    const step = Number(this.route.snapshot.queryParamMap.get('step'));
    return Number.isInteger(step)
      ? Math.max(0, Math.min(EDITOR_STEPS.length - 1, step))
      : 0;
  }

  private saveDraft(command: SaveDraftCommand) {
    const detail = this.course$();
    return this.client.call(courseEndpoints.saveDraft, {
      params: {
        courseId: detail?.course.id ?? 0,
        revisionId: detail?.revision.id ?? 0,
      },
      body: command,
    });
  }
}
