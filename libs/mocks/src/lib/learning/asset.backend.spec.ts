import {
  assetEndpoints,
  authV1Endpoints,
  LibraryAssetSchema,
  PageSchema,
  UploadSchema,
  type AnyEndpoint,
  type LibraryAsset,
  type Upload,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

const LibraryPage = PageSchema(LibraryAssetSchema);
const PART = 8 * 1024 * 1024;
const sha = (digit: string) => digit.repeat(64);

describe('the asset library and chunked upload of the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = login('giangvien');
  });

  const call = (
    endpoint: AnyEndpoint,
    as: string | null,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token: as,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
      headers: request.headers,
    }) as FakeReply;

  function login(username: string): string {
    return (
      call(authV1Endpoints.login, null, {
        body: { username, password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  }

  const code = (reply: FakeReply) => reply.body.messageCode;
  let counter = 0;
  const requestId = () =>
    `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

  const start = (
    over: Partial<{
      requestId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      checksumSha256: string;
    }> = {},
  ) =>
    call(assetEndpoints.startUpload, token, {
      body: {
        requestId: requestId(),
        ownerOrgId: 1,
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        checksumSha256: sha('a'),
        ...over,
      },
    });
  const view = (reply: FakeReply): Upload =>
    UploadSchema.parse(reply.body.data);
  const params = (uploadId: string, partNumber?: number) => ({
    uploadId,
    ...(partNumber ? { partNumber: String(partNumber) } : {}),
  });
  const put = (
    uploadId: string,
    partNumber: number,
    bytes: number,
    digit = 'b',
  ) =>
    call(assetEndpoints.uploadPart, token, {
      params: params(uploadId, partNumber),
      body: new Blob([new Uint8Array(bytes)]),
      headers: { 'X-Part-SHA256': sha(digit) },
    });
  const status = (uploadId: string) =>
    call(assetEndpoints.uploadStatus, token, { params: params(uploadId) });
  const complete = (uploadId: string) =>
    call(assetEndpoints.completeUpload, token, { params: params(uploadId) });
  const list = (query: Record<string, string> = {}): LibraryAsset[] =>
    LibraryPage.parse(
      call(assetEndpoints.listAssets, token, {
        query: { size: '100', ...query },
      }).body.data,
    ).items;

  /** Uploads a whole file in one part and polls it to its end state. */
  function uploadWhole(over: Parameters<typeof start>[0], bytes: number) {
    const started = view(start({ sizeBytes: bytes, ...over }));
    put(started.uploadId, 1, bytes);
    complete(started.uploadId);
    status(started.uploadId);
    return view(status(started.uploadId));
  }

  describe('starting an upload', () => {
    it('answers the manifest of a new upload: no parts, the server part size, an asset id', () => {
      const started = view(start({ sizeBytes: 1000 }));
      expect(started).toMatchObject({
        status: 'uploading',
        totalBytes: 1000,
        uploadedBytes: 0,
        partSize: PART,
        parts: [],
        mimeType: 'application/pdf',
      });
      expect(started.assetId).toBeGreaterThan(0);
    });

    it('is idempotent on the request id: the same upload comes back, not a second one', () => {
      const id = requestId();
      const first = view(start({ requestId: id }));
      put(first.uploadId, 1, 1000);
      const again = view(start({ requestId: id }));
      expect(again.uploadId).toBe(first.uploadId);
      expect(again.assetId).toBe(first.assetId);
      expect(again.uploadedBytes).toBe(1000);
    });

    it('uses the request id as the upload id', () => {
      const id = requestId();
      expect(view(start({ requestId: id })).uploadId).toBe(id);
    });

    it('refuses the same request id with another file', () => {
      const id = requestId();
      start({ requestId: id });
      expect(code(start({ requestId: id, sizeBytes: 2000 }))).toBe(
        'LEARNING-UPLOAD_FILE_MISMATCH',
      );
    });

    it('refuses a command the schema rejects', () => {
      expect(code(start({ checksumSha256: 'xyz' }))).toBe(
        'CORE-VALIDATION_FAILED',
      );
    });

    it('answers 401 without a token', () => {
      const reply = call(assetEndpoints.startUpload, null, { body: {} });
      expect(reply.status).toBe(401);
    });
  });

  describe('parts', () => {
    it('records each part in the manifest and counts the bytes', () => {
      const started = view(start({ sizeBytes: PART + 100 }));
      const first = view(put(started.uploadId, 1, PART));
      expect(first.uploadedBytes).toBe(PART);
      expect(first.parts).toEqual([
        { partNumber: 1, sizeBytes: PART, checksumSha256: sha('b') },
      ]);
      const second = view(put(started.uploadId, 2, 100));
      expect(second.uploadedBytes).toBe(PART + 100);
      expect(second.parts.map((p) => p.partNumber)).toEqual([1, 2]);
      expect(view(status(started.uploadId)).parts).toHaveLength(2);
    });

    it('takes the same part again with the same checksum without counting it twice', () => {
      const started = view(start({ sizeBytes: 1000 }));
      put(started.uploadId, 1, 1000);
      expect(view(put(started.uploadId, 1, 1000)).uploadedBytes).toBe(1000);
    });

    it('refuses a part number that exists with another checksum', () => {
      const started = view(start({ sizeBytes: 1000 }));
      put(started.uploadId, 1, 1000, 'b');
      expect(code(put(started.uploadId, 1, 1000, 'c'))).toBe(
        'LEARNING-UPLOAD_PART_CONFLICT',
      );
    });

    it('refuses a part of the wrong size, and a part number past the end', () => {
      const started = view(start({ sizeBytes: PART + 100 }));
      expect(code(put(started.uploadId, 1, 10))).toBe(
        'LEARNING-UPLOAD_FILE_MISMATCH',
      );
      expect(code(put(started.uploadId, 3, 100))).toBe(
        'LEARNING-UPLOAD_FILE_MISMATCH',
      );
    });

    it('refuses a part with no checksum header', () => {
      const started = view(start({ sizeBytes: 1000 }));
      const reply = call(assetEndpoints.uploadPart, token, {
        params: params(started.uploadId, 1),
        body: new Blob([new Uint8Array(1000)]),
      });
      expect(code(reply)).toBe('CORE-VALIDATION_FAILED');
    });

    it('does not know an upload nobody started', () => {
      expect(code(status(requestId()))).toBe('CORE-RESOURCE_NOT_FOUND');
    });
  });

  describe('completing', () => {
    it('refuses to complete while bytes are missing', () => {
      const started = view(start({ sizeBytes: PART + 100 }));
      put(started.uploadId, 1, PART);
      expect(code(complete(started.uploadId))).toBe(
        'LEARNING-UPLOAD_FILE_MISMATCH',
      );
    });

    it('goes completing, then processing on the first poll and ready on the second', () => {
      const started = view(start({ sizeBytes: 1000 }));
      put(started.uploadId, 1, 1000);
      expect(view(complete(started.uploadId)).status).toBe('completing');
      expect(view(status(started.uploadId)).status).toBe('processing');
      const ready = view(status(started.uploadId));
      expect(ready.status).toBe('ready');
      expect(ready.assetId).toBe(started.assetId);
      expect(view(status(started.uploadId)).status).toBe('ready');
    });

    it('reads the file facts from the "server": a PDF has pages, a video a duration', () => {
      expect(
        uploadWhole(
          { originalName: 'a.pdf', mimeType: 'application/pdf' },
          500,
        ),
      ).toMatchObject({ pageCount: 8, durationSeconds: null });
      expect(
        uploadWhole({ originalName: 'a.mp4', mimeType: 'video/mp4' }, 500),
      ).toMatchObject({ durationSeconds: 120, pageCount: null });
    });

    it('puts the finished file in the library as a ready row of its kind', () => {
      const done = uploadWhole(
        { originalName: 'bao-cao.mp4', mimeType: 'video/mp4' },
        500,
      );
      const row = list({ q: 'bao-cao' })[0];
      expect(row).toMatchObject({
        id: done.assetId,
        originalName: 'bao-cao.mp4',
        mediaType: 'video',
        status: 'ready',
        sizeBytes: 500,
      });
    });

    it('does not complete a canceled upload', () => {
      const started = view(start({ sizeBytes: 1000 }));
      call(assetEndpoints.cancelUpload, token, {
        params: params(started.uploadId),
      });
      expect(code(complete(started.uploadId))).toBe('LEARNING-UPLOAD_EXPIRED');
    });
  });

  describe('cancelling', () => {
    it('ends the upload: the status says canceled and a part is refused as expired', () => {
      const started = view(start({ sizeBytes: 1000 }));
      const canceled = view(
        call(assetEndpoints.cancelUpload, token, {
          params: params(started.uploadId),
        }),
      );
      expect(canceled.status).toBe('canceled');
      expect(view(status(started.uploadId)).status).toBe('canceled');
      expect(code(put(started.uploadId, 1, 1000))).toBe(
        'LEARNING-UPLOAD_EXPIRED',
      );
    });

    it('does not undo a finished upload', () => {
      const done = uploadWhole({ originalName: 'x.pdf' }, 500);
      const reply = call(assetEndpoints.cancelUpload, token, {
        params: params(done.uploadId),
      });
      expect(code(reply)).toBe('CORE-STATE_CONFLICT');
    });
  });

  describe('the library', () => {
    it('lists ready files of every kind from the seeded courses and the extras', () => {
      const rows = list();
      expect(new Set(rows.map((r) => r.mediaType))).toEqual(
        new Set(['video', 'document', 'image', 'attachment']),
      );
      expect(rows.every((r) => r.status === 'ready')).toBe(true);
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    });

    it('filters by kind and by a name search', () => {
      expect(
        list({ mediaType: 'image' }).every((r) => r.mediaType === 'image'),
      ).toBe(true);
      expect(list({ q: 'zzz-nothing' })).toEqual([]);
      const some = list()[0];
      expect(
        list({ q: some.originalName.slice(1, 4).toUpperCase() }).map(
          (r) => r.id,
        ),
      ).toContain(some.id);
    });

    it('filters by status: an upload in flight is not ready', () => {
      const started = view(start({ originalName: 'dang-tai.pdf' }));
      expect(list({ q: 'dang-tai' })).toHaveLength(1);
      expect(list({ q: 'dang-tai', status: 'ready' })).toEqual([]);
      expect(list({ q: 'dang-tai', status: 'uploading' })[0].id).toBe(
        started.assetId,
      );
    });

    it('sorts by name or creation time and refuses another field', () => {
      const names = list({ sort: 'name,asc' }).map((r) => r.originalName);
      expect(names).toEqual(
        [...names].sort((a, b) => a.localeCompare(b, 'vi')),
      );
      const times = list({ sort: 'createTime,desc' }).map(
        (r) => r.createTime ?? '',
      );
      expect(times).toEqual([...times].sort().reverse());
      const reply = call(assetEndpoints.listAssets, token, {
        query: { sort: 'sizeBytes,desc' },
      });
      expect(code(reply)).toBe('CORE-VALIDATION_FAILED');
    });

    it('pages on the server', () => {
      const all = list();
      const page = LibraryPage.parse(
        call(assetEndpoints.listAssets, token, {
          query: { page: '1', size: '2', sort: 'name,asc' },
        }).body.data,
      );
      expect(page).toMatchObject({
        page: 1,
        size: 2,
        totalElements: all.length,
        totalPages: Math.ceil(all.length / 2),
      });
      expect(page.items).toHaveLength(Math.min(2, Math.max(0, all.length - 2)));
    });
  });

  describe('deleting', () => {
    const remove = (assetId: number) =>
      call(assetEndpoints.deleteAsset, token, {
        params: { assetId: String(assetId) },
      });

    it('removes an uploaded file nothing uses, and answers no data', () => {
      const done = uploadWhole({ originalName: 'bo-di.pdf' }, 500);
      const reply = remove(done.assetId as number);
      expect(reply.status).toBe(200);
      expect(reply.body.data).toBeNull();
      expect(list({ q: 'bo-di' })).toEqual([]);
    });

    it('is idempotent: a file that is already gone answers success', () => {
      expect(code(remove(987654))).toBe('CORE-SUCCESS');
    });

    it('refuses a file a seeded course uses, with ASSET_IN_USE', () => {
      const used = list().filter(
        (r) => code(remove(r.id)) === 'LEARNING-ASSET_IN_USE',
      );
      expect(used.length).toBeGreaterThan(0);
      expect(list().length).toBeGreaterThanOrEqual(used.length);
    });

    it('removes an unused library extra', () => {
      const before = list();
      const removed = before.filter(
        (r) => code(remove(r.id)) === 'CORE-SUCCESS',
      );
      expect(removed.length).toBeGreaterThan(0);
      expect(list()).toHaveLength(before.length - removed.length);
    });
  });
});
