import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { personalEndpoints, type SavedItemView } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { EndpointClient } from '../../../../core/http/endpoint-client';

@Injectable()
export class SavedStore {
  private readonly client = inject(EndpointClient);
  private readonly router = inject(Router);
  private readonly changes = inject(LearningChanges);
  private readonly state = {
    tab: signal<'notes' | 'bookmarks'>('notes'),
    page: signal(0),
  };
  private readonly data = serverData(
    (query: { kind: 'notes' | 'bookmarks'; page: number; size: number }) =>
      this.client.call(personalEndpoints.saved, { query }),
    {
      params: () => ({
        kind: this.state.tab(),
        page: this.state.page(),
        size: 20,
      }),
      reloadOn: this.changes.saved,
    },
  );
  private readonly removal = serverMutation<SavedItemView, null>(
    (item: SavedItemView) =>
      item.kind === 'note'
        ? this.client.call(personalEndpoints.deleteNote, {
            params: { noteId: item.id },
          })
        : this.client.call(personalEndpoints.deleteBookmark, {
            params: { bookmarkId: item.id },
          }),
    {
      errors: 'toast',
      invalidates: this.changes.saved,
      success: () => 'Đã xóa mục đã lưu',
    },
  );
  readonly tab$ = this.state.tab.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly total$ = computed(() => this.data.value()?.page.totalElements ?? 0);
  readonly items$ = computed(() => this.data.value()?.page.items ?? []);
  readonly tabs$ = computed(() => [
    { id: 'notes', label: 'Ghi chú', count: this.data.value()?.counts.notes },
    {
      id: 'bookmarks',
      label: 'Đánh dấu',
      count: this.data.value()?.counts.bookmarks,
    },
  ]);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly isSaving$ = this.removal.isPending;
  setTab(tab: string) {
    this.state.tab.set(tab === 'bookmarks' ? 'bookmarks' : 'notes');
    this.setPage(0);
  }
  setPage(page: number) {
    this.state.page.set(page);
  }
  remove(item: SavedItemView) {
    this.removal.run(item);
  }
  openAtAnchor(item: SavedItemView) {
    void this.router.navigate(['/lesson', item.courseId, item.lessonId], {
      queryParams:
        item.anchor.type === 'pdf'
          ? { block: item.anchor.blockId, page: item.anchor.page }
          : item.anchor.type === 'video'
            ? { block: item.anchor.blockId, t: item.anchor.second }
            : {},
    });
  }
  retry() {
    this.data.reload();
  }
}
