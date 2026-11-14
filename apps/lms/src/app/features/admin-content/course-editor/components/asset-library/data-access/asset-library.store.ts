import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  assetEndpoints,
  type AssetListQuery,
  type BlockType,
  type LibraryAsset,
  type MediaKind,
  type Page,
} from '@lms/contracts';
import { confirm, type DataTableSort } from '@lms/ui';
import { filter, tap } from 'rxjs';
import { invalidation } from '../../../../../../core/data-access/invalidation';
import { serverData } from '../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';

export const LIBRARY_PAGE_SIZE = 20;

/** The kind of file each block type holds; the other block types hold none. */
const MEDIA_KIND: Partial<Record<BlockType, MediaKind>> = {
  video: 'video',
  pdf: 'document',
  image: 'image',
  attachment: 'attachment',
};

/** A table column's key to the sort field the backend accepts (it accepts these two only). */
const SORT_FIELD: Readonly<Record<string, string>> = {
  name: 'name',
  uploaded: 'createTime',
};

const DEFAULT_SORT: DataTableSort = { key: 'uploaded', dir: 'desc' };

/** The block the library is open for. */
export interface LibraryTarget {
  readonly blockKey: string;
  readonly blockType: BlockType;
}

export interface LibraryRow {
  readonly id: string;
  readonly asset: LibraryAsset;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createTime: string | null | undefined;
}

/**
 * The asset library of a file block (SPEC-asset-library → Library picker and delete): the ready
 * files of the kind the block holds, searched, sorted and paged by the server, and the delete of a
 * file no course uses. Opening it for a block resets the search, sort and page.
 */
@Injectable()
export class AssetLibraryStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    target: signal<LibraryTarget | null>(null),
    query: signal(''),
    sort: signal<DataTableSort>(DEFAULT_SORT),
    page: signal(1),
    pageSize: signal(LIBRARY_PAGE_SIZE),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<LibraryAsset> | undefined,
      Page<LibraryAsset> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  private readonly request = computed((): AssetListQuery | undefined => {
    const target = this.state.target();
    const mediaType = target ? MEDIA_KIND[target.blockType] : undefined;
    if (!mediaType) return undefined;
    const { query, sort, page } = this.state;
    const text = query().trim();
    return {
      page: page() - 1,
      size: this.state.pageSize(),
      mediaType,
      status: 'ready',
      includeDeleting: true,
      ...(text ? { q: text.slice(0, 100) } : {}),
      sort: `${SORT_FIELD[sort().key]},${sort().dir}`,
    };
  });

  private readonly changes = invalidation();

  private readonly listData = serverData(
    (query: AssetListQuery) =>
      this.client.call(assetEndpoints.listAssets, { query }),
    { params: () => this.request(), reloadOn: this.changes },
  );

  private readonly deleteMutation = serverMutation(
    (asset: LibraryAsset) =>
      this.client.call(assetEndpoints.deleteAsset, {
        params: { assetId: asset.id },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xóa tệp khỏi thư viện',
      onSuccess: () => {
        // The last row of a later page is gone: show the page before it.
        if (this.state.page() > 1 && this.state.shown()?.items.length === 1) {
          this.setPage(this.state.page() - 1);
        }
      },
      invalidates: this.changes,
    },
  );

  private readonly metadataMutation = serverMutation(
    (change: {
      asset: LibraryAsset;
      displayName: string;
      description: string | null;
    }) =>
      this.client.call(assetEndpoints.updateMetadata, {
        params: { assetId: change.asset.id },
        body: {
          displayName: change.displayName,
          description: change.description,
        },
      }),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật thông tin tệp',
      onSuccess: () => this.editing.set(null),
      invalidates: this.changes,
    },
  );
  readonly editing = signal<LibraryRow | null>(null);
  readonly nameError = signal(false);
  readonly isSavingMetadata$ = this.metadataMutation.isPending;

  private readonly permanentMutation = serverMutation(
    (asset: LibraryAsset) =>
      this.client
        .call(assetEndpoints.deleteAssetPermanently, {
          params: { assetId: asset.id },
        })
        .pipe(tap({ error: () => this.listData.reload() })),
    {
      errors: 'toast',
      success: () => 'Đã xóa vĩnh viễn khỏi kho',
      invalidates: this.changes,
    },
  );

  // Selectors
  readonly target$ = this.state.target.asReadonly();
  readonly query$ = this.state.query.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly pageSize$ = this.state.pageSize.asReadonly();
  readonly loadError$ = this.listData.error;
  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly isDeleting$ = computed(
    () => this.deleteMutation.isPending() || this.permanentMutation.isPending(),
  );
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);
  readonly rows$ = computed((): readonly LibraryRow[] =>
    (this.state.shown()?.items ?? []).map((asset) => ({
      id: String(asset.id),
      asset,
      name: asset.displayName || asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      createTime: asset.createTime,
    })),
  );

  // Setters
  private setTarget(target: LibraryTarget | null): void {
    this.state.target.set(target);
  }

  private setQuery(query: string): void {
    this.state.query.set(query);
  }

  private setSort(sort: DataTableSort): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands
  /** Opens the library for a block, from the first page of everything of its kind. */
  open(blockKey: string, blockType: BlockType): void {
    this.setQuery('');
    this.setSort(DEFAULT_SORT);
    this.setPage(1);
    this.setTarget({ blockKey, blockType });
  }

  close(): void {
    this.editing.set(null);
    this.setTarget(null);
  }

  search(query: string): void {
    this.setQuery(query);
    this.setPage(1);
  }

  sortBy(sort: DataTableSort): void {
    this.setSort(sort);
    this.setPage(1);
  }

  goToPage(page: number): void {
    this.setPage(page);
  }

  /** A new page size starts again at the first page. */
  changePageSize(size: number): void {
    this.state.pageSize.set(size);
    this.setPage(1);
  }

  retryLoad(): void {
    this.listData.reload();
  }

  edit(row: LibraryRow): void {
    this.nameError.set(false);
    this.editing.set(row);
  }

  saveMetadata(name: string, description: string): void {
    const row = this.editing();
    const displayName = name.trim();
    if (!row) return;
    if (!displayName) {
      this.nameError.set(true);
      return;
    }
    this.metadataMutation.run({
      asset: row.asset,
      displayName,
      description: description.trim() || null,
    });
  }

  removePermanently(row: LibraryRow): void {
    confirm(this.dialog, {
      title: `Xóa vĩnh viễn ${row.name}?`,
      message:
        'Tệp gốc và bản phát sẽ bị xóa khỏi kho và không thể khôi phục. Chỉ xóa được khi không còn khóa học hoặc dữ liệu tham chiếu. Nếu xóa chưa hoàn tất, hãy thử lại.',
      confirmLabel: 'Xóa vĩnh viễn',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.permanentMutation.run(row.asset));
  }

  /** Asks first: the file cannot be picked again. The server refuses a file a course uses. */
  remove(row: LibraryRow): void {
    confirm(this.dialog, {
      title: `Xóa tệp ${row.name}?`,
      message:
        'Tệp sẽ không còn chọn được. Chỉ xóa được tệp chưa dùng trong khóa học nào.',
      confirmLabel: 'Xóa',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.deleteMutation.run(row.asset));
  }
}
