import { Dialog } from '@angular/cdk/dialog';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  applyEach,
  applyWhenValue,
  form,
  FormField,
  FormRoot,
  max,
  maxLength,
  min,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import {
  BlockTypeSchema,
  COURSE_LIMITS,
  type BlockType,
  type BodyFormat,
  type LibraryAsset,
  type QuizSummary,
} from '@lms/contracts';
import {
  Alert,
  Button,
  confirm,
  DrawerOutlet,
  Dropzone,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  SearchSelect,
  Textarea,
  UploadItem,
} from '@lms/ui';
import { AssetLibrary } from '../asset-library/asset-library';
import { LessonTextEditor } from './lesson-text-editor';
import { AssetLibraryStore } from '../asset-library/data-access/asset-library.store';
import {
  BLOCK_TYPES,
  FILE_USAGE,
  newBlock,
  withAsset,
  type AssetValue,
  type BlockValue,
  type LessonValue,
} from '../../course-draft';
import {
  acceptOf,
  CourseEditorStore,
  uploadHintOf,
} from '../../data-access/course-editor.store';
import {
  isBusy,
  isCancellable,
  itemState,
  UPLOADS_CANCELLED,
  type UploadEntry,
} from '../../data-access/upload-entry';
import { firstValueFrom } from 'rxjs';
import { lessonImageIds } from '../../../../../shared/content/markdown/lesson-html';
import { DOCUMENT } from '@angular/core';
import { LessonScormUploadStore } from './lesson-scorm-upload.store';

/** A block as the form edits it: process steps as one line each, "Tiêu đề | Mô tả". */
type BlockFormValue = Omit<BlockValue, 'steps' | 'bodyFormat'> & {
  bodyFormat: BodyFormat;
  stepsText: string;
};
type LessonFormValue = Omit<
  LessonValue,
  'blocks' | 'quizId' | 'scormPackageId' | 'scormCompletionRule'
> & {
  /** The chosen quiz's id as the select holds it; empty when none. */
  quizId: string;
  scormPackageId: string;
  scormCompletionRule: NonNullable<LessonValue['scormCompletionRule']>;
  blocks: BlockFormValue[];
};

const toFormValue = (lesson: LessonValue): LessonFormValue => ({
  ...lesson,
  scormPackageId: lesson.scormPackageId ? String(lesson.scormPackageId) : '',
  scormCompletionRule: lesson.scormCompletionRule ?? 'completed_or_passed',
  quizId: lesson.quizId === null ? '' : String(lesson.quizId),
  blocks: lesson.blocks.map(({ steps, ...block }) => ({
    ...block,
    bodyFormat: block.bodyFormat ?? 'markdown',
    stepsText: steps
      .map((s) => (s.description ? `${s.title} | ${s.description}` : s.title))
      .join('\n'),
  })),
});

const toSteps = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [title, ...rest] = line.split('|');
      return { title: title.trim(), description: rest.join('|').trim() };
    });

const QUIZ_TYPE: Record<QuizSummary['quizType'], string> = {
  PRACTICE: 'Luyện tập',
  FINAL_EXAM: 'Thi cuối khóa',
};

const QUIZ_STATUS: Record<QuizSummary['status'], string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã xuất bản',
  CLOSED: 'Đã đóng',
};

/** One quiz in the select; only a published quiz can be published with the course, the rest say so. */
const quizLabel = (quiz: QuizSummary): string =>
  quiz.status === 'PUBLISHED'
    ? `${quiz.title} · ${QUIZ_TYPE[quiz.quizType]}`
    : `${quiz.title} · ${QUIZ_TYPE[quiz.quizType]} · ${QUIZ_STATUS[quiz.status]}, chưa thể xuất bản`;

/**
 * The lesson drawer (the mockup's `lessonDrawer`): title, length, kind and the content blocks,
 * each with its file, text or steps. A file is uploaded as soon as it is chosen (the store runs
 * it, so it goes on while the drawer is closed); "Lưu" puts the lesson in the course draft even
 * while a file is still uploading, and the asset joins its block when the upload is done.
 * "Lưu nháp" saves the draft.
 */
@Component({
  selector: 'app-lesson-form',
  imports: [
    Alert,
    AssetLibrary,
    Button,
    DrawerOutlet,
    Dropzone,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    LessonTextEditor,
    Select,
    SearchSelect,
    Textarea,
    UploadItem,
  ],
  providers: [AssetLibraryStore, LessonScormUploadStore],
  templateUrl: './lesson-form.html',
  styleUrl: './lesson-form.scss',
})
export class LessonForm {
  readonly lesson = input.required<LessonValue>();
  readonly submitted = output<LessonValue>();

