import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import type { ContentDetail } from '@lms/contracts';
import {
  Alert,
  AlertAction,
  Badge,
  Breadcrumb,
  type BreadcrumbItem,
  Button,
  Card,
  CardBody,
  ErrorState,
  FmtDatePipe,
  FmtNumPipe,
  Menu,
  type MenuEntry,
  Icon,
  Skeleton,
} from '@lms/ui';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { Markdown } from '../../../shared/content/markdown/markdown';
import { CommentThread } from '../components/comment-thread/comment-thread';
import type { LifecycleDialogAction } from '../components/lifecycle-dialog/lifecycle-dialog';
import { MarkdownEditor } from '../components/markdown-editor/markdown-editor';
import { Vote } from '../components/vote/vote';
import { RESOLUTION_LABELS } from '../data-access/community-labels';
import {
  emptyContentForm,
  publishRules,
  toDraftFields,
} from '../data-access/content-form';
import { ContentStore } from './data-access/content.store';

type MenuAction = LifecycleDialogAction | 'report';

const LESSON_SECTIONS = [
  { key: 'symptoms', label: 'Triệu chứng' },
  { key: 'rootCause', label: 'Nguyên nhân gốc' },
  { key: 'resolution', label: 'Cách xử lý' },
  { key: 'prevention', label: 'Phòng ngừa' },
] as const;

/**
 * Chi tiết nội dung (CM-03): a question with its answers and comments, an article or a lesson
 * learned. Every action is shown only when the server's `capabilities` allow it.
 */
@Component({
  selector: 'app-community-content',
  imports: [
    Alert,
    AlertAction,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CommentThread,
    ErrorState,
    FmtDatePipe,
    FmtNumPipe,
    FormField,
    FormRoot,
    Markdown,
    MarkdownEditor,
    Menu,
    Icon,
    RouterLink,
    Skeleton,
    Vote,
  ],
  providers: [ContentStore],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class CommunityContent implements HasUnsavedChanges {
  protected readonly store = inject(ContentStore);
  protected readonly resolutionLabels = RESOLUTION_LABELS;
  protected readonly lessonSections = LESSON_SECTIONS;

  private readonly answerModel = signal(emptyContentForm());
  /** The posted-answer count the composer was last cleared for. */
  private readonly clearedFor = signal(0);
  protected readonly answerForm = form(
    this.answerModel,
    (path) => publishRules(path, { tags: false, lesson: false, title: false }),
    {
      submission: {
        action: async () =>
          this.store.postAnswer(toDraftFields(this.answerModel()), true),
      },
    },
  );

  protected readonly isQuestion = computed(
    () => this.store.kind$() === 'question',
  );

  protected readonly breadcrumb = computed((): BreadcrumbItem[] =>
    this.isQuestion()
      ? [
          { label: 'Hỏi đáp', href: '/community/questions' },
          { label: 'Chi tiết câu hỏi' },
        ]
      : [
          { label: 'Bài viết', href: '/community/articles' },
          { label: 'Chi tiết bài viết' },
        ],
  );

  /** The "Thêm thao tác" menu, from what the server allows on this content. */
  protected readonly menu = computed((): MenuEntry<MenuAction>[] => {
    const detail = this.store.detail$();
    if (!detail) return [];
    const can = detail.capabilities;
    const entries: MenuEntry<MenuAction>[] = [];
    const item = (value: MenuAction, label: string, danger = false) =>
      entries.push({
        kind: 'item',
        value,
        label,
        ...(danger ? { tone: 'danger' as const } : {}),
      });
    if (can.canReport && !can.canEditDraft) item('report', 'Báo cáo vi phạm');
    if (can.canMarkDuplicate && !detail.isDuplicate) {
      item('duplicate', 'Đánh dấu trùng lặp');
    }
    if (can.canClose) item('close', 'Đóng câu hỏi');
    if (can.canReopen && !detail.isDuplicate) item('reopen', 'Mở lại');
    if (can.canArchive) item('archive', 'Lưu trữ');
    if (can.canDelete)
      item('soft_delete', this.isQuestion() ? 'Xóa câu hỏi' : 'Xóa', true);
    return entries;
  });

  constructor() {
    // A posted answer clears the composer.
    effect(() => {
      const posted = this.store.answersPosted$();
      if (posted === untracked(this.clearedFor)) return;
      untracked(() => {
        this.answerModel.set(emptyContentForm());
        this.clearedFor.set(posted);
      });
    });
  }

  protected act(content: ContentDetail, action: MenuAction): void {
    if (action === 'report') this.store.report(content.contentId);
    else this.store.changeLifecycle(content, action);
  }

  protected saveAnswerDraft(): void {
    this.store.postAnswer(toDraftFields(this.answerModel()), false);
  }

  protected voteBlocked(content: ContentDetail): string {
    return this.store.isClosed$()
      ? 'Câu hỏi đã đóng nên không bình chọn thêm'
      : content.kind === 'answer'
        ? 'Không thể bình chọn lúc này (câu trả lời của bạn hoặc câu hỏi đã đóng)'
        : 'Bạn không thể bình chọn cho nội dung của chính mình';
  }

  protected isAccepted(answer: ContentDetail): boolean {
    return this.store.detail$()?.acceptedAnswerId === answer.contentId;
  }

  protected lessonText(
    content: ContentDetail,
    key: (typeof LESSON_SECTIONS)[number]['key'],
  ): string {
    return content.publishedRevision?.context?.lessonLearned?.[key] ?? '';
  }

  protected technologies(content: ContentDetail): string {
    return (content.publishedRevision?.context?.technologies ?? [])
      .map((t) => (t.version ? `${t.name} ${t.version}` : t.name))
      .join(', ');
  }

  protected tagNames(content: ContentDetail): string {
    return (content.tags ?? []).map((tag) => tag.name).join(', ');
  }

  /** An answer typed in the composer is lost on leaving, so the guard asks first. */
  hasUnsavedChanges(): boolean {
    // Once an answer is posted its text is saved, even before the composer is cleared.
    return (
      !!this.answerModel().bodyMarkdown.trim() &&
      !this.store.isAnswering$() &&
      this.store.answersPosted$() === this.clearedFor()
    );
  }
}
