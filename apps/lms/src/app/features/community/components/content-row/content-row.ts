import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ContentCard } from '@lms/contracts';
import { Badge, FmtDatePipe, FmtNumPipe, FmtRelativePipe } from '@lms/ui';
import { RESOLUTION_LABELS } from '../../data-access/community-labels';

/**
 * One row of a community list (questions, articles, lessons, My posts, Saved): the title links to
 * the detail; questions also show the score and answer count, and at most one status badge.
 * Presentational: it renders the card the server sent and decides nothing.
 */
@Component({
  selector: 'app-content-row',
  imports: [Badge, FmtDatePipe, FmtNumPipe, FmtRelativePipe, RouterLink],
  templateUrl: './content-row.html',
  styleUrl: './content-row.scss',
})
export class ContentRow {
  readonly card = input.required<ContentCard>();

  protected readonly isQuestion = computed(
    () => this.card().kind === 'question',
  );

  /** One state badge: the resolution of a question, else a draft or a closed content. */
  protected readonly status = computed(() => {
    const card = this.card();
    if (!card.publishedAt)
      return { label: 'Bản nháp', tone: 'neutral' } as const;
    if (card.kind === 'question' && card.lifecycleStatus === 'active') {
      return RESOLUTION_LABELS[card.resolutionStatus ?? ''] ?? null;
    }
    if (card.lifecycleStatus === 'closed') {
      return { label: 'Đã đóng', tone: 'neutral' } as const;
    }
    if (card.lifecycleStatus === 'archived') {
      return { label: 'Đã lưu trữ', tone: 'neutral' } as const;
    }
    return null;
  });

  protected readonly tagNames = computed(() =>
    (this.card().tags ?? []).map((tag) => tag.name).join(', '),
  );

  protected readonly link = computed(() => [
    '/community/contents',
    this.card().contentId,
  ]);
}
