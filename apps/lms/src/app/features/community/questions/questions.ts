import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ResolutionStatus } from '@lms/contracts';
import {
  Button,
  Empty,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Search,
  Segmented,
  Select,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import { ContentRow } from '../components/content-row/content-row';
import { CommunityTagOptions } from '../data-access/community-tag-options';
import {
  QUESTIONS_PAGE_SIZE,
  QuestionsStore,
} from './data-access/questions.store';

/** Hỏi đáp (CM-01): the questions of the whole Ban, searched and filtered by the server. */
@Component({
  selector: 'app-community-questions',
  imports: [
    Button,
    ContentRow,
    Empty,
    ErrorState,
    Icon,
    PageHeader,
    Pagination,
    RouterLink,
    Search,
    Segmented,
    Select,
    Skeleton,
  ],
  providers: [QuestionsStore, CommunityTagOptions],
  templateUrl: './questions.html',
  styleUrl: './questions.scss',
})
export class CommunityQuestions {
  protected readonly store = inject(QuestionsStore);
  protected readonly tags = inject(CommunityTagOptions);
  protected readonly pageSize = QUESTIONS_PAGE_SIZE;
  protected readonly placeholders = [0, 1, 2, 3, 4];

  protected readonly resolutions: readonly SegmentedOption<
    ResolutionStatus | ''
  >[] = [
    { value: '', label: 'Tất cả' },
    { value: 'unanswered', label: 'Chưa có trả lời' },
    { value: 'answered', label: 'Đã có trả lời' },
    { value: 'solved', label: 'Đã giải quyết' },
  ];
}