  protected readonly store = inject(CourseEditorStore);
  protected readonly scormUpload = inject(LessonScormUploadStore);
  protected readonly library = inject(AssetLibraryStore);
  private readonly dialog = inject(Dialog);
  private readonly document = inject(DOCUMENT);
  private readonly inlineUploads = signal<ReadonlySet<string>>(new Set());
  readonly inlineUploading$ = computed(
    () => this.inlineUploads().size > 0 || this.scormUpload.pending$(),
  );
  /** Files chosen in this editor, by block key. */
  protected readonly uploads = this.store.uploads$;
  /** Uploads a reload stopped, by the index of their block in this lesson. */
  protected readonly interrupted = this.store.interrupted$;
  protected readonly itemState = itemState;
  protected readonly isCancellable = isCancellable;
  protected readonly isBusy = isBusy;
  protected readonly blockTypes = BLOCK_TYPES;
  /** Two sample lines for an empty "Quy trình từng bước" block, so the format reads at a glance. */
  protected readonly processExample =
    'Kiểm tra hồ sơ | Đối chiếu giấy tờ tùy thân với thông tin trên hệ thống\nDuyệt giao dịch | Kiểm soát viên phê duyệt trên màn hình chờ duyệt';
  protected readonly addable = BlockTypeSchema.options;
  protected readonly mediaBlocks = [
    'image',
    'video',
    'pdf',
    'attachment',
  ] as const;
  protected readonly acceptOf = acceptOf;
  protected readonly uploadHintOf = uploadHintOf;
  protected readonly holdsFile = (type: BlockType) => !!FILE_USAGE[type];

  private readonly model = linkedSignal(() => toFormValue(this.lesson()));
  protected readonly lessonForm = form(
    this.model,
    (path) => {
      validate(path.scormPackageId, ({ value }) =>
        this.model().lessonType === 'scorm' && !value()
          ? {
              kind: 'required',
              message: 'Tải tệp ZIP hoặc chọn bài giảng SCORM từ thư viện.',
            }
          : undefined,
      );
      required(path.title, { message: 'Nhập tên bài học.' });
      validate(path.title, ({ value }) =>
        value() && !value().trim()
          ? { kind: 'blank', message: 'Nhập tên bài học.' }
          : undefined,
      );
      maxLength(path.title, COURSE_LIMITS.title, {
        message: `Tên bài học tối đa ${COURSE_LIMITS.title} ký tự.`,
      });
      required(path.minutes, { message: 'Nhập thời lượng.' });
      min(path.minutes, 1, { message: 'Thời lượng từ 1 phút.' });
      max(path.minutes, COURSE_LIMITS.lessonSeconds / 60, {
        message: 'Thời lượng tối đa 24 giờ.',
      });
      maxLength(path.blocks, COURSE_LIMITS.items, {
        message: `Tối đa ${COURSE_LIMITS.items} khối mỗi bài.`,
      });
      validate(path.blocks, () =>
        this.inlineUploads().size
          ? {
              kind: 'upload',
              message: 'Chờ tải ảnh trong nội dung hoàn tất trước khi lưu bài.',
            }
          : undefined,
      );
      applyWhenValue(
        path,
        (value) => value.lessonType === 'content',
        (content) => {
          applyEach(content.blocks, (block) => {
            required(block.title, { message: 'Nhập tiêu đề khối.' });
            validate(block.title, ({ value }) =>
              value() && !value().trim()
                ? { kind: 'blank', message: 'Nhập tiêu đề khối.' }
                : undefined,
            );
            maxLength(block.title, COURSE_LIMITS.title, {
              message: `Tiêu đề khối tối đa ${COURSE_LIMITS.title} ký tự.`,
            });
            maxLength(block.body, COURSE_LIMITS.body, {
              message: `Nội dung tối đa ${COURSE_LIMITS.body} ký tự.`,
            });
          });
        },
      );
    },
    { submission: { action: async () => this.apply() } },
  );

  /** Each block's files: what it had, plus what was uploaded here. */
  protected readonly files = computed(() => {
    const uploads = this.uploads();
    return Object.fromEntries(
      this.model().blocks.map((block) => [
        block.key,
        withUpload(block, uploads[block.key]),
      ]),
    );
  });

