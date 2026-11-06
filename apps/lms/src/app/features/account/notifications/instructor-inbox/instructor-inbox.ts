import { Component, inject } from '@angular/core';
import {
  Empty,
  ErrorState,
  List,
  ListItem,
  Pagination,
  Segmented,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import {
  INBOX_PAGE_SIZE,
  InstructorInboxStore,
  type InboxFilter,
} from '../data-access/instructor-inbox.store';
import { InstructorFeedbackItem } from './instructor-feedback-item';

/** "Câu hỏi của học viên": what learners asked or reported on the courses the caller manages. */
@Component({
  selector: 'app-instructor-inbox',
  imports: [
    Empty,
    ErrorState,
    InstructorFeedbackItem,
    List,
    ListItem,
    Pagination,
    Segmented,
    Skeleton,
  ],
  providers: [InstructorInboxStore],
  templateUrl: './instructor-inbox.html',
  styleUrl: './instructor-inbox.scss',
})
export class InstructorInbox {
  protected readonly store = inject(InstructorInboxStore);
  protected readonly pageSize = INBOX_PAGE_SIZE;
  protected readonly placeholders = [1, 2, 3];
  protected readonly filters: readonly SegmentedOption<InboxFilter>[] = [
    { value: 'new', label: 'Chưa trả lời' },
    { value: 'all', label: 'Tất cả' },
  ];
}
