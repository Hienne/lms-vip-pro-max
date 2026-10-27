import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { personalEndpoints, type SavedItem } from '@lms/contracts';
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
    (query: {
      type: 'notes' | 'bookmarks';
      page: number;
      size: number;
      sort: string;
    }) => this.client.call(personalEndpoints.saved, { query }),
    {
      params: () => ({
        type: this.state.tab(),
        page: this.state.page(),
        size: 20,
        sort: 'createdAt,desc',
      }),
      reloadOn: this.changes.saved,
    },
  );
  private readonly removal = serverMutation<
    SavedItem,
    { deleted: true } | { saved: false; id: string }
  >(
    (item: SavedItem) =>
      item.text !== null
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
  readonly data$ = this.data.value;
  readonly items$ = computed(() => this.data.value()?.items ?? []);
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
  remove(item: SavedItem) {
    this.removal.run(item);
  }
  openAtAnchor(item: SavedItem) {
    void this.router.navigate(['/lesson', item.courseId, item.lessonId], {
      queryParams:
        item.anchor.type === 'pdf'
          ? { anchorType: 'pdf', page: item.anchor.page }
          : { anchorType: 'video', seconds: item.anchor.seconds },
    });
  }
  retry() {
    this.data.reload();
  }
}
