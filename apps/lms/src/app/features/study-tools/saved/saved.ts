import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Empty,
  ErrorState,
  FmtRelativePipe,
  Icon,
  List,
  ListItem,
  Menu,
  PageHeader,
  Search,
  SectionCard,
  Segmented,
  type SegmentedOption,
  Select,
  Skeleton,
} from '@lms/ui';
import { type SavedKindFilter, SavedStore } from './data-access/saved.store';

/**
 * "Đã lưu & ghi chú" (`/saved`): the lessons the learner kept notes or bookmarks on, grouped by
 * course, and the selected lesson's page of notes and bookmarks in the order they sit in its files.
 * Each entry opens the lesson at its PDF page or video block.
 */
@Component({
  selector: 'app-saved',
  imports: [
    Button,
    Empty,
    ErrorState,
    FmtRelativePipe,
    Icon,
    List,
    ListItem,
    Menu,
    PageHeader,
    RouterLink,
    Search,
    SectionCard,
    Segmented,
    Select,
    Skeleton,
  ],
  providers: [SavedStore],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
})
export class Saved {
  protected readonly store = inject(SavedStore);
  protected readonly kinds: readonly SegmentedOption<SavedKindFilter>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'note', label: 'Ghi chú' },
    { value: 'bookmark', label: 'Đánh dấu' },
  ];
  protected readonly actions = [
    {
      kind: 'item',
      value: 'remove',
      label: 'Xóa khỏi mục đã lưu',
      icon: 'trash-2',
      tone: 'danger',
    },
  ] as const;
}