  /** What each Video Block's Transcript row shows: this session's file, else what the draft has. */
  protected readonly transcriptRows = computed(() => {
    const changes = this.store.transcripts$();
    return Object.fromEntries(
      this.model()
        .blocks.filter((block) => block.blockType === 'video')
        .map((block) => {
          const change = changes[block.key];
          const count = (change?.lines ?? block.transcript).length;
          return [
            block.key,
            {
              count,
              name: change?.name ?? `Đã có transcript · ${count} dòng`,
              status: change?.name
                ? `${count} dòng · ${change.timed ? 'có' : 'không có'} mốc thời gian`
                : undefined,
            },
          ];
        }),
    );
  });
  protected readonly transcriptRefusals = this.store.transcriptRefusals$;

  /** The course's quizzes to pick from; the chosen one stays listed even when it is no longer there. */
  protected readonly missingScormOption = computed(() => {
    const chosen = this.model().scormPackageId;
    return (
      chosen !== '' &&
      !this.store.scormPackages$().some((item) => String(item.id) === chosen)
    );
  });
  protected readonly scormOptions = computed(() => {
    const options = this.store.scormPackages$().map((item) => ({
      value: String(item.id),
      label: item.title + (item.published ? '' : ' (Nháp)'),
    }));
    const selected = this.model().scormPackageId;
    return this.missingScormOption()
      ? [
          ...options,
          { value: selected, label: `Bài giảng #${selected} (đang gắn)` },
        ]
      : options;
  });

  protected readonly selectedScorm = computed(() => {
    const id = Number(this.model().scormPackageId);
    const uploaded = this.scormUpload.lecture$();
    return uploaded?.id === id
      ? uploaded
      : this.store.scormPackages$().find((item) => item.id === id);
  });

  protected openScormLibrary(): void {
    this.scormUpload.setLibraryOpen(true);
    this.store.reloadScorm();
  }

  protected importScorm(files: readonly File[]): void {
    this.scormUpload.import(files[0], this.store.ownerOrgId$(), (lecture) => {
      this.model.update((value) => ({
        ...value,
        scormPackageId: String(lecture.id),
        title: value.title.trim() ? value.title : lecture.title,
      }));
    });
  }

  protected pickedScorm(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importScorm(Array.from(input.files ?? []));
    input.value = '';
  }

  protected readonly quizOptions = computed(() => {
    const options = this.store
      .quizzes$()
      .map((quiz) => ({ value: String(quiz.id), label: quizLabel(quiz) }));
    const chosen = this.model().quizId;
    return chosen && !options.some((o) => o.value === chosen)
      ? [
          ...options,
          {
            value: chosen,
            label: `Bài kiểm tra #${chosen} (không thuộc khóa học này)`,
          },
        ]
      : options;
  });

  /**
   * File blocks (attachments aside) with neither their file nor an upload on its way: the lesson
   * cannot be saved. A block whose file is still uploading is saved; the asset joins it when done.
   */
  protected readonly missingFiles = computed(() =>
    this.model().lessonType !== 'content'
      ? []
      : this.model().blocks.filter(
          (b) =>
            b.blockType !== 'attachment' &&
            this.holdsFile(b.blockType) &&
            !this.files()[b.key]?.length &&
            !isBusy(this.uploads()[b.key]),
        ),
  );

  /** The drawer's "Lưu" when it is not the footer button that was pressed; false while invalid. */
  save(): Promise<boolean> {
    if (this.scormUpload.pending$()) return Promise.resolve(false);
    return submit(this.lessonForm);
  }

  protected addBlock(
    type: BlockType,
    index = this.model().blocks.length,
  ): void {
    const { steps: _steps, ...block } = newBlock(type);
    this.model.update((value) => ({
      ...value,
      blocks: [
        ...value.blocks.slice(0, index),
        { ...block, bodyFormat: 'markdown', stepsText: '' },
        ...value.blocks.slice(index),
      ],
    }));
  }

  protected moveBlock(index: number, by: -1 | 1): void {
    this.model.update((value) => {
      const blocks = [...value.blocks];
      const [moved] = blocks.splice(index, 1);
      blocks.splice(index + by, 0, moved);
      return { ...value, blocks };
    });
  }

