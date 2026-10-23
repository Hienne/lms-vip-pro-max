import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  applyEach,
  form,
  FormField,
  FormRoot,
  max,
  maxLength,
  min,
  required,
} from '@angular/forms/signals';
import { BlockTypeSchema, COURSE_LIMITS, type BlockType } from '@lms/contracts';
import {
  Alert,
  Button,
  Dropzone,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  Textarea,
  UploadItem,
} from '@lms/ui';
import {
  BLOCK_TYPES,
  FILE_USAGE,
  newBlock,
  type AssetValue,
  type BlockValue,
  type LessonValue,
} from '../../course-draft';
import {
  acceptOf,
  uploadHintOf,
  type UploadEntry,
  type UploadRequest,
} from '../../data-access/course-editor.store';
import { readFileFacts } from './file-facts';

/** A block as the form edits it: process steps as one line each, "Tiêu đề | Mô tả". */
type BlockFormValue = Omit<BlockValue, 'steps'> & { stepsText: string };
type LessonFormValue = Omit<LessonValue, 'blocks'> & {
  blocks: BlockFormValue[];
};

const toFormValue = (lesson: LessonValue): LessonFormValue => ({
  ...lesson,
  blocks: lesson.blocks.map(({ steps, ...block }) => ({
    ...block,
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

/**
 * The lesson drawer (the mockup's `lessonDrawer`): title, length, kind and the content blocks,
 * each with its file, text or steps. A file is uploaded as soon as it is chosen and joins its
 * block when the lesson is applied; "Áp dụng" changes the course draft, "Lưu nháp" saves it.
 */
@Component({
  selector: 'app-lesson-form',
  imports: [
    Alert,
    Button,
    Dropzone,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    Select,
    Textarea,
    UploadItem,
  ],
  templateUrl: './lesson-form.html',
  styleUrl: './lesson-form.scss',
})
export class LessonForm {
  readonly lesson = input.required<LessonValue>();
  /** Files chosen in this editor, by block key. */
  readonly uploads = input.required<Readonly<Record<string, UploadEntry>>>();
  readonly submitted = output<LessonValue>();
  readonly upload = output<UploadRequest>();

  protected readonly blockTypes = BLOCK_TYPES;
  protected readonly addable = BlockTypeSchema.options;
  protected readonly acceptOf = acceptOf;
  protected readonly uploadHintOf = uploadHintOf;
  protected readonly holdsFile = (type: BlockType) => !!FILE_USAGE[type];

  private readonly model = linkedSignal(() => toFormValue(this.lesson()));
  protected readonly lessonForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Nhập tên bài học.' });
      maxLength(path.title, COURSE_LIMITS.title, {
        message: `Tên bài học tối đa ${COURSE_LIMITS.title} ký tự.`,
      });
      required(path.minutes, { message: 'Nhập thời lượng.' });
      min(path.minutes, 1, { message: 'Thời lượng từ 1 phút.' });
      max(path.minutes, COURSE_LIMITS.lessonSeconds / 60, {
        message: 'Thời lượng tối đa 24 giờ.',
      });
      applyEach(path.blocks, (block) => {
        required(block.title, { message: 'Nhập tiêu đề khối.' });
        maxLength(block.title, COURSE_LIMITS.title, {
          message: `Tiêu đề khối tối đa ${COURSE_LIMITS.title} ký tự.`,
        });
        maxLength(block.body, COURSE_LIMITS.body, {
          message: `Nội dung tối đa ${COURSE_LIMITS.body} ký tự.`,
        });
      });
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

  /** File blocks (attachments aside) without their file: the lesson cannot be applied. */
  protected readonly missingFiles = computed(() =>
    this.model().lessonType === 'quiz'
      ? []
      : this.model().blocks.filter(
          (b) =>
            b.blockType !== 'attachment' &&
            this.holdsFile(b.blockType) &&
            !this.files()[b.key]?.length,
        ),
  );

  protected addBlock(type: BlockType): void {
    const { steps: _steps, ...block } = newBlock(type);
    this.model.update((value) => ({
      ...value,
      blocks: [...value.blocks, { ...block, stepsText: '' }],
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

  protected removeBlock(index: number): void {
    this.model.update((value) => ({
      ...value,
      blocks: value.blocks.filter((_, i) => i !== index),
    }));
  }

  protected async choose(block: BlockFormValue, files: File[]): Promise<void> {
    const file = files[0];
    if (!file) return;
    const facts = await readFileFacts(file);
    this.upload.emit({
      blockKey: block.key,
      blockType: block.blockType,
      file,
      ...facts,
    });
  }

  private apply(): void {
    if (this.missingFiles().length) return;
    const value = this.model();
    const files = this.files();
    this.submitted.emit({
      ...value,
      title: value.title.trim(),
      blocks: value.blocks.map(({ stepsText, ...block }) => ({
        ...block,
        title: block.title.trim(),
        assets: files[block.key] ?? block.assets,
        steps: block.blockType === 'process' ? toSteps(stepsText) : [],
      })),
    });
  }
}

/** An attachment block collects files; the other file blocks hold one, the latest. */
function withUpload(
  block: BlockFormValue,
  upload: UploadEntry | undefined,
): readonly AssetValue[] {
  const asset = upload?.state === 'done' ? upload.asset : undefined;
  if (!asset) return block.assets;
  return block.blockType === 'attachment'
    ? [...block.assets.filter((a) => a.assetId !== asset.assetId), asset]
    : [asset];
}
