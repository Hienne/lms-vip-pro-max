import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { scormEndpoints, type ScormPackage } from '@lms/contracts';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/** Both library routes render the same server-filtered list; the server decides every write permission. */
@Injectable()
export class ScormLibraryStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  readonly admin$ =
    inject(ActivatedRoute).snapshot.routeConfig?.path === 'admin/lessons';
  private readonly changes = invalidation();
  private readonly state = {
    q: signal(''),
    page: signal(0),
    file: signal<File | null>(null),
    fileError: signal(''),
  };
  private readonly data = serverData(
    (query: { q: string; page: number; size: number }) =>
      this.client.call(scormEndpoints.list, { query }),
    {
      params: () => ({ q: this.state.q(), page: this.state.page(), size: 20 }),
      reloadOn: this.changes,
    },
  );
  private readonly uploadMutation = serverMutation(
    (file: File) =>
      this.client.call(scormEndpoints.upload, {
        query: { ownerOrgId: this.session.user$()?.org?.id ?? 0 },
        body: { file },
      }),
    {
      errors: 'alert',
      onSuccess: (result) => {
        this.state.file.set(null);
        void this.router.navigate(['/scorm', result.id], {
          queryParams: { preview: true },
        });
      },
      invalidates: this.changes,
    },
  );
  private readonly publishMutation = serverMutation(
    (item: ScormPackage) =>
      this.client.call(scormEndpoints.publish, {
        params: { id: item.id },
        body: { expectedVersion: item.rowVersion },
      }),
    {
      errors: 'alert',
      success: () => 'Đã xuất bản bài giảng',
      invalidates: this.changes,
    },
  );
  readonly items$ = computed(() => this.data.value()?.items ?? []);
  readonly total$ = computed(() => this.data.value()?.totalElements ?? 0);
  readonly loading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly page$ = this.state.page.asReadonly();
  readonly query$ = this.state.q.asReadonly();
  readonly file$ = this.state.file.asReadonly();
  readonly ownerName$ = computed(() => this.session.user$()?.org?.name ?? '');
  readonly fileError$ = this.state.fileError.asReadonly();
  readonly uploadError$ = this.uploadMutation.error;
  readonly publishingError$ = this.publishMutation.error;
  readonly uploading$ = this.uploadMutation.isPending;
  readonly publishing$ = this.publishMutation.isPending;
  selectFile(file: File | null): void {
    if (this.uploading$()) return;
    this.uploadMutation.reset();
    this.state.fileError.set('');
    if (
      file &&
      (!file.name.toLowerCase().endsWith('.zip') ||
        file.size === 0 ||
        file.size > 100 * 1024 * 1024)
    ) {
      this.state.file.set(null);
      this.state.fileError.set('Chọn tệp .zip không rỗng, tối đa 100 MB.');
      return;
    }
    this.state.file.set(file);
  }
  upload(): void {
    const file = this.state.file();
    if (file && !this.uploading$()) this.uploadMutation.run(file);
  }
  publish(item: ScormPackage): void {
    if (!this.publishing$()) this.publishMutation.run(item);
  }
  search(q: string): void {
    this.state.q.set(q);
    this.state.page.set(0);
  }
  goToPage(page: number): void {
    this.state.page.set(page);
  }
  reload(): void {
    this.data.reload();
  }
}