  /** Removes a block; one whose file is still uploading asks first, and its upload is stopped. */
  protected async removeBlock(key: string): Promise<void> {
    if (isBusy(this.uploads()[key])) {
      const confirmed = await firstValueFrom(
        confirm(this.dialog, {
          title: 'Xóa khối nội dung?',
          message: UPLOADS_CANCELLED,
          confirmLabel: 'Xóa khối',
          tone: 'danger',
        }),
      );
      if (!confirmed) return;
      this.store.cancelUploads([key]);
    }
    this.model.update((value) => ({
      ...value,
      blocks: value.blocks.filter((block) => block.key !== key),
    }));
    this.inlineUploading(key, false);
  }

  /** A file from the dropzone or a picker; with `resuming` it continues the interrupted upload. */
  protected choose(
    block: BlockFormValue,
    index: number,
    files: readonly File[],
    resuming = false,
  ): void {
    const file = files[0];
    if (!file) return;
    this.retainAttachments(block.key);
    const request = {
      blockKey: block.key,
      blockType: block.blockType,
      blockIndex: index,
      file,
    };
    if (resuming) this.store.resume(request);
    else this.store.upload(request);
  }

  /** The file a button's hidden input picked; the input is emptied so the same file can be picked again. */
  protected picked(
    event: Event,
    block: BlockFormValue,
    index: number,
    resuming = false,
  ): void {
    const input = event.target as HTMLInputElement;
    this.choose(block, index, Array.from(input.files ?? []), resuming);
    input.value = '';
  }

  /** The `.txt` file a Video Block's picker chose; the input is emptied so the same file can be picked again. */
  protected pickedTranscript(event: Event, blockKey: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.attachTranscript(blockKey, file);
  }

  protected imageAdded(key: string, asset: AssetValue): void {
    this.model.update((value) => ({
      ...value,
      blocks: value.blocks.map((block) =>
        block.key === key
          ? {
              ...block,
              assets: [
                ...block.assets.filter(
                  (existing) => existing.assetId !== asset.assetId,
                ),
                asset,
              ],
            }
          : block,
      ),
    }));
  }

  protected inlineUploading(key: string, pending: boolean): void {
    this.inlineUploads.update((keys) => {
      if (keys.has(key) === pending) return keys;
      const next = new Set(keys);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected prepareExam(): void {
    if (this.inlineUploading$() || this.store.lessonUploading$()) return;
    this.apply();
    this.store.goToStep(2);
  }

  /** A file picked from the library goes to the block like a finished upload. */
  protected useLibraryAsset(asset: LibraryAsset): void {
    const target = this.library.target$();
    if (!target) return;
    this.retainAttachments(target.blockKey);
    this.store.attach({ ...target, asset });
    this.library.close();
  }

  /** Keep completed attachments before the next upload replaces the block's live upload entry. */
  private retainAttachments(key: string): void {
    const files = this.files()[key];
    if (!files?.length) return;
    this.model.update((value) => ({
      ...value,
      blocks: value.blocks.map((block) =>
        block.key === key && block.blockType === 'attachment'
          ? { ...block, assets: files }
          : block,
      ),
    }));
  }

  private apply(): void {
    if (this.missingFiles().length || this.scormUpload.pending$()) return;
    const value = this.model();
    const files = this.files();
    this.submitted.emit({
      ...value,
      quizId:
        value.lessonType === 'quiz' && value.quizId
          ? Number(value.quizId)
          : null,
      scormPackageId:
        value.lessonType === 'scorm' && value.scormPackageId
          ? Number(value.scormPackageId)
          : null,
      scormCompletionRule:
        value.lessonType === 'scorm' ? value.scormCompletionRule : null,
      title: value.title.trim(),
      blocks: (value.lessonType === 'content' ? value.blocks : []).map(
        ({ stepsText, bodyFormat, ...block }) => ({
          ...block,
          transcript:
            this.store.transcripts$()[block.key]?.lines ?? block.transcript,
          ...(block.blockType === 'text' ? { bodyFormat } : {}),
          title: block.title.trim(),
          assets:
            block.blockType === 'text'
              ? block.assets.filter((asset) =>
                  lessonImageIds(block.body, this.document).includes(
                    asset.assetId,
                  ),
                )
              : (files[block.key] ?? block.assets),
          steps: block.blockType === 'process' ? toSteps(stepsText) : [],
        }),
      ),
    });
  }
}

/** An attachment block collects files; the other file blocks hold one, the latest. */
function withUpload(
  block: BlockFormValue,
  upload: UploadEntry | undefined,
): readonly AssetValue[] {
  const asset = upload?.state === 'done' ? upload.asset : undefined;
  return asset ? withAsset(block, asset).assets : block.assets;
}
