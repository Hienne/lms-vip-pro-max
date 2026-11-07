import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  applyWhen,
  form,
  FormField,
  FormRoot,
  validate,
  maxLength,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { COMMUNITY_LIMITS } from '@lms/contracts';
import {
  Alert,
  Badge,
  type BadgeTone,
  Breadcrumb,
  type BreadcrumbItem,
  Button,
  Card,
  CardBody,
  DrawerOutlet,
  Empty,
  ErrorState,
  Field,
  FmtDatetimePipe,
  FmtNumPipe,
  Icon,
  IconButton,
  Input,
  PageHeader,
  Segmented,
  type SegmentedOption,
  Skeleton,
  Textarea,
} from '@lms/ui';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { MarkdownEditor } from '../components/markdown-editor/markdown-editor';
import { TagPicker } from '../components/tag-picker/tag-picker';
import { CommunityTagOptions } from '../data-access/community-tag-options';
import { ContentAuthoring } from '../data-access/content-authoring';
import {
  emptyContentForm,
  publishRules,
  toDraftFields,
} from '../data-access/content-form';
import { CoverPicker } from '../components/cover-picker/cover-picker';
import { EditorStore, type NewKind } from './data-access/editor.store';

const REVISION_STATUS: Readonly<
  Record<string, { label: string; tone: BadgeTone }>
> = {
  draft: { label: 'Bản nháp', tone: 'neutral' },
  published: { label: 'Đang hiển thị', tone: 'success' },
  superseded: { label: 'Đã thay thế', tone: 'neutral' },
};

/**
 * Soạn bài / sửa nháp (CM-05): a new article or lesson learned, or the draft of any content the
 * user may edit. The form follows the content's kind; the server decides who may edit and publish.
 */
