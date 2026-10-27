import { TestBed } from '@angular/core/testing';
import {
  assetEndpoints,
  MEDIA_PROCESSING_UNAVAILABLE_CODE,
  type AnyEndpoint,
} from '@lms/contracts';
import {
  backendRefusal,
  envelopeError,
  type FakeReply,
  type FakeRequest,
} from '@lms/mocks';
import { map, Observable, timer } from 'rxjs';
import type { MockInstance } from 'vitest';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import {
  cancelUpload,
  chunkedUpload,
  pollUpload,
  POLL_MS,
  POLL_LIMIT_MS,
  reprocessUpload,
  type UploadProgress,
} from './chunked-upload';
import { digestOf, FakeHasher } from './fake-hasher.testing';
import type { HashEvent, Hasher } from './sha256-hasher';

const PART = 8 * 1024 * 1024;
const hex = digestOf;

const fileOf = (size: number, name = 'clip.mp4', type = 'video/mp4') =>
  new File([new Uint8Array(size)], name, { type });

describe('chunkedUpload', () => {
  let client: EndpointClient;
  let hasher: FakeHasher;
  let handle: MockInstance<MockBackend['handle']>;
  let backend: MockBackend;
  let events: UploadProgress[];
  let outcome: { error?: unknown; done?: boolean };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
      ],
    });
    signInToMockBackend('giangvien');
    client = TestBed.inject(EndpointClient);
    backend = TestBed.inject(MockBackend);
    handle = vi.spyOn(backend, 'handle');
    hasher = new FakeHasher();
    events = [];
    outcome = {};
  });
  afterEach(() => vi.useRealTimers());

  const original: MockBackend['handle'] = (endpoint, request) =>
    MockBackend.prototype.handle.call(backend, endpoint, request);

  /** Subscribes and runs the polls on fake time until the stream ends. */
  async function run(source: Observable<UploadProgress>, advanceMs = 0) {
    source.subscribe({
      next: (event) => events.push(event),
      error: (error: unknown) => (outcome.error = error),
      complete: () => (outcome.done = true),
    });
    await settle(advanceMs);
  }
  async function settle(ms = 0) {
    await vi.advanceTimersByTimeAsync(ms);
  }
  const called = (endpoint: AnyEndpoint) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const types = () => events.map((e) => e.type);
  const last = () => events.at(-1);
  const sentParts = () =>
    called(assetEndpoints.uploadPart).map(([, r]) => ({
      part: Number(r.params['partNumber']),
      size: (r.body as Blob).size,
      checksum: r.headers?.['X-Part-SHA256'],
    }));

  /** What a dead network and a failing server answer. */
  const offline = (): FakeReply => ({
    status: 0,
    body: envelopeError('CORE-OFFLINE', 'Offline', 'offline'),
  });
  const unavailable = (): FakeReply => ({
    status: 503,
    body: envelopeError('CORE-INTERNAL_ERROR', 'Lỗi', 'Lỗi hệ thống'),
  });
  const secondPart = (request: FakeRequest) =>
    request.params['partNumber'] === '2';

  /** Fails every request to `endpoint` that matches, from now on. */
  function failFrom(
    endpoint: AnyEndpoint,
    reply: () => FakeReply,
    when: (request: FakeRequest) => boolean = () => true,
  ) {
    handle.mockImplementation((e, request) =>
      e === endpoint && when(request) ? reply() : original(e, request),
    );
  }

  const upload = (file: File, options = {}) =>
    chunkedUpload(client, hasher, file, 1, options);

  beforeEach(() => vi.useFakeTimers());

  describe('a file in parts', () => {
    const file = () => fileOf(PART * 2 + 5);

    it('hashes the file, starts, sends each part in order, completes and polls to ready', async () => {
      await run(upload(file()), POLL_MS * 3);
      expect(types()[0]).toBe('hashing');
      expect(types()).toContain('started');
      expect(types()).toContain('uploading');
      expect(types()).toContain('processing');
      expect(last()).toMatchObject({
        type: 'ready',
        upload: { status: 'ready', durationSeconds: 120 },
      });
      expect(outcome.done).toBe(true);
      expect(called(assetEndpoints.startUpload)).toHaveLength(1);
      expect(sentParts().map((p) => p.part)).toEqual([1, 2, 3]);
      expect(sentParts().map((p) => p.size)).toEqual([PART, PART, 5]);
      expect(called(assetEndpoints.completeUpload)).toHaveLength(1);
    });

    it('starts with the whole-file checksum and a request id it reports as the upload id', async () => {
      await run(upload(file()), POLL_MS * 3);
      const [[, request]] = called(assetEndpoints.startUpload);
      expect(request.body).toMatchObject({
        ownerOrgId: 1,
        originalName: 'clip.mp4',
        mimeType: 'video/mp4',
        sizeBytes: PART * 2 + 5,
        checksumSha256: hex(PART * 2 + 5),
      });
      const started = events.find((e) => e.type === 'started');
      expect(started).toMatchObject({
        uploadId: (request.body as { requestId: string }).requestId,
        checksumSha256: hex(PART * 2 + 5),
        expiresAt: expect.any(String),
      });
    });

    it('sends each part with its own checksum', async () => {
      await run(upload(file()), POLL_MS * 3);
      expect(sentParts().map((p) => p.checksum)).toEqual([
        hex(PART),
        hex(PART),
        hex(5),
      ]);
      // the whole file once, then each part
      expect(hasher.hashed).toEqual([PART * 2 + 5, PART, PART, 5]);
    });

    it('reports hashing in percent and uploaded bytes after every part', async () => {
      await run(upload(file()), POLL_MS * 3);
      expect(events.filter((e) => e.type === 'hashing').at(-1)).toEqual({
        type: 'hashing',
        percent: 100,
      });
      const bytes = events.flatMap((e) =>
        e.type === 'uploading' ? [e.uploadedBytes] : [],
      );
      expect(bytes).toEqual([0, PART, PART * 2, PART * 2 + 5]);
      expect(
        events.find((e) => e.type === 'uploading' && e.uploadedBytes > 0),
      ).toMatchObject({ totalBytes: PART * 2 + 5 });
    });

    it('sends one part at a time', async () => {
      let inFlight = 0;
      let most = 0;
      handle.mockImplementation((endpoint, request) => {
        if (endpoint === assetEndpoints.uploadPart) {
          inFlight++;
          most = Math.max(most, inFlight);
          inFlight--;
        }
        return original(endpoint, request);
      });
      await run(upload(file()), POLL_MS * 3);
      expect(most).toBe(1);
    });
  });

  describe('polling', () => {
    it('asks again every 3 seconds while the server processes, then gives the asset', async () => {
      const small = fileOf(100, 'a.pdf', 'application/pdf');
      await run(upload(small));
      expect(last()).toMatchObject({ type: 'processing' });
      expect(called(assetEndpoints.uploadStatus)).toHaveLength(0);
      await settle(POLL_MS);
      expect(called(assetEndpoints.uploadStatus)).toHaveLength(1);
      expect(last()).toMatchObject({ type: 'processing' });
      await settle(POLL_MS);
      expect(called(assetEndpoints.uploadStatus)).toHaveLength(2);
      expect(last()).toMatchObject({
        type: 'ready',
        upload: { pageCount: 8 },
      });
      await settle(POLL_MS * 5);
      expect(called(assetEndpoints.uploadStatus)).toHaveLength(2);
    });

    it('stops after 15 minutes with a stalled upload, and "check again" polls on', async () => {
      handle.mockImplementation((endpoint, request) => {
        const reply = original(endpoint, request) as FakeReply;
        const data = reply.body.data as { status?: string } | null;
        return endpoint === assetEndpoints.uploadStatus && data?.status
          ? {
              ...reply,
              body: { ...reply.body, data: { ...data, status: 'processing' } },
            }
          : reply;
      });
      await run(
        upload(fileOf(100, 'a.pdf', 'application/pdf')),
        POLL_LIMIT_MS + POLL_MS,
      );
      expect(last()).toEqual({
        type: 'stalled',
        uploadId: expect.any(String),
      });
      expect(outcome.done).toBe(true);
      const polls = called(assetEndpoints.uploadStatus).length;
      expect(polls).toBeLessThanOrEqual(POLL_LIMIT_MS / POLL_MS + 1);

      handle.mockImplementation(original);
      events = [];
      outcome = {};
      const uploadId = (
        called(assetEndpoints.startUpload)[0][1].body as { requestId: string }
      ).requestId;
      await run(pollUpload(client, uploadId), POLL_MS);
      expect(last()).toMatchObject({ type: 'ready' });
    });
  });

  describe('resuming', () => {
    const file = () => fileOf(PART * 2 + 5);
    const target = (over = {}) => ({
      uploadId: '00000000-0000-4000-8000-0000000000aa',
      name: 'clip.mp4',
      sizeBytes: PART * 2 + 5,
      checksumSha256: hex(PART * 2 + 5),
      ...over,
    });

    it('starts again with the kept upload id and skips the parts the server already has', async () => {
      // First run: the network drops after the first part and never comes back before the reload.
      const first = target();
      failFrom(assetEndpoints.uploadPart, offline, secondPart);
      const subscription = upload(file(), {
        resume: first,
        online: () => new Promise<void>(() => undefined),
      }).subscribe();
      await settle();
      expect(sentParts().map((p) => p.part)).toEqual([1, 2]);
      subscription.unsubscribe();
      handle.mockReset();
      handle.mockImplementation(original);
      events = [];

      await run(upload(file(), { resume: first }), POLL_MS * 3);
      expect(called(assetEndpoints.startUpload)[0][1].body).toMatchObject({
        requestId: first.uploadId,
      });
      expect(sentParts().map((p) => p.part)).toEqual([2, 3]);
      expect(events.find((e) => e.type === 'uploading')).toMatchObject({
        uploadedBytes: PART,
      });
      expect(last()).toMatchObject({ type: 'ready' });
    });

    it.each([
      ['a different name', { name: 'other.mp4' }],
      ['a different size', { sizeBytes: PART }],
    ])('refuses %s before any request or hashing', async (_name, over) => {
      await run(upload(file(), { resume: target(over) }));
      expect(last()).toMatchObject({
        type: 'failed',
        code: 'LEARNING-UPLOAD_FILE_MISMATCH',
        message: 'Tệp không khớp tệp đang tải lên.',
        retryProcessing: false,
      });
      expect(handle).not.toHaveBeenCalled();
      expect(hasher.hashed).toEqual([]);
      expect(outcome.done).toBe(true);
    });

    it('refuses a file whose hash differs, before any request', async () => {
      await run(upload(file(), { resume: target({ checksumSha256: hex(1) }) }));
      expect(last()).toMatchObject({
        type: 'failed',
        code: 'LEARNING-UPLOAD_FILE_MISMATCH',
      });
      expect(handle).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('ends in a failed row with the server message when the start is refused', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === assetEndpoints.startUpload
          ? backendRefusal('assetInvalid')
          : original(endpoint, request),
      );
      await run(upload(fileOf(100)));
      expect(last()).toEqual({
        type: 'failed',
        code: 'LEARNING-ASSET_INVALID',
        message:
          'Tệp không hợp lệ, sai loại, vượt dung lượng hoặc thiếu metadata.',
        retryProcessing: false,
      });
      expect(outcome.done).toBe(true);
      expect(called(assetEndpoints.uploadPart)).toHaveLength(0);
    });

    it('says an expired upload is expired', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === assetEndpoints.uploadPart
          ? backendRefusal('uploadExpired')
          : original(endpoint, request),
      );
      await run(upload(fileOf(100)));
      expect(last()).toMatchObject({
        type: 'failed',
        code: 'LEARNING-UPLOAD_EXPIRED',
        retryProcessing: false,
      });
    });

    it('offers to process again only when the server could not run its checks', async () => {
      const processing = (code: string | null) =>
        handle.mockImplementation((endpoint, request) => {
          const reply = original(endpoint, request) as FakeReply;
          const data = reply.body.data as { status?: string } | null;
          return endpoint === assetEndpoints.completeUpload && data
            ? {
                ...reply,
                body: {
                  ...reply.body,
                  data: {
                    ...data,
                    status: 'failed',
                    errorCode: code,
                    errorMessage: 'Máy chủ chưa xử lý được tệp.',
                  },
                },
              }
            : reply;
        });
      processing(MEDIA_PROCESSING_UNAVAILABLE_CODE);
      await run(upload(fileOf(100)));
      expect(last()).toEqual({
        type: 'failed',
        code: MEDIA_PROCESSING_UNAVAILABLE_CODE,
        message: 'Máy chủ chưa xử lý được tệp.',
        retryProcessing: true,
      });

      handle.mockReset();
      handle.mockImplementation(original);
      processing('LEARNING-ASSET_CODEC_UNSUPPORTED');
      events = [];
      await run(upload(fileOf(100, 'b.mp4')));
      expect(last()).toMatchObject({
        type: 'failed',
        code: 'LEARNING-ASSET_CODEC_UNSUPPORTED',
        retryProcessing: false,
      });
    });

    it('completes again on "Xử lý lại" and polls to the end', async () => {
      const done = await new Promise<string>((resolve) => {
        upload(fileOf(100, 'c.pdf', 'application/pdf')).subscribe((e) => {
          if (e.type === 'started') resolve(e.uploadId);
        });
      });
      await settle(POLL_MS * 3);
      handle.mockClear();
      events = [];
      await run(reprocessUpload(client, done), POLL_MS * 2);
      expect(called(assetEndpoints.completeUpload)).toHaveLength(1);
      expect(last()).toMatchObject({ type: 'ready' });
    });
  });

  describe('cancelling', () => {
    it('stops sending when the caller unsubscribes', async () => {
      const slow: Hasher = {
        hash: (blob) =>
          timer(1000).pipe(
            map((): HashEvent => ({ type: 'done', hex: hex(blob.size) })),
          ),
      };
      const subscription = chunkedUpload(
        client,
        slow,
        fileOf(PART * 3),
        1,
      ).subscribe();
      await settle(1000);
      expect(called(assetEndpoints.startUpload)).toHaveLength(1);
      subscription.unsubscribe();
      await settle(POLL_MS * 10);
      expect(called(assetEndpoints.uploadPart)).toHaveLength(0);
      expect(called(assetEndpoints.completeUpload)).toHaveLength(0);
    });

    it('does not start an upload when the caller unsubscribes while hashing', async () => {
      const never = new Observable<HashEvent>();
      const subscription = chunkedUpload(
        client,
        { hash: () => never },
        fileOf(100),
        1,
      ).subscribe();
      subscription.unsubscribe();
      await settle(POLL_MS);
      expect(handle).not.toHaveBeenCalled();
    });

    it('sends nothing more when the caller unsubscribed while it waited for the network', async () => {
      failFrom(assetEndpoints.uploadPart, offline, secondPart);
      let networkBack!: () => void;
      const online = vi.fn(
        () => new Promise<void>((resolve) => (networkBack = resolve)),
      );
      const subscription = upload(fileOf(PART * 2 + 5), { online }).subscribe();
      await settle();
      expect(online).toHaveBeenCalledTimes(1);
      const sent = called(assetEndpoints.uploadPart).length;

      subscription.unsubscribe();
      handle.mockImplementation(original);
      networkBack();
      await settle(POLL_MS * 10);

      expect(called(assetEndpoints.uploadPart)).toHaveLength(sent);
      expect(called(assetEndpoints.uploadStatus)).toHaveLength(0);
      expect(called(assetEndpoints.completeUpload)).toHaveLength(0);
    });

    it('tells the network wait to stop when the caller unsubscribes', async () => {
      failFrom(assetEndpoints.uploadPart, offline, secondPart);
      let signal: AbortSignal | undefined;
      const online = vi.fn((given: AbortSignal) => {
        signal = given;
        return new Promise<void>(() => undefined);
      });
      const subscription = upload(fileOf(PART * 2 + 5), { online }).subscribe();
      await settle();
      expect(signal?.aborted).toBe(false);

      subscription.unsubscribe();
      expect(signal?.aborted).toBe(true);
    });

    it('sends cancelUpload for the upload and answers when the server canceled it', async () => {
      let id = '';
      const subscription = upload(fileOf(PART * 2)).subscribe((e) => {
        if (e.type === 'started') id = e.uploadId;
      });
      await vi.waitFor(() => expect(id).not.toBe(''), { timeout: 2000 });
      subscription.unsubscribe();
      let status: string | undefined;
      cancelUpload(client, id).subscribe((u) => (status = u.status));
      await settle();
      expect(status).toBe('canceled');
      expect(called(assetEndpoints.cancelUpload)).toHaveLength(1);
    });
  });

  describe('a lost connection', () => {
    /** Fails the first request that matches, the way a dead network or a 503 does. */
    function failOnce(
      endpoint: AnyEndpoint,
      reply: () => FakeReply,
      when: (request: FakeRequest) => boolean = () => true,
    ) {
      let failed = false;
      handle.mockImplementation((e, request) => {
        if (e === endpoint && !failed && when(request)) {
          failed = true;
          return reply();
        }
        return original(e, request);
      });
    }
    it('waits for the network, reads the manifest and goes on from the first missing part', async () => {
      failOnce(assetEndpoints.uploadPart, offline, secondPart);
      const online = vi.fn(() => Promise.resolve());
      await run(upload(fileOf(PART * 2 + 5), { online }), POLL_MS * 3);
      expect(types()).toContain('waiting');
      expect(online).toHaveBeenCalledTimes(1);
      expect(called(assetEndpoints.uploadStatus).length).toBeGreaterThan(0);
      expect(sentParts().map((p) => p.part)).toEqual([1, 2, 2, 3]);
      expect(last()).toMatchObject({ type: 'ready' });
    });

    it('does not send a part again when the server took it and only the answer was lost', async () => {
      handle.mockImplementation((e, request) => {
        const reply = original(e, request);
        return e === assetEndpoints.uploadPart && secondPart(request)
          ? offline()
          : reply;
      });
      let calls = 0;
      const online = () => {
        calls++;
        handle.mockImplementation(original);
        return Promise.resolve();
      };
      await run(upload(fileOf(PART * 2 + 5), { online }), POLL_MS * 3);
      expect(calls).toBe(1);
      expect(sentParts().map((p) => p.part)).toEqual([1, 2, 3]);
      expect(last()).toMatchObject({ type: 'ready' });
    });

    it('retries a server error after a pause, not at once', async () => {
      failOnce(assetEndpoints.uploadPart, unavailable, secondPart);
      await run(upload(fileOf(PART * 2 + 5)), 0);
      expect(last()).toMatchObject({ type: 'waiting' });
      expect(sentParts().map((p) => p.part)).toEqual([1, 2]);
      await settle(POLL_MS * 4);
      expect(last()).toMatchObject({ type: 'ready' });
    });

    it('gives up on a server that keeps failing and shows its message', async () => {
      handle.mockImplementation((e, request) =>
        e === assetEndpoints.uploadPart ? unavailable() : original(e, request),
      );
      await run(upload(fileOf(100)), 60 * 60 * 1000);
      expect(last()).toMatchObject({
        type: 'failed',
        message: 'Lỗi hệ thống',
        retryProcessing: false,
      });
    });
  });
});
