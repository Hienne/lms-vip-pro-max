import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ChatStreamEvent, knowledgeEndpoints } from '@lms/contracts';
import { Toaster } from '@lms/ui';
import {
  catchError,
  concatMap,
  EMPTY,
  Subject,
  type Subscription,
  tap,
} from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { toAppError } from '../../../../core/errors/app-error';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { DocumentTrackerStore } from '../../../../core/knowledge/document-tracker.store';
import { NetworkStore } from '../../../../core/network/network.store';
import type { Answer, Turn, Upload } from './assistant.model';
import { uploadProblem } from './upload-rules';

export const DOCUMENTS_PAGE_SIZE = 20;

export const OFFLINE_MESSAGE =
  'Mất kết nối — không gửi được câu hỏi. Thử lại khi có mạng.';
const CUT_OFF_MESSAGE = 'Kết nối bị ngắt khi đang trả lời.';

const SEARCHING: Answer = {
  status: 'searching',
  text: '',
  retrieved: null,
  found: null,
  citations: [],
  error: null,
};

/**
 * The assistant screen: the chat (kept in the browser, one question at a time) and the shared
 * documents (upload queue, server-paged list). Retrieval, answers, citations and document status
 * are all the server's; this store only shows them.
 */
@Injectable()
export class AssistantStore {
  private readonly client = inject(EndpointClient);
  private readonly tracker = inject(DocumentTrackerStore);
  private readonly network = inject(NetworkStore);
  private readonly toaster = inject(Toaster);

  private nextId = 1;
  private streaming: Subscription | null = null;

  private readonly state = {
    turns: signal<readonly Turn[]>([]),
    answeringId: signal<number | null>(null),
    uploads: signal<readonly Upload[]>([]),
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

  // Uploads are a queue with a result per file, so they are not a `serverMutation`: one file at a
  // time (`concatMap`), a refusal stays on that file's row instead of a toast, and the rest go on.
  private readonly uploadQueue = new Subject<Upload>();

  readonly turns$ = this.state.turns.asReadonly();
  readonly isAnswering$ = computed(() => this.state.answeringId() !== null);
  readonly uploads$ = this.state.uploads.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly documents$ = computed(() => this.documentsData.value()?.items ?? []);
  readonly totalDocuments$ = computed(
    () => this.documentsData.value()?.totalElements ?? 0,
  );
  readonly isLoading$ = this.documentsData.isLoading;
  readonly loadError$ = this.documentsData.error;
  /** What a screen reader hears about the answer in progress; the streamed text itself is silent. */
  readonly announcement$ = computed(() => {
    const answer = this.turns$().at(-1)?.answer;
    switch (answer?.status) {
      case 'searching':
        return 'Đang tìm trong tài liệu…';
      case 'composing':
        return 'Đang soạn câu trả lời…';
      case 'done':
        return `Trợ lý trả lời: ${answer.text}`;
      case 'error':
        return answer.error ?? '';
      default:
        return '';
    }
  });

  constructor() {
    this.uploadQueue
      .pipe(
        concatMap((upload) => this.send(upload)),
        takeUntilDestroyed(),
      )
      .subscribe();
    inject(DestroyRef).onDestroy(() => this.streaming?.unsubscribe());
  }

  setTurns(turns: readonly Turn[]): void {
    this.state.turns.set(turns);
  }

  setAnsweringId(id: number | null): void {
    this.state.answeringId.set(id);
  }

  setUploads(uploads: readonly Upload[]): void {
    this.state.uploads.set(uploads);
  }

  setPage(page: number): void {
    this.state.page.set(page);
  }

  // ---- chat ------------------------------------------------------------------------------------

  /** Asks one question; ignored while another answer is still on its way. */
  ask(rawQuestion: string): void {
    const question = rawQuestion.trim();
    if (!question || this.isAnswering$()) return;
    const id = this.nextId++;
    this.setTurns([...this.turns$(), { id, question, answer: SEARCHING }]);
    this.answer(id, question);
  }

  /** Aborts the answer in progress and keeps what has arrived, marked as stopped. */
  stop(): void {
    const id = this.state.answeringId();
    if (id === null) return;
    this.streaming?.unsubscribe();
    this.streaming = null;
    this.patchAnswer(id, { status: 'stopped' });
    this.setAnsweringId(null);
  }

  /** Asks the same question again, replacing the failed or stopped answer. */
  retry(turnId: number): void {
    const turn = this.turns$().find((t) => t.id === turnId);
    if (!turn || this.isAnswering$()) return;
    this.patchAnswer(turnId, SEARCHING);
    this.answer(turnId, turn.question);
  }

  private answer(id: number, question: string): void {
    this.setAnsweringId(id);
    if (this.network.offline$()) {
      this.fail(id, OFFLINE_MESSAGE);
      return;
    }
    this.streaming = this.client
      .stream(knowledgeEndpoints.askStream, { body: { question } })
      .subscribe({
        next: (event) => this.apply(id, event),
        error: (error: unknown) => {
          const app = toAppError(error);
          this.fail(id, app.kind === 'offline' ? OFFLINE_MESSAGE : app.message);
        },
        complete: () => {
          const status = this.turns$().find((t) => t.id === id)?.answer.status;
          if (status === 'searching' || status === 'composing') {
            this.fail(id, CUT_OFF_MESSAGE);
          }
          this.streaming = null;
        },
      });
  }

  private apply(id: number, event: ChatStreamEvent): void {
    switch (event.type) {
      case 'retrieved':
        this.patchAnswer(id, { status: 'composing', retrieved: event.count });
        break;
      case 'delta':
        this.patchAnswer(id, (answer) => ({ text: answer.text + event.text }));
        break;
      case 'done':
        this.patchAnswer(id, {
          status: 'done',
          found: event.found,
          citations: event.citations,
        });
        this.setAnsweringId(null);
        break;
      case 'error':
        this.fail(id, event.message);
        break;
    }
  }

  private fail(id: number, error: string): void {
    this.patchAnswer(id, { status: 'error', error });
    this.setAnsweringId(null);
  }

  private patchAnswer(
    id: number,
    patch: Partial<Answer> | ((answer: Answer) => Partial<Answer>),
  ): void {
    this.setTurns(
      this.turns$().map((turn) =>
        turn.id === id
          ? {
              ...turn,
              answer: {
                ...turn.answer,
                ...(typeof patch === 'function' ? patch(turn.answer) : patch),
              },
            }
          : turn,
      ),
    );
  }

  // ---- documents -------------------------------------------------------------------------------

  /** Checks each file, then uploads the good ones one after another. */
  addFiles(files: readonly File[]): void {
    const added: Upload[] = files.map((file) => {
      const problem = uploadProblem(file);
      return {
        id: this.nextId++,
        file,
        name: file.name,
        size: file.size,
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

  private send(upload: Upload) {
    this.patchUpload(upload.id, { state: 'uploading' });
    return this.client
      .call(knowledgeEndpoints.uploadDocument, { body: { file: upload.file } })
      .pipe(
        tap((document) => {
          this.tracker.track(document);
          this.setUploads(this.uploads$().filter((u) => u.id !== upload.id));
          this.setPage(1);
          this.changes.bump();
          this.toaster.success(
            `Đã tải lên ${document.fileName}`,
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
