import {
  assetEndpoints,
  courseEndpoints,
  StartUploadCommandSchema,
  type AnyEndpoint,
  type AssetStatus,
  type LearningAsset,
  type LibraryAsset,
  type MediaKind,
  type Upload,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { ok, refuse } from './learning-reply';

type Handler = (request: FakeRequest) => FakeReply;

/** The backend's part size: every part but the last is exactly this long. */
const PART_SIZE = 8 * 1024 * 1024;
const DAY = 86_400_000;
const SHA256 = /^[0-9a-f]{64}$/;

/** What the server reads from a finished file; the mock never opens the bytes. */
const VIDEO_SECONDS = 120;
const PDF_PAGES = 8;

/** A 1×1 grey PNG: what the mock serves for a seeded image, which has no bytes. */
const PLACEHOLDER_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGM4AQAAygDJmcpdfgAAAABJRU5ErkJggg==';

/** The library sorts the backend accepts: anything else is a validation failure. */
const SORTS: Readonly<Record<string, (a: LibraryAsset) => string>> = {
  name: (row) => row.originalName,
  createTime: (row) => row.createTime ?? '',
};

interface UploadRecord {
  readonly uploadId: string;
  readonly assetId: number;
  readonly ownerOrgId: number;
  readonly uploadedBy: string;
  readonly originalName: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  status: AssetStatus;
  readonly parts: Map<number, { sizeBytes: number; checksumSha256: string }>;
  /** The parts' bytes, so the finished file is served back as uploaded. */
  readonly blobs: Map<number, Blob>;
  /** Status polls since `complete`: the first sees `processing`, the second `ready`. */
  polls: number;
}

export interface AssetLibraryDeps {
  callerId(request: FakeRequest): string;
  /** The files courses are built from: shared with the course trees, so an upload can be attached. */
  readonly assets: LearningAsset[];
  /** Library files that exist before anyone uploads: the seeded courses' and the extras. */
  readonly seeded: readonly LearningAsset[];
  /** The asset ids some course draft or revision uses. */
  used(): ReadonlySet<number>;
  /**
   * Whether the asset is a course cover, and if so whether one of those courses is published and
   * active (so every signed-in learner sees it in the catalogue). `undefined` when no course uses it
   * as its cover.
   */
  coverOfVisibleCourse(assetId: number): boolean | undefined;
  id(): number;
}

export function mediaKindOf(mimeType: string): MediaKind {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  return 'attachment';
}

/**
 * The asset library and the chunked upload in memory: a start that is idempotent on the request id,
 * parts recorded by number (the mock does not re-hash bytes, so it checks sizes and a part number
 * that comes back with another checksum), `complete` that moves through `completing` and
 * `processing` to `ready` over two status polls, cancel, a filtered library and delete that refuses
 * a file a course uses.
 */
export class AssetLibrary {
  private readonly uploads = new Map<string, UploadRecord>();
  private readonly deleted = new Set<number>();
  private readonly metadata = new Map<
    number,
    { displayName?: string; description?: string }
  >();
  /** The bytes of the files uploaded in this session; seeded files have none. */
  private readonly bytes = new Map<number, Blob>();

  constructor(private readonly deps: AssetLibraryDeps) {}

  asset(id: number): LearningAsset | undefined {
    if (this.deleted.has(id)) return undefined;
    return (
      this.deps.assets.find((asset) => asset.id === id) ??
      this.deps.seeded.find((asset) => asset.id === id)
    );
  }

  entries(): [AnyEndpoint, Handler][] {
    return [
      [assetEndpoints.listAssets, (r) => this.list(r)],
      [assetEndpoints.findDuplicates, (r) => this.duplicates(r)],
      [assetEndpoints.updateMetadata, (r) => this.updateMetadata(r)],
      [assetEndpoints.startUpload, (r) => this.start(r)],
      [assetEndpoints.uploadStatus, (r) => this.poll(r)],
      [assetEndpoints.uploadPart, (r) => this.putPart(r)],
      [assetEndpoints.completeUpload, (r) => this.complete(r)],
      [assetEndpoints.cancelUpload, (r) => this.cancel(r)],
      [assetEndpoints.deleteAsset, (r) => this.remove(r)],
      [assetEndpoints.deleteAssetPermanently, (r) => this.remove(r)],
      [courseEndpoints.getAssetContent, (r) => this.content(r)],
    ];
  }

  // ---- upload -------------------------------------------------------------------------------

  private start(request: FakeRequest): FakeReply {
    const userId = this.deps.callerId(request);
    const parsed = StartUploadCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const command = parsed.data;
    const existing = this.uploads.get(command.requestId);
    if (existing) {
      const same =
        existing.originalName === command.originalName &&
        existing.sizeBytes === command.sizeBytes &&
        existing.checksumSha256 === command.checksumSha256;
      return same ? ok(this.view(existing)) : refuse('uploadFileMismatch');
    }
    const now = Date.now();
    const record: UploadRecord = {
      uploadId: command.requestId,
      assetId: this.deps.id(),
      ownerOrgId: command.ownerOrgId,
      uploadedBy: userId,
      originalName: command.originalName,
      displayName: command.displayName?.trim() || command.originalName,
      description: command.description?.trim() || undefined,
      mimeType: command.mimeType,
      sizeBytes: command.sizeBytes,
      checksumSha256: command.checksumSha256,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + DAY).toISOString(),
      status: 'uploading',
      parts: new Map(),
      blobs: new Map(),
      polls: 0,
    };
    this.uploads.set(record.uploadId, record);
    return ok(this.view(record));
  }

  private poll(request: FakeRequest): FakeReply {
    const record = this.record(request);
    if (record.status === 'completing') {
      record.status = 'processing';
    } else if (record.status === 'processing') {
      this.finish(record);
    }
    return ok(this.view(record));
  }

  private putPart(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const partNumber = Number(request.params['partNumber']);
    const checksum = request.headers?.['X-Part-SHA256'];
    const body = request.body;
    if (!checksum || !SHA256.test(checksum) || !(body instanceof Blob)) {
      return refuse('validationFailed');
    }
    if (record.status !== 'uploading') return refuse('uploadExpired');
    const total = Math.ceil(record.sizeBytes / PART_SIZE);
    const last = partNumber === total;
    const expected = last
      ? record.sizeBytes - (total - 1) * PART_SIZE
      : PART_SIZE;
    if (
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > total ||
      body.size !== expected
    ) {
      return refuse('uploadFileMismatch');
    }
    const kept = record.parts.get(partNumber);
    if (kept && kept.checksumSha256 !== checksum) {
      return refuse('uploadPartConflict');
    }
    record.parts.set(partNumber, {
      sizeBytes: body.size,
      checksumSha256: checksum,
    });
    record.blobs.set(partNumber, body);
    return ok(this.view(record));
  }

  private complete(request: FakeRequest): FakeReply {
    const record = this.record(request);
    if (record.status === 'ready' || record.status === 'completing') {
      return ok(this.view(record));
    }
    if (record.status !== 'uploading') return refuse('uploadExpired');
    if (this.uploadedBytes(record) !== record.sizeBytes) {
      return refuse('uploadFileMismatch');
    }
    record.status = 'completing';
    record.polls = 0;
    return ok(this.view(record));
  }

  private cancel(request: FakeRequest): FakeReply {
    const record = this.record(request);
    if (record.status === 'ready') return refuse('stateConflict');
    record.status = 'canceled';
    return ok(this.view(record));
  }

  private record(request: FakeRequest): UploadRecord {
    this.deps.callerId(request);
    const record = this.uploads.get(request.params['uploadId'] ?? '');
    if (!record) return refuse('resourceNotFound');
    return record;
  }

  /** The processing step: the file becomes a library asset the course editor can attach. */
  private finish(record: UploadRecord): void {
    record.status = 'ready';
    this.metadata.set(record.assetId, {
      displayName: record.displayName,
      description: record.description,
    });
    const kind = mediaKindOf(record.mimeType);
    const parts = [...record.blobs.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, blob]) => blob);
    this.bytes.set(record.assetId, new Blob(parts, { type: record.mimeType }));
    this.deps.assets.push({
      id: record.assetId,
      ownerOrgId: record.ownerOrgId,
      uploadedBy: record.uploadedBy,
      storageType: 's3',
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      checksumSha256: record.checksumSha256,
      durationSeconds: kind === 'video' ? VIDEO_SECONDS : null,
      pageCount: record.mimeType === 'application/pdf' ? PDF_PAGES : null,
      width: null,
      height: null,
      status: 'ready',
      rowVersion: 0,
      createTime: record.createdAt,
      updateTime: new Date().toISOString(),
    });
  }

  private uploadedBytes(record: UploadRecord): number {
    return [...record.parts.values()].reduce((sum, p) => sum + p.sizeBytes, 0);
  }

  private view(record: UploadRecord): Upload {
    const ready = record.status === 'ready';
    const kind = mediaKindOf(record.mimeType);
    return {
      uploadId: record.uploadId,
      assetId: record.assetId,
      status: record.status,
      totalBytes: record.sizeBytes,
      uploadedBytes: this.uploadedBytes(record),
      partSize: PART_SIZE,
      expiresAt: record.expiresAt,
      parts: [...record.parts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([partNumber, part]) => ({ partNumber, ...part })),
      errorCode: null,
      errorMessage: null,
      mimeType: record.mimeType,
      durationSeconds: ready && kind === 'video' ? VIDEO_SECONDS : null,
      pageCount:
        ready && record.mimeType === 'application/pdf' ? PDF_PAGES : null,
      mediaCheckedAt: ready ? new Date().toISOString() : null,
    };
  }

  // ---- library ------------------------------------------------------------------------------

  private duplicates(request: FakeRequest): FakeReply {
    const userId = this.deps.callerId(request);
    const body = request.body as {
      ownerOrgId: number;
      checksumSha256: string;
      sizeBytes: number;
      mediaType: string;
    };
    const matches = [...this.uploads.values()]
      .filter(
        (record) =>
          record.uploadedBy === userId &&
          record.ownerOrgId === body.ownerOrgId &&
          record.status === 'ready' &&
          record.checksumSha256 === body.checksumSha256 &&
          record.sizeBytes === body.sizeBytes &&
          mediaKindOf(record.mimeType) === body.mediaType &&
          !this.deleted.has(record.assetId),
      )
      .map((record) => this.asset(record.assetId))
      .filter((asset): asset is LearningAsset => !!asset)
      .map((asset) => this.row(asset, 'ready'));
    return ok(matches.slice(0, 10));
  }

  private rows(): LibraryAsset[] {
    const files = [...this.deps.seeded, ...this.deps.assets]
      .filter((asset) => !this.deleted.has(asset.id))
      .map((asset): LibraryAsset => this.row(asset, 'ready'));
    const inFlight = [...this.uploads.values()]
      .filter((record) => record.status !== 'ready')
      .map(
        (record): LibraryAsset => ({
          id: record.assetId,
          ownerOrgId: record.ownerOrgId,
          originalName: record.originalName,
          mimeType: record.mimeType,
          sizeBytes: record.sizeBytes,
          mediaType: mediaKindOf(record.mimeType),
          status: record.status,
          createTime: record.createdAt,
        }),
      );
    return [...files, ...inFlight];
  }

  private row(asset: LearningAsset, status: AssetStatus): LibraryAsset {
    return {
      id: asset.id,
      ownerOrgId: asset.ownerOrgId,
      originalName: asset.originalName,
      ...this.metadata.get(asset.id),
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      mediaType: mediaKindOf(asset.mimeType),
      status,
      createTime: asset.createTime,
    };
  }

  private updateMetadata(request: FakeRequest): FakeReply {
    this.deps.callerId(request);
    const id = Number(request.params['assetId']);
    if (!this.asset(id) || this.deleted.has(id))
      return refuse('learningNotFound');
    const body = request.body as {
      displayName: string;
      description: string | null;
    };
    if (
      !body.displayName?.trim() ||
      body.displayName.length > 255 ||
      (body.description?.length ?? 0) > 2000
    )
      return refuse('validationFailed');
    this.metadata.set(id, {
      displayName: body.displayName.trim(),
      description: body.description ?? undefined,
    });
    return ok(null);
  }

  private list(request: FakeRequest): FakeReply {
    this.deps.callerId(request);
    const { q, mediaType, status } = request.query;
    const [field = 'createTime', direction = 'desc'] = (
      request.query['sort'] ?? 'createTime,desc'
    ).split(',');
    const key = SORTS[field];
    if (!key || (direction !== 'asc' && direction !== 'desc')) {
      return refuse('validationFailed');
    }
    const needle = q?.trim().toLowerCase();
    const matching = this.rows()
      .filter((row) => !mediaType || row.mediaType === mediaType)
      .filter((row) => !status || row.status === status)
      .filter(
        (row) =>
          !needle ||
          [row.originalName, row.displayName, row.description].some((value) =>
            value?.toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => key(a).localeCompare(key(b), 'vi'));
    if (direction === 'desc') matching.reverse();
    const page = Number(request.query['page'] ?? 0);
    const size = Number(request.query['size'] ?? 20);
    return ok({
      items: matching.slice(page * size, page * size + size),
      page,
      size,
      totalElements: matching.length,
      totalPages: Math.ceil(matching.length / size),
    });
  }

  /**
   * The file of an asset that exists. A file uploaded in this session comes back with its bytes; a
   * seeded one has none, so an image comes back as a grey placeholder and any other file as a short
   * text, enough for a preview or a download.
   *
   * A course cover follows the server's rule (SPEC-learning-ui): anyone signed in may read the cover
   * of a published, active course (the mock's catalogue shows those to everyone); the cover of a
   * course nobody can see yet is refused to all but its uploader.
   */
  private content(request: FakeRequest): FakeReply {
    const userId = this.deps.callerId(request);
    const assetId = Number(request.params['assetId']);
    const asset = this.asset(assetId);
    if (!asset) return refuse('learningNotFound');
    if (
      this.deps.coverOfVisibleCourse(assetId) === false &&
      asset.uploadedBy !== userId
    ) {
      return refuse('accessDenied');
    }
    const kept = this.bytes.get(assetId);
    if (kept) return { ...ok(null), file: kept };
    const file = asset.mimeType.startsWith('image/')
      ? new Blob(
          [Uint8Array.from(atob(PLACEHOLDER_PNG), (c) => c.charCodeAt(0))],
          { type: 'image/png' },
        )
      : new Blob([`Tệp ${asset.originalName} (bản giả lập).`], {
          type: asset.mimeType,
        });
    return { ...ok(null), file };
  }

  private remove(request: FakeRequest): FakeReply {
    this.deps.callerId(request);
    const assetId = Number(request.params['assetId']);
    if (this.deps.used().has(assetId)) return refuse('assetInUse');
    const index = this.deps.assets.findIndex((asset) => asset.id === assetId);
    if (index >= 0) this.deps.assets.splice(index, 1);
    this.deleted.add(assetId);
    return ok(null);
  }
}