@Component({
  selector: 'app-community-editor',
  imports: [
    CoverPicker,
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    DrawerOutlet,
    Empty,
    ErrorState,
    Field,
    FmtDatetimePipe,
    FmtNumPipe,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    MarkdownEditor,
    PageHeader,
    RouterLink,
    Segmented,
    Skeleton,
    TagPicker,
    Textarea,
  ],
  providers: [EditorStore, ContentAuthoring, CommunityTagOptions],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class CommunityEditor implements HasUnsavedChanges {
  protected readonly store = inject(EditorStore);
  protected readonly cover = this.store.cover;
  protected readonly design = this.store.design;
  protected readonly isReview = computed(
    () => this.store.kind$() === 'architecture_review',
  );
  protected readonly designName = computed(() => {
    if (this.design.selection$() === null) return undefined;
    const selected =
      this.design.selection$() ??
      this.model().assets.find((a) => a.usage === 'design_file');
    return selected ? selected.caption || 'Tệp thiết kế hiện tại' : undefined;
  });
  protected readonly tags = inject(CommunityTagOptions);
  protected readonly limits = COMMUNITY_LIMITS;
  protected readonly revisionStatus = REVISION_STATUS;
  protected readonly kinds: readonly SegmentedOption<NewKind>[] = [
    { value: 'article', label: 'Bài viết' },
    { value: 'lesson_learned', label: 'Bài học sự cố' },
  ];

  private readonly model = signal(emptyContentForm());
  protected readonly existingCover = computed(() => {
    if (this.cover.selection$() !== undefined) return undefined;
    const detail = this.store.detail$();
    return (detail?.draftRevision ?? detail?.publishedRevision)?.assets?.find(
      (asset) => asset.usage === 'cover',
    )?.revisionAssetId;
  });
  protected readonly hasCover = computed(() =>
    this.cover.selection$() !== undefined
      ? !!this.cover.selection$()
      : this.model().assets.some((asset) => asset.usage === 'cover'),
  );
  private readonly snapshot = computed(() =>
    JSON.stringify({ ...this.model(), assets: this.fields().assets }),
  );
  /** The form as it was last loaded or saved, to tell whether leaving loses anything. */
  private readonly baseline = signal(JSON.stringify(emptyContentForm()));

  protected readonly isLesson = computed(
    () => this.store.kind$() === 'lesson_learned',
  );
  protected readonly isQuestion = computed(
    () => this.store.kind$() === 'question',
  );
  protected readonly isAnswer = computed(() => this.store.kind$() === 'answer');

  protected readonly editorForm = form(
    this.model,
    (path) => {
      applyWhen(
        path,
        () => this.isReview(),
        (p) => {
          validate(p.review.problem, ({ value }) =>
            value().trim().length < 20
              ? {
                  kind: 'required',
                  message: 'Mô tả vấn đề cần ít nhất 20 ký tự.',
                }
              : undefined,
          );
          maxLength(p.review.problem, 10_000, {
            message: 'Vấn đề tối đa 10.000 ký tự.',
          });
          maxLength(p.review.constraints, 20_000, {
            message: 'Ràng buộc tối đa 20.000 ký tự.',
          });
          validate(p.review.decisions, ({ value }) => {
            const lines = value()
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean);
            return !lines.length ||
              lines.length > 20 ||
              lines.some((v) => v.length > 3_000)
              ? {
                  kind: 'decisions',
                  message: 'Nhập 1–20 quyết định, mỗi dòng tối đa 3.000 ký tự.',
                }
              : undefined;
          });
          validate(p.review.dueAt, ({ value }) =>
            !value() || new Date(value()).getTime() > Date.now()
              ? undefined
              : { kind: 'date', message: 'Hạn review phải ở tương lai.' },
          );
        },
      );
      publishRules(path, {
        tags: () => !this.isAnswer() && !this.isReview(),
        lesson: () => this.isLesson(),
      });
    },
    {
      submission: {
        action: async () =>
          this.store.publish(
            this.fields(),
            this.model().tagIds,
            this.isReview() ? this.model().review.dueAt : undefined,
          ),
      },
    },
  );

  protected readonly heading = computed(() => {
    if (this.isReview())
      return {
        title: this.store.isNew$() ? 'Tạo đề nghị review' : 'Sửa thiết kế',
        description: 'Mô tả vấn đề, phương án và các quyết định cần phản biện.',
      };
    if (this.store.isNew$()) {
      return this.isLesson()
        ? {
            title: 'Ghi bài học sự cố',
            description: 'Ghi lại sự cố để lần sau cả Ban xử lý nhanh hơn.',
          }
        : {
            title: 'Viết bài',
            description:
              'Chia sẻ điều bạn đã làm hoặc đã học được với đồng nghiệp.',
          };
    }
    if (this.isAnswer()) return { title: 'Sửa câu trả lời', description: '' };
    if (this.store.isPublished$()) {
      return { title: 'Sửa bài đã đăng', description: '' };
    }
    return { title: 'Sửa bản nháp', description: '' };
  });

  protected readonly breadcrumb = computed((): BreadcrumbItem[] => {
    const detail = this.store.detail$();
    const root: BreadcrumbItem = this.isReview()
      ? { label: 'Review kiến trúc', href: '/community/reviews' }
      : this.isQuestion() || this.isAnswer()
        ? { label: 'Hỏi đáp', href: '/community/questions' }
        : { label: 'Bài viết', href: '/community/articles' };
    const current: BreadcrumbItem = { label: this.heading().title };
    if (!detail?.publishedRevision) return [root, current];
    const target = this.isAnswer() ? detail.questionId : detail.contentId;
    const title = this.isAnswer()
      ? (this.store.questionTitle$() ?? 'Câu hỏi')
      : detail.publishedRevision.title;
    return [
      root,
      {
        label: title,
        href: `/community/${this.isReview() ? 'reviews' : 'contents'}/${target}`,
      },
      current,
    ];
  });

  protected readonly publishLabel = computed(() => {
    if (this.isReview())
      return this.store.isPublished$() ? 'Đăng phiên bản mới' : 'Đăng thiết kế';
    if (this.isAnswer()) return 'Đăng câu trả lời';
    return this.store.isPublished$() ? 'Đăng bản mới' : 'Đăng bài';
  });

  constructor() {
    // The form starts from the server's copy, and starts again after a conflict reload.
    effect(() => {
      const initial = this.store.initialForm$();
      if (!initial) return;
      untracked(() => {
        this.cover.reset();
        this.design.reset();
        this.model.set(initial);
        this.baseline.set(JSON.stringify(initial));
      });
    });
    // A save makes the current form the new baseline.
    effect(() => {
      if (this.store.savedAt$()) {
        untracked(() => this.baseline.set(this.snapshot()));
      }
    });
  }

  protected chooseDesign(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.design.choose(file);
  }

  protected chooseKind(kind: NewKind): void {
    this.store.chooseKind(kind);
  }

  protected saveDraft(): void {
    this.store.saveDraft(
      this.fields(),
      this.model().tagIds,
      this.isReview() ? this.model().review.dueAt : undefined,
    );
  }

  protected setTags(tagIds: number[]): void {
    this.editorForm.tagIds().value.set(tagIds);
    this.editorForm.tagIds().markAsTouched();
  }

  protected addTechnology(): void {
    this.model.update((value) => ({
      ...value,
      technologies: [...value.technologies, { name: '', version: '' }],
    }));
  }

  protected removeTechnology(index: number): void {
    this.model.update((value) => ({
      ...value,
      technologies: value.technologies.filter((_, i) => i !== index),
    }));
  }

  hasUnsavedChanges(): boolean {
    return !this.store.done$() && this.snapshot() !== this.baseline();
  }

  private fields() {
    return toDraftFields(this.model(), {
      lesson: this.isLesson(),
      review: this.isReview(),
      design: this.isReview() ? this.design.selection$() : undefined,
      cover: this.cover.selection$(),
    });
  }
}
