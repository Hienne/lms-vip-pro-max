import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  FmtDatePipe,
  Icon,
  PageHeader,
  Pagination,
  Search,
  Segmented,
  type SegmentedOption,
} from '@lms/ui';
import { ContentThumbnail } from '../components/content-thumbnail/content-thumbnail';
import { REVIEW_STATUS } from '../data-access/review-labels';
import { ReviewsStore } from './data-access/reviews.store';

@Component({
  selector: 'app-community-reviews',
  imports: [
    Badge,
    Button,
    ContentThumbnail,
    Icon,
    Empty,
    ErrorState,
    FmtDatePipe,
    PageHeader,
    Pagination,
    RouterLink,
    Search,
    Segmented,
  ],
  providers: [ReviewsStore],
  templateUrl: './reviews.html',
  styleUrl: './reviews.scss',
})
export class CommunityReviews {
  protected readonly store = inject(ReviewsStore);
  protected readonly statuses = REVIEW_STATUS;
  protected readonly filters: readonly SegmentedOption<string>[] = [
    { value: '', label: 'Tất cả' },
    { value: 'open', label: 'Đang lấy ý kiến' },
    { value: 'concluded', label: 'Đã kết luận' },
    { value: 'closed', label: 'Đã đóng' },
  ];
}
