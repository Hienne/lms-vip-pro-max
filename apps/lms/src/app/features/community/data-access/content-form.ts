import {
  applyWhen,
  maxLength,
  validate,
  type SchemaPathTree,
} from '@angular/forms/signals';
import {
  COMMUNITY_LIMITS,
  AssetInputSchema,
  type ContentContextInput,
  type AssetInput,
  type RevisionDetail,
} from '@lms/contracts';
import type { DraftFields } from './content-authoring';

/** One "Công nghệ đang dùng" row. */
export interface TechnologyRow {
  name: string;
  version: string;
}

/** The incident fields of a lesson learned (CM-05). */
export interface LessonFields {
  occurredOn: string;
  symptoms: string;
  rootCause: string;
  resolution: string;
  prevention: string;
}

/** What the question, article and lesson forms edit; the server's own shape is built from it. */
export interface ContentFormValue {
  title: string;
  summary: string;
  bodyMarkdown: string;
  tagIds: number[];
  assets: AssetInput[];
  technologies: TechnologyRow[];
  environment: string;
  limitations: string;
  lesson: LessonFields;
  changeNote: string;
  review: {
    problem: string;
    constraints: string;
    decisions: string;
    dueAt: string;
  };
}

export const EMPTY_LESSON: LessonFields = {
  occurredOn: '',
  symptoms: '',
  rootCause: '',
  resolution: '',
  prevention: '',
};

export function emptyContentForm(): ContentFormValue {
  return {
    review: { problem: '', constraints: '', decisions: '', dueAt: '' },
    title: '',
    summary: '',
    bodyMarkdown: '',
    tagIds: [],
    assets: [],
    technologies: [],
    environment: '',
    limitations: '',
    lesson: { ...EMPTY_LESSON },
    changeNote: '',
  };
}

/** The form value of a draft the server sent, with the content's current tags. */
export function contentFormFrom(
  revision: RevisionDetail,
  tagIds: readonly number[],
): ContentFormValue {
  const context = (revision.context ?? {}) as ContentContextInput;
  const lesson = context.lessonLearned;
  return {
    review: {
      problem: context.review?.problem ?? '',
      constraints: context.review?.constraints ?? '',
      decisions: context.review?.decisionsNeeded?.join('\n') ?? '',
      dueAt: '',
    },
    title: revision.title ?? '',
    summary: revision.summary ?? '',
    bodyMarkdown: revision.bodyMarkdown ?? '',
    tagIds: [...tagIds],
    assets: (revision.assets ?? []).map((asset) =>
      AssetInputSchema.parse({
        assetId: asset.assetId,
        usage: asset.usage,
        ...(asset.caption != null ? { caption: asset.caption } : {}),
        ...(asset.altText != null ? { altText: asset.altText } : {}),
        sortNo: asset.sortNo ?? 0,
      }),
    ),
    technologies: (context.technologies ?? []).map((row) => ({
      name: row.name,
      version: row.version ?? '',
    })),
    environment: context.environment ?? '',
    limitations: context.limitations ?? '',
    lesson: lesson
      ? {
          occurredOn: lesson.occurredOn ?? '',
          symptoms: lesson.symptoms,
          rootCause: lesson.rootCause,
          resolution: lesson.resolution,
          prevention: lesson.prevention,
        }
      : { ...EMPTY_LESSON },
    changeNote: '',
  };
}

/**
 * The draft fields the server takes, built from the form. Empty optional fields are left out;
 * `lesson` adds `context.lessonLearned`, which only a lesson learned accepts.
 */
