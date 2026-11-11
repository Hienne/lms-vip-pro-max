import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { QuestionDecision } from '@lms/contracts';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Field,
  Icon,
  Input,
  PageHeader,
  Progress,
  SectionCard,
  Skeleton,
  Spinner,
  Textarea,
} from '@lms/ui';
import { Markdown } from '../../../../shared/content/markdown/markdown';
import { CourseReviewStore } from './data-access/course-review.store';

/** What the model is doing, by the step the server reports. */
const STEP_TEXT: Readonly<Record<string, string>> = {
  summarise_sections: 'Đang đọc và tóm tắt tài liệu',
  outline: 'Dàn ý đã sẵn sàng, chờ bạn duyệt',
  lesson: 'Đang viết các bài học',
  questions: 'Đang soạn câu hỏi',
  review: 'Đã viết xong, chờ bạn rà soát',
  draft: 'Đã tạo bản nháp khóa học',
};

const DIFFICULTY: Readonly<Record<string, string>> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

/**
 * The review screen of one AI course generation (`/admin/courses/ai-drafts/:jobId`): progress,
 * the outline to edit and approve, each lesson with "Tạo lại bài này", the proposed questions to
 * accept or reject and, once every lesson is written, the draft. The server decides every state.
 */
@Component({
  selector: 'app-course-review',
  imports: [
    Alert,
    Button,
    Card,
    ErrorState,
    Field,
    Icon,
    Input,
    Markdown,
    PageHeader,
    Progress,
    RouterLink,
    SectionCard,
    Skeleton,
    Spinner,
    Textarea,
  ],
  providers: [CourseReviewStore],
  templateUrl: './course-review.html',
  styleUrl: './course-review.scss',
})
export class CourseReview {
  protected readonly store = inject(CourseReviewStore);

  protected readonly stepText = computed(() => {
    const content = this.store.content$();
    if (!content) return '';
    if (content.status === 'failed') return 'Có bước bị lỗi';
    if (content.status === 'cancelled') return 'Đã hủy';
    if (content.status === 'completed') return STEP_TEXT['draft'];
    return STEP_TEXT[content.step ?? ''] ?? 'Đang xử lý';
  });

  protected readonly lines = (objectives: readonly string[]): string =>
    objectives.join('\n');

  protected readonly difficulty = (value: string): string =>
    DIFFICULTY[value] ?? value;

  protected readonly decisions: readonly {
    readonly value: QuestionDecision;
    readonly label: string;
  }[] = [
    { value: 'accepted', label: 'Chấp nhận' },
    { value: 'rejected', label: 'Loại' },
  ];

  /** Where in the source a note came from, e.g. "trang 3, dòng 10–24". */
  protected where(note: {
    readonly page?: number | null;
    readonly lineStart?: number | null;
    readonly lineEnd?: number | null;
  }): string {
    const parts: string[] = [];
    if (note.page) parts.push(`trang ${note.page}`);
    if (note.lineStart) {
      parts.push(
        note.lineEnd && note.lineEnd !== note.lineStart
          ? `dòng ${note.lineStart}–${note.lineEnd}`
          : `dòng ${note.lineStart}`,
      );
    }
    return `(${parts.join(', ')})`;
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  /** Clicking the decision that is already made puts the question back to undecided. */
  protected decide(
    key: string,
    index: number,
    current: QuestionDecision | null | undefined,
    chosen: QuestionDecision,
  ): void {
    this.store.decide(key, index, current === chosen ? 'pending' : chosen);
  }
}
