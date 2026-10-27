import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  courseEndpoints,
  trainingCatalogEndpoints,
  type BlockType,
  type LibraryAsset,
  type SaveDraftCommand,
} from '@lms/contracts';
import { confirm, Toaster, type StepperItem } from '@lms/ui';
import {
  filter,
  firstValueFrom,
  map,
  switchMap,
  type Observable,
  type Subscription,
} from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { NetworkStore } from '../../../../core/network/network.store';
import { SessionStore } from '../../../../core/session/session.store';
import { courseCatalogStatus } from '../../../../shared/status/catalog-status';
import { FILE_USAGE } from '../course-draft';
import {
  cancelUpload,
  chunkedUpload,
  pollUpload,
  reprocessUpload,
  SERVER_RETRY_MS,
  type UploadProgress,
} from './chunked-upload';
import { KeptUploads, type KeptUpload } from './kept-uploads.storage';
import { Sha256Hasher } from './sha256-hasher';
import {
  hashingStatus,
  isCancellable,
  MISMATCH_MESSAGE,
  PROCESSING_STATUS,
  sendingStatus,
  STALLED_MESSAGE,
  WAITING_STATUS,
  type UploadEntry,
} from './upload-entry';

export const EDITOR_STEPS: readonly StepperItem[] = [
  { label: 'Thông tin cơ bản', subtitle: 'Tên, chương trình, mục tiêu' },
  { label: 'Nội dung khóa học', subtitle: 'Chương, bài, khối nội dung' },
  { label: 'Hoàn thành & xuất bản', subtitle: 'Điểm thưởng, kiểm tra' },
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
 * The course editor (the mockup's `courseWizard`, edit mode). The server keeps one draft per
 * course and saves it whole; this store reads it, opens a draft from the published revision when
 * the author asks, saves, publishes and uploads files. The draft itself is the page's form model.
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
  /**
   * The uploads running in this page, by block key. Raw RxJS subscriptions on purpose: an upload
   * is a long stream with its own pauses and polls, not one request, so `serverMutation` (one run,
   * cancelled by the next) does not fit it.
   */
  private readonly running = new Map<string, Subscription>();
  /** What each running or stopped row needs to go on once the picked file is out of sight. */
  private readonly contexts = new Map<string, UploadContext>();

  private readonly state = {
    step: signal(0),
    editingLesson: signal<LessonTarget | null>(null),
    /** When the last save went through, as the page shows it ("14:05"). */
    savedAt: signal<string | null>(null),
    /** Set once the course is published, so leaving does not ask about unsaved changes. */
    left: signal(false),
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

  /** Saves the draft, then publishes the revision the save returned. */
  private readonly publishMutation = serverMutation(
    (command: SaveDraftCommand) =>
      this.saveDraft(command).pipe(
        switchMap((saved) =>
          this.client.call(courseEndpoints.publish, {
            params: {
              courseId: saved.course.id,
              revisionId: saved.revision.id,
            },
            body: { expectedVersion: saved.revision.rowVersion },
          }),
        ),
      ),
    {
      errors: 'alert',
      success: () => ({
        title: 'Đã xuất bản khóa học',
        detail: 'Học viên được giao thấy nội dung mới ngay.',
      }),
      onSuccess: () => {
        this.setLeft(true);
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
  readonly editingLesson$ = this.state.editingLesson.asReadonly();
  readonly savedAt$ = this.state.savedAt.asReadonly();
  readonly left$ = this.state.left.asReadonly();

  readonly course$ = this.courseData.value;
  readonly isLoading$ = this.courseData.isLoading;
  readonly loadError$ = this.courseData.error;
  readonly isDraft$ = computed(
    () => this.course$()?.revision.state.toLowerCase() === 'draft',
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
  readonly programs$ = computed(() => this.programsData.value()?.items ?? []);
  readonly modules$ = computed(() =>
    this.fieldId() ? (this.modulesData.value()?.items ?? []) : [],
  );

  readonly isOpeningDraft$ = this.openDraftMutation.isPending;
  readonly isSaving$ = computed(
    () => this.saveMutation.isPending() || this.publishMutation.isPending(),
  );
  readonly saveError$ = computed(
    () => this.saveMutation.error() ?? this.publishMutation.error(),
  );

  /** The files chosen in this editor by block key, and where each one's upload stands. */
  readonly uploads$ = this.state.uploads.asReadonly();

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

  private setEditingLesson(target: LessonTarget | null): void {
    this.state.editingLesson.set(target);
  }

  private setSavedAt(at: string | null): void {
    this.state.savedAt.set(at);
  }

  private setLeft(left: boolean): void {
    this.state.left.set(left);
  }

  private setProgramId(programId: number | undefined): void {
    this.state.programId.set(programId);
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
    this.setStep(Math.max(0, Math.min(EDITOR_STEPS.length - 1, step)));
  }

  /** The modules select lists the modules of the chosen program's field. */
  pickProgram(value: string): void {
    const id = Number(value);
    this.setProgramId(Number.isInteger(id) && id > 0 ? id : undefined);
  }

  editLesson(target: LessonTarget): void {
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

  /** Asks first: learners in scope see the new content at once. */
  publish(command: Omit<SaveDraftCommand, 'expectedVersion'>): void {
    const revision = this.course$()?.revision;
    if (!revision) return;
    confirm(this.dialog, {
      title: 'Xuất bản khóa học?',
      message:
        'Bản nháp được lưu rồi xuất bản. Học viên được giao thấy nội dung mới ngay, tiến độ đã có được giữ.',
      confirmLabel: 'Xuất bản',
      tone: 'primary',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.publishMutation.run({
          ...command,
          expectedVersion: revision.rowVersion,
        }),
      );
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
    const context: UploadContext = {
      blockKey,
      blockType,
      name: file.name,
      sizeBytes: file.size,
      position: target
        ? `${target.chapter}.${target.lesson}.${blockIndex}`
        : undefined,
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
    this.setUpload(blockKey, {
      state: 'done',
      name,
      sizeBytes,
      uploadId,
      asset: {
        assetId,
        usage: FILE_USAGE[blockType] ?? 'attachment',
        name,
        sizeBytes,
      },
    });
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

  /** Waits for the network to come back, never less than the pause between two tries. */
  private readonly online = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, SERVER_RETRY_MS));
    await firstValueFrom(
      toObservable(this.network.offline$, { injector: this.injector }).pipe(
        filter((offline) => !offline),
      ),
    );
  };

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