export function toDraftFields(
  value: ContentFormValue,
  options: {
    lesson?: boolean;
    review?: boolean;
    cover?: AssetInput | null;
    design?: AssetInput | null;
  } = {},
): DraftFields {
  const technologies = value.technologies
    .map((row) => ({ name: row.name.trim(), version: row.version.trim() }))
    .filter((row) => row.name)
    .map((row) => (row.version ? row : { name: row.name }));
  const context: ContentContextInput = {
    ...(options.review
      ? {
          review: {
            problem: value.review.problem,
            constraints: value.review.constraints,
            decisionsNeeded: value.review.decisions
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean),
          },
        }
      : {}),
    ...(technologies.length ? { technologies } : {}),
    ...(value.environment.trim()
      ? { environment: value.environment.trim() }
      : {}),
    ...(value.limitations.trim()
      ? { limitations: value.limitations.trim() }
      : {}),
    ...(options.lesson
      ? {
          lessonLearned: {
            ...(value.lesson.occurredOn
              ? { occurredOn: value.lesson.occurredOn }
              : {}),
            symptoms: value.lesson.symptoms,
            rootCause: value.lesson.rootCause,
            resolution: value.lesson.resolution,
            prevention: value.lesson.prevention,
          },
        }
      : {}),
  };
  return {
    title: value.title.trim(),
    bodyMarkdown: value.bodyMarkdown,
    ...(value.summary.trim() ? { summary: value.summary.trim() } : {}),
    context,
    assets: [
      ...value.assets.filter(
        (asset) =>
          (options.cover === undefined || asset.usage !== 'cover') &&
          (options.design === undefined || asset.usage !== 'design_file'),
      ),
      ...(options.cover ? [options.cover] : []),
      ...(options.design ? [options.design] : []),
    ],
    ...(value.changeNote.trim() ? { changeNote: value.changeNote.trim() } : {}),
  };
}

const L = COMMUNITY_LIMITS;

/** A rule set that is always on, always off, or on while the signal it reads is true. */
export type RuleToggle = boolean | (() => boolean);

/**
 * The rules the server checks at publish (`NOT_PUBLISHABLE` names no field, so the form says
 * which one). A draft saves without them; "Đăng" submits the form, which runs them first.
 */
export function publishRules(
  path: SchemaPathTree<ContentFormValue>,
  options: { tags: RuleToggle; lesson: RuleToggle; title?: RuleToggle },
): void {
  // An answer has no title field: the server's title is made from the question's.
  when(path, options.title ?? true, (p) =>
    validate(p.title, ({ value }) =>
      value().trim().length < L.title.min
        ? {
            kind: 'publishTitle',
            message: `Tiêu đề cần ít nhất ${L.title.min} ký tự.`,
          }
        : undefined,
    ),
  );
  maxLength(path.title, L.title.max, {
    message: `Tiêu đề tối đa ${L.title.max} ký tự.`,
  });
  validate(path.bodyMarkdown, ({ value }) =>
    value().trim().length < L.body.min
      ? {
          kind: 'publishBody',
          message: `Nội dung cần ít nhất ${L.body.min} ký tự để đăng.`,
        }
      : value().length > L.body.max
        ? {
            kind: 'maxLength',
            message: `Nội dung tối đa ${L.body.max.toLocaleString('vi-VN')} ký tự.`,
          }
        : undefined,
  );
  maxLength(path.summary, L.summary.max, {
    message: `Tóm tắt tối đa ${L.summary.max.toLocaleString('vi-VN')} ký tự.`,
  });
  maxLength(path.changeNote, L.changeNote.max, {
    message: `Ghi chú tối đa ${L.changeNote.max} ký tự.`,
  });
  when(path, options.tags, (p) =>
    validate(p.tagIds, ({ value }) =>
      value().length === 0
        ? { kind: 'publishTags', message: 'Chọn ít nhất 1 thẻ để đăng.' }
        : undefined,
    ),
  );
  when(path, options.lesson, (p) => lessonRules(p));
}

function when(
  path: SchemaPathTree<ContentFormValue>,
  toggle: RuleToggle,
  rules: (path: SchemaPathTree<ContentFormValue>) => void,
): void {
  if (typeof toggle === 'function') applyWhen(path, () => toggle(), rules);
  else if (toggle) rules(path);
}

function lessonRules(path: SchemaPathTree<ContentFormValue>): void {
  const lessonText = (
    field: keyof Omit<LessonFields, 'occurredOn'>,
    label: string,
  ) =>
    validate(path.lesson[field], ({ value }) => {
      const limit = L.lesson[field];
      const length = value().trim().length;
      return length < limit.min
        ? {
            kind: 'publishLesson',
            message: `${label} cần ít nhất ${limit.min} ký tự.`,
          }
        : value().length > limit.max
          ? {
              kind: 'maxLength',
              message: `${label} tối đa ${limit.max.toLocaleString('vi-VN')} ký tự.`,
            }
          : undefined;
    });
  validate(path.lesson.occurredOn, ({ value }) =>
    value() ? undefined : { kind: 'required', message: 'Chọn ngày xảy ra.' },
  );
  lessonText('symptoms', 'Triệu chứng');
  lessonText('rootCause', 'Nguyên nhân gốc');
  lessonText('resolution', 'Cách xử lý');
  lessonText('prevention', 'Phòng ngừa');
}
