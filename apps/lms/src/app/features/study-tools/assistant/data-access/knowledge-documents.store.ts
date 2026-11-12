import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type DocumentScope,
  type KnowledgeDocument,
  knowledgeEndpoints,
} from '@lms/contracts';
import { confirm, Toaster } from '@lms/ui';
import { catchError, concatMap, EMPTY, filter, Subject, tap } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { toAppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { DocumentTrackerStore } from '../../../../core/knowledge/document-tracker.store';
import { SessionStore } from '../../../../core/session/session.store';
import type { Upload } from './assistant.model';
import { uploadProblem } from './upload-rules';

export const DOCUMENTS_PAGE_SIZE = 20;

/** How often the list is read again while a replacement file is being indexed. */
export const REPLACEMENT_POLL_MS = 5000;

const isReplacing = (document: KnowledgeDocument): boolean =>
  document.replacement?.status === 'queued' ||
  document.replacement?.status === 'processing';

/**
 * The documents the assistant answers from: the upload queue, the server-paged list, duplicates,
 * renaming, replacing and removing. Provided by the `/assistant/tai-lieu` page that manages them,
 * and by the chat page, which only shows how many there are. Status and permissions are the
 * server's; this store only shows them.
 */
@Injectable()
export class KnowledgeDocumentsStore {
  private readonly client = inject(EndpointClient);
  private readonly tracker = inject(DocumentTrackerStore);
  private readonly toaster = inject(Toaster);
  private readonly dialog = inject(Dialog);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);

  private nextId = 1;

  private readonly state = {
    uploads: signal<readonly Upload[]>([]),
    /** Who finds the next uploaded files; "my unit" until the user picks another. */
    uploadScope: signal<DocumentScope>('unit'),
    /** The name typed for the next single file; empty keeps the file name. */
    uploadTitle: signal(''),
    /** A document the list points at (the one an upload repeated). */
    highlightId: signal<number | null>(null),
    page: signal(1),
  };

  private readonly changes = invalidation();

  private readonly documentsData = serverData(
    (page: number) =>
      this.client.call(knowledgeEndpoints.documents, {
        query: { page: page - 1, size: DOCUMENTS_PAGE_SIZE },
      }),
    {
      params: () => this.state.page(),
      reloadOn: [this.tracker.finished, this.changes],
    },
  );

  private readonly duplicatesData = serverData(
    () => this.client.call(knowledgeEndpoints.duplicateDocuments),
    { reloadOn: [this.tracker.finished, this.changes] },
  );

  // Uploads are a queue with a result per file, so they are not a `serverMutation`: one file at a
  // time (`concatMap`), a refusal stays on that file's row instead of a toast, and the rest go on.
  private readonly uploadQueue = new Subject<Upload>();

  readonly uploads$ = this.state.uploads.asReadonly();
  readonly uploadScope$ = this.state.uploadScope.asReadonly();
  readonly uploadTitle$ = this.state.uploadTitle.asReadonly();
  readonly highlightId$ = this.state.highlightId.asReadonly();
  /** The caller's documents that share a file, for the "Tài liệu trùng" view. */
  readonly duplicates$ = computed(() => this.duplicatesData.value() ?? []);
  /** Admins may share a document with the whole system; the server refuses it for anyone else. */
  readonly canShareGlobally$ = computed(() =>
    (this.session.user$()?.grants ?? []).some((grant) =>
      ['ADMIN', 'SUPER_ADMIN'].includes(grant.roleCode),
    ),
  );
  readonly page$ = this.state.page.asReadonly();
  readonly documents$ = computed(() => this.documentsData.value()?.items ?? []);
  readonly totalDocuments$ = computed(
    () => this.documentsData.value()?.totalElements ?? 0,
  );
  readonly isLoading$ = this.documentsData.isLoading;
  readonly loadError$ = this.documentsData.error;

  constructor() {
    this.uploadQueue
      .pipe(
        concatMap((upload) => this.send(upload)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // A replacement is indexed in the background and the document stays `ready`, so the tracker does not
    // see it: read the list again until none is left.
    effect((onCleanup) => {
      if (!this.documents$().some(isReplacing)) return;
      const timer = setTimeout(() => this.changes.bump(), REPLACEMENT_POLL_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  setUploadScope(scope: DocumentScope): void {
    this.state.uploadScope.set(scope);
  }

  setUploadTitle(title: string): void {
    this.state.uploadTitle.set(title);
  }

  /** Points the list at a document, which is shown from the first page (newest first). */
  showDocument(id: number): void {
    this.setPage(1);
    this.state.highlightId.set(id);
  }

  setUploads(uploads: readonly Upload[]): void {
    this.state.uploads.set(uploads);
  }

  setPage(page: number): void {
    this.state.page.set(page);
  }

  /** Checks each file, then uploads the good ones one after another. */
  addFiles(files: readonly File[]): void {
    // A name typed beforehand belongs to one file; several files keep their own names.
    const title = files.length === 1 ? this.uploadTitle$().trim() : '';
    if (files.length === 1) this.state.uploadTitle.set('');
    const added: Upload[] = files.map((file) => {
      const problem = uploadProblem(file);
      return {
        id: this.nextId++,
        file,
        name: file.name,
        size: file.size,
        scope: this.uploadScope$(),
        ...(title ? { title } : {}),
        state: problem ? 'error' : 'waiting',
        error: problem,
      };
    });
    this.setUploads([...this.uploads$(), ...added]);
    added
      .filter((u) => u.state === 'waiting')
      .forEach((u) => this.uploadQueue.next(u));
  }

  /** Removes a refused file from the list. */
  dismissUpload(id: number): void {
    this.setUploads(this.uploads$().filter((u) => u.id !== id));
  }

  retryLoad(): void {
    this.documentsData.reload();
  }

  /** Shown on a row: the owner, or an admin for a document that is not personal. The server decides. */
  readonly canRemove = (document: KnowledgeDocument): boolean =>
    document.uploadedBy.userId === this.session.user$()?.userId ||
    (document.scope !== 'personal' && this.canShareGlobally$());

  /** Shown on a row: who may rename or replace is who may delete. The server decides. */
  readonly canEdit = this.canRemove;

  /** Renames a document; the list and the next citations show the new title. */
  renameDocument(document: KnowledgeDocument, title: string): void {
    this.client
      .call(knowledgeEndpoints.renameDocument, {
        params: { documentId: document.id },
        body: { title },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.changes.bump();
          this.toaster.success('Đã đổi tên tài liệu');
        },
        error: (error: unknown) =>
          this.toaster.error(
            'Không đổi được tên tài liệu',
            toAppError(error).message,
          ),
      });
  }

  /**
   * Sends a file to replace a ready document. The old version keeps answering until the new one is
   * indexed; a refused or failed replacement leaves it in place and the row says why.
   */
  replaceDocument(document: KnowledgeDocument, file: File): void {
    const problem = uploadProblem(file);
    if (problem) {
      this.toaster.error('Không thay được bản mới', problem);
      return;
    }
    this.client
      .call(knowledgeEndpoints.replaceDocument, {
        params: { documentId: document.id },
        body: { file },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (replaced) => {
          this.changes.bump();
          if (replaced.duplicate) {
            this.toaster.info(
              'Tệp này giống bản hiện tại',
              'Không có gì thay đổi.',
            );
          } else {
            this.toaster.success(
              `Đã gửi bản mới của ${replaced.title}`,
              'Bản cũ vẫn trả lời cho tới khi bản mới xử lý xong.',
            );
          }
        },
        error: (error: unknown) =>
          this.toaster.error(
            'Không thay được bản mới',
            toAppError(error).message,
          ),
      });
  }

  /** Deletes a document after the user agrees; nothing is sent otherwise. */
  removeDocument(document: KnowledgeDocument): void {
    confirm(this.dialog, {
      title: 'Xoá tài liệu này?',
      message: `“${document.title}” sẽ bị xoá khỏi kho và trợ lý không còn trả lời từ tài liệu này, không khôi phục được.`,
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
      .pipe(
        filter(Boolean),
        concatMap(() =>
          this.client
            .call(knowledgeEndpoints.deleteDocument, {
              params: { documentId: document.id },
            })
            .pipe(
              tap(() => {
                this.changes.bump();
                this.toaster.success(`Đã xoá ${document.title}`);
              }),
              catchError((error: unknown) => {
                this.toaster.error(
                  'Không xoá được tài liệu',
                  toAppError(error).message,
                );
                return EMPTY;
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private send(upload: Upload) {
    this.patchUpload(upload.id, { state: 'uploading' });
    return this.client
      .call(knowledgeEndpoints.uploadDocument, {
        body: {
          file: upload.file,
          scope: upload.scope,
          ...(upload.title ? { title: upload.title } : {}),
        },
      })
      .pipe(
        tap((document) => {
          if (document.duplicate) {
            // Nothing was created: say so on the file's row and point at the document that is there.
            this.patchUpload(upload.id, {
              state: 'duplicate',
              existing: { id: document.id, title: document.title },
            });
            return;
          }
          this.tracker.track(document);
          this.setUploads(this.uploads$().filter((u) => u.id !== upload.id));
          this.setPage(1);
          this.changes.bump();
          this.toaster.success(
            `Đã tải lên ${document.title}`,
            'Tài liệu đang được xử lý, bạn có thể làm việc khác trong lúc chờ.',
          );
        }),
        catchError((error: unknown) => {
          this.patchUpload(upload.id, {
            state: 'error',
            error: toAppError(error).message,
          });
          return EMPTY;
        }),
      );
  }

  private patchUpload(id: number, patch: Partial<Upload>): void {
    this.setUploads(
      this.uploads$().map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  }
}
