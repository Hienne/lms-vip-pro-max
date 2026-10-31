import type {
  AssetUsage,
  BlockDetail,
  BlockInput,
  BlockType,
  CompletionMode,
  CourseDetail,
  CourseLevel,
  LessonDetail,
  LessonType,
  Requirement,
  SaveDraftCommand,
} from '@lms/contracts';
import type { IconName } from '@lms/ui';

// The course editor's form model and its adapters. The backend saves the whole tree at once and
// issues new ids on every save, so the editor keys rows with its own `key`, and every save is
// followed by a fresh read that becomes the new model.

export interface AssetValue {
  readonly assetId: number;
  readonly usage: AssetUsage;
  readonly name: string;
  readonly sizeBytes: number;
}

export interface StepValue {
  readonly title: string;
  readonly description: string;
}

export interface BlockValue {
  readonly key: string;
  readonly blockType: BlockType;
  readonly title: string;
  /** Markdown for a text block, the caption of an image. */
  readonly body: string;
  readonly completionMode: CompletionMode;
  readonly completionThreshold: number | null;
  readonly isRequired: boolean;
  readonly assets: readonly AssetValue[];
  readonly steps: readonly StepValue[];
}

export interface LessonValue {
  readonly key: string;
  readonly title: string;
  readonly lessonType: LessonType;
  /** The quiz a quiz lesson holds; `null` until one is chosen, and always `null` for a content lesson. */
  readonly quizId: number | null;
  readonly minutes: number;
  readonly isRequired: boolean;
  readonly blocks: readonly BlockValue[];
}

export interface ChapterValue {
  readonly key: string;
  readonly title: string;
  readonly lessons: readonly LessonValue[];
}

export interface CourseDraftValue {
  readonly title: string;
  readonly summary: string;
  /** Select values: an id, or '' for none. */
  readonly programId: string;
  readonly moduleId: string;
  readonly level: CourseLevel | '';
  readonly defaultRequirement: Requirement;
  readonly coverIcon: string;
  readonly objectives: readonly string[];
  readonly rewardPoints: number;
  readonly chapters: readonly ChapterValue[];
}

/** The mockup's `BTYPES`: icon and label of each block type, in the order the chips offer them. */
export const BLOCK_TYPES: Readonly<
  Record<BlockType, { readonly icon: IconName; readonly label: string }>
> = {
  video: { icon: 'video', label: 'Video' },
  pdf: { icon: 'file-text', label: 'Tài liệu PDF' },
  text: { icon: 'file', label: 'Văn bản / Markdown' },
  process: { icon: 'workflow', label: 'Quy trình từng bước' },
  image: { icon: 'image', label: 'Hình ảnh' },
  attachment: { icon: 'paperclip', label: 'Tệp đính kèm' },
};

/** How a new block of each type counts as done; the server measures it. */
const COMPLETION: Record<BlockType, CompletionMode> = {
  video: 'video_coverage',
  pdf: 'pdf_end',
  text: 'manual',
  process: 'manual',
  image: 'open',
  attachment: 'open',
};

/** The block types that hold a file, and the usage the file takes. */
export const FILE_USAGE: Partial<Record<BlockType, AssetUsage>> = {
  video: 'primary',
  pdf: 'primary',
  image: 'image',
  attachment: 'attachment',
};

/** The mockup's cover icons. */
export const COVER_ICONS: readonly IconName[] = [
  'layers',
  'workflow',
  'clock',
  'building-2',
  'database',
  'shield',
];

let lastKey = 0;
/** A row key the editor owns; the server's ids change on every save. */
export const newKey = (): string => `k${++lastKey}`;

export function newBlock(blockType: BlockType): BlockValue {
  return {
    key: newKey(),
    blockType,
    title: BLOCK_TYPES[blockType].label,
    body: '',
    completionMode: COMPLETION[blockType],
    completionThreshold: blockType === 'video' ? 80 : null,
    isRequired: true,
    assets: [],
    steps: [],
  };
}

export function newLesson(position: number): LessonValue {
  return {
    key: newKey(),
    title: `Bài ${position}`,
    lessonType: 'content',
    quizId: null,
    minutes: 10,
    isRequired: true,
    blocks: [],
  };
}

export function newChapter(position: number): ChapterValue {
  return { key: newKey(), title: `Chương ${position}`, lessons: [] };
}

// ---- server → model --------------------------------------------------------------------------

function toBlockValue({ block, assets, steps }: BlockDetail): BlockValue {
  const caption = assets.find((a) => a.usage.usage === 'image')?.usage.caption;
  return {
    key: newKey(),
    blockType: block.blockType,
    title: block.title,
    body: block.blockType === 'image' ? (caption ?? '') : (block.body ?? ''),
    completionMode: block.completionMode,
    completionThreshold: block.completionThreshold ?? null,
    isRequired: block.isRequired ?? true,
    assets: assets.map(({ usage, asset }) => ({
      assetId: asset.id,
      usage: usage.usage,
      name: asset.originalName,
      sizeBytes: asset.sizeBytes,
    })),
    steps: steps.map((s) => ({
      title: s.title,
      description: s.description ?? '',
    })),
  };
}

function toLessonValue({ lesson, blocks }: LessonDetail): LessonValue {
  return {
    key: newKey(),
    title: lesson.title,
    lessonType: lesson.lessonType,
    quizId: lesson.lessonType === 'quiz' ? (lesson.quizId ?? null) : null,
    minutes: Math.round((lesson.estimatedDurationSeconds ?? 0) / 60),
    isRequired: lesson.isRequired ?? true,
    blocks: blocks.map(toBlockValue),
  };
}

