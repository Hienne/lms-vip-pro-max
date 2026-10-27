import {
  assetEndpoints,
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
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  status: AssetStatus;
  readonly parts: Map<number, { sizeBytes: number; checksumSha256: string }>;
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

  constructor(private readonly deps: AssetLibraryDeps) {}

  entries(): [AnyEndpoint, Handler][] {
    return [
      [assetEndpoints.listAssets, (r) => this.list(r)],
      [assetEndpoints.startUpload, (r) => this.start(r)],
      [assetEndpoints.uploadStatus, (r) => this.poll(r)],
      [assetEndpoints.uploadPart, (r) => this.putPart(r)],
      [assetEndpoints.completeUpload, (r) => this.complete(r)],
      [assetEndpoints.cancelUpload, (r) => this.cancel(r)],
      [assetEndpoints.deleteAsset, (r) => this.remove(r)],
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
      mimeType: command.mimeType,
      sizeBytes: command.sizeBytes,
      checksumSha256: command.checksumSha256,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + DAY).toISOString(),
      status: 'uploading',
      parts: new Map(),
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
    const kind = mediaKindOf(record.mimeType);
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
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      mediaType: mediaKindOf(asset.mimeType),
      status,
      createTime: asset.createTime,
    };
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
        (row) => !needle || row.originalName.toLowerCase().includes(needle),
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
