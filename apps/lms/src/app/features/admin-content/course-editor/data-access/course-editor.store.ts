import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  courseEndpoints,
  trainingCatalogEndpoints,
  type BlockType,
  type SaveDraftCommand,
} from '@lms/contracts';
import { confirm, type StepperItem } from '@lms/ui';
import { filter, map, switchMap } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { courseCatalogStatus } from '../../../../shared/status/catalog-status';
import { FILE_USAGE, type AssetValue } from '../course-draft';

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

/** A file the author chose for a block, by the block's key. */
export interface UploadEntry {
  readonly state: 'uploading' | 'done' | 'error';
  readonly name: string;
  readonly sizeBytes: number;
  readonly asset?: AssetValue;
  readonly message?: string;
}

export interface UploadRequest {
  readonly blockKey: string;
  readonly blockType: BlockType;
  readonly file: File;
  /** What the author's file says, sent so the server can check coverage. */
  readonly durationSeconds?: number;
  readonly pageCount?: number;
}

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

  private readonly uploadMutation = serverMutation(
    (request: UploadRequest) =>
      this.client
        .call(courseEndpoints.uploadAsset, {
          query: {
            ownerOrgId: this.orgId() ?? 0,
            ...(request.durationSeconds
              ? { durationSeconds: request.durationSeconds }
              : {}),
            ...(request.pageCount ? { pageCount: request.pageCount } : {}),
          },
          body: { file: request.file },
        })
        .pipe(map((asset) => ({ request, asset }))),
    {
      errors: 'toast',
      success: ({ file }) => ({
        title: 'Tải lên thành công',
        detail: `${file.name} · đã kiểm tra định dạng và dung lượng`,
      }),
      onSuccess: ({ request, asset }) =>
        this.setUpload(request.blockKey, {
          state: 'done',
          name: asset.originalName,
          sizeBytes: asset.sizeBytes,
          asset: {
            assetId: asset.id,
            usage: FILE_USAGE[request.blockType] ?? 'attachment',
            name: asset.originalName,
            sizeBytes: asset.sizeBytes,
          },
        }),
    },
  );

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

  /** Uploads by block key; the one in flight shows as uploading, a refused one as an error. */
  readonly uploads$ = computed((): Readonly<Record<string, UploadEntry>> => {
    const pending = this.uploadMutation.isPending();
    const failure = this.uploadMutation.error();
    return Object.fromEntries(
      Object.entries(this.state.uploads()).map(([key, entry]) => [
        key,
        entry.state === 'uploading' && !pending
          ? {
              ...entry,
              state: 'error',
              message:
                failure?.message ?? 'Tải lên bị gián đoạn, hãy chọn lại tệp.',
            }
          : entry,
      ]),
    );
  });

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
    const { blockKey, blockType, file } = request;
    const rule = UPLOAD_RULES[blockType];
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const base = { name: file.name, sizeBytes: file.size };
    if (rule && !rule.extensions.includes(extension)) {
      this.setUpload(blockKey, {
        ...base,
        state: 'error',
        message: `Sai định dạng: chỉ chấp nhận ${rule.extensions.join(', ').toUpperCase()}.`,
      });
      return;
    }
    if (rule && file.size > rule.maxMb * 1024 * 1024) {
      this.setUpload(blockKey, {
        ...base,
        state: 'error',
        message: `Tệp vượt giới hạn ${rule.maxMb} MB.`,
      });
      return;
    }
    this.setUpload(blockKey, { ...base, state: 'uploading' });
    this.uploadMutation.run(request);
  }

  retryLoad(): void {
    this.courseData.reload();
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