export function toDraftValue(detail: CourseDetail): CourseDraftValue {
  const { revision } = detail;
  return {
    title: revision.title ?? '',
    summary: revision.summary ?? '',
    programId: revision.programId ? String(revision.programId) : '',
    moduleId: revision.moduleId ? String(revision.moduleId) : '',
    level: revision.level ?? '',
    defaultRequirement: revision.defaultRequirement ?? 'mandatory',
    coverIcon: revision.coverIcon ?? '',
    objectives: detail.objectives.map((o) => o.description),
    rewardPoints: detail.completionRule?.rewardPoints ?? 0,
    chapters: detail.chapters.map(({ chapter, lessons }) => ({
      key: newKey(),
      title: chapter.title,
      lessons: lessons.map(toLessonValue),
    })),
  };
}

// ---- model → server --------------------------------------------------------------------------

function toBlockInput(block: BlockValue): BlockInput {
  const text = block.body.trim();
  return {
    blockType: block.blockType,
    title: block.title.trim(),
    ...(block.blockType === 'text' && text
      ? { body: text, bodyFormat: 'markdown' as const }
      : {}),
    completionMode: block.completionMode,
    ...(block.completionThreshold
      ? { completionThreshold: block.completionThreshold }
      : {}),
    isRequired: block.isRequired,
    assets: block.assets.map((a) => ({
      assetId: a.assetId,
      usage: a.usage,
      ...(block.blockType === 'image' && text ? { caption: text } : {}),
    })),
    steps: block.steps
      .filter((s) => s.title.trim())
      .map((s) => ({
        title: s.title.trim(),
        ...(s.description.trim() ? { description: s.description.trim() } : {}),
      })),
  };
}

const idOf = (value: string): number | undefined => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

/** The whole tree as the save command spells it; empty optional fields are left out. */
export function toSaveDraftCommand(
  value: CourseDraftValue,
  expectedVersion: number,
): SaveDraftCommand {
  const programId = idOf(value.programId);
  const moduleId = idOf(value.moduleId);
  return {
    expectedVersion,
    ...(programId ? { programId } : {}),
    ...(moduleId ? { moduleId } : {}),
    ...(value.title.trim() ? { title: value.title.trim() } : {}),
    ...(value.summary.trim() ? { summary: value.summary.trim() } : {}),
    ...(value.level ? { level: value.level } : {}),
    defaultRequirement: value.defaultRequirement,
    ...(value.coverIcon ? { coverIcon: value.coverIcon } : {}),
    objectives: value.objectives.map((o) => o.trim()).filter(Boolean),
    rewardPoints: Math.max(0, Math.round(value.rewardPoints || 0)),
    chapters: value.chapters.map((chapter) => ({
      title: chapter.title.trim(),
      lessons: chapter.lessons.map((lesson) => ({
        title: lesson.title.trim(),
        lessonType: lesson.lessonType,
        ...(lesson.lessonType === 'quiz' && lesson.quizId
          ? { quizId: lesson.quizId }
          : {}),
        estimatedDurationSeconds: Math.max(0, Math.round(lesson.minutes * 60)),
        isRequired: lesson.isRequired,
        blocks:
          lesson.lessonType === 'quiz' ? [] : lesson.blocks.map(toBlockInput),
      })),
    })),
  };
}

// ---- derived facts ---------------------------------------------------------------------------

/** A content lesson needs a block and its files; a quiz lesson needs its quiz. */
export function lessonProblem(lesson: LessonValue): string | null {
  if (lesson.lessonType === 'quiz') {
    return lesson.quizId ? null : 'Chưa chọn bài kiểm tra';
  }
  if (!lesson.blocks.length) return 'Thiếu nội dung';
  const missing = lesson.blocks.find(
    (b) =>
      b.blockType !== 'attachment' &&
      FILE_USAGE[b.blockType] &&
      !b.assets.length,
  );
  return missing ? 'Thiếu tệp' : null;
}

export interface DraftCheck {
  readonly label: string;
  readonly ok: boolean;
  /** The step that fixes it. */
  readonly step: number;
  /** Recommended, not required to publish. */
  readonly optional?: boolean;
}

/** The mockup's "Kiểm tra trước khi xuất bản"; the server still checks on publish. */
export function draftChecks(value: CourseDraftValue): readonly DraftCheck[] {
  const lessons = value.chapters.flatMap((c) => c.lessons);
  return [
    {
      label: 'Có tên khóa học và chương trình',
      ok: !!value.title.trim() && !!value.programId,
      step: 0,
    },
    { label: 'Có ít nhất 1 bài học', ok: lessons.length > 0, step: 1 },
    {
      label: 'Mọi bài học có nội dung, đủ tệp hoặc đã chọn bài kiểm tra',
      ok: lessons.every((l) => !lessonProblem(l)),
      step: 1,
    },
    {
      label: 'Có mục tiêu đầu ra (khuyến nghị)',
      ok: value.objectives.some((o) => o.trim()),
      step: 0,
      optional: true,
    },
  ];
}

export function draftTotals(value: CourseDraftValue) {
  const lessons = value.chapters.flatMap((c) => c.lessons);
  return {
    chapters: value.chapters.length,
    lessons: lessons.length,
    minutes: lessons.reduce((sum, l) => sum + (l.minutes || 0), 0),
  };
}
