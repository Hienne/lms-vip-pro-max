import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';

// Mirrors the backend's asset library and chunked upload (/api/v1/learning-assets): a file goes
// up in parts with a whole-file SHA-256, then the server checks it (codec, duration, pages)
// before it is `ready`. The app never trusts file facts it read itself.

export const AssetStatusSchema = z.enum([
  'uploading',
  'completing',
  'processing',
  'ready',
  'failed',
  'canceling',
  'canceled',
  'expired',
  'deleted',
  'deleting',
]);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const MediaKindSchema = z.enum([
  'video',
  'document',
  'image',
  'attachment',
]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

/** A library row: no storage key, credential or provider upload id. */
export const LibraryAssetSchema = z.object({
  id: z.number().int(),
  ownerOrgId: z.number().int(),
  originalName: z.string(),
  displayName: z.string().nullish(),
  description: z.string().nullish(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  mediaType: MediaKindSchema,
  status: AssetStatusSchema,
  createTime: BackendDateTimeSchema.nullish(),
});
export type LibraryAsset = z.infer<typeof LibraryAssetSchema>;

/** The library list; `sort` is `name` or `createTime` as `field,asc|desc` (any other field is refused). */
export const AssetListQuerySchema = PageQuerySchema.extend({
  q: z.string().optional(),
  mediaType: MediaKindSchema.optional(),
  status: AssetStatusSchema.optional(),
  includeDeleting: z.boolean().optional(),
});
export type AssetListQuery = z.infer<typeof AssetListQuerySchema>;

/** The largest file the backend accepts at all (a video); each kind has a lower limit of its own. */
export const ASSET_MAX_BYTES = 500_000_000;

/** `requestId` is the idempotency key and becomes the `uploadId`. */
export const StartUploadCommandSchema = z.object({
  requestId: z.uuid(),
  ownerOrgId: z.number().int().positive(),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(1).max(ASSET_MAX_BYTES),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  displayName: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
});
export type StartUploadCommand = z.infer<typeof StartUploadCommandSchema>;

/** The checksum header of one part. */
export const PartHeadersSchema = z.object({
  'X-Part-SHA256': z.string().regex(/^[0-9a-f]{64}$/),
});

/**
 * The `errorCode` of a failed upload whose file is fine but whose processing could not run (for
 * example `ffmpeg` is missing on the server): completing again retries it.
 */
export const MEDIA_PROCESSING_UNAVAILABLE_CODE =
  'LEARNING-MEDIA_PROCESSING_UNAVAILABLE';

export const UploadPartSchema = z.object({
  partNumber: z.number().int(),
  sizeBytes: z.number().int(),
  checksumSha256: z.string(),
});
export type UploadPart = z.infer<typeof UploadPartSchema>;

/** The manifest of acknowledged parts, and the processing outcome once the upload is complete. */
export const UploadSchema = z.object({
  uploadId: z.uuid(),
  assetId: z.number().int().nullish(),
  status: AssetStatusSchema,
  totalBytes: z.number().int(),
  uploadedBytes: z.number().int(),
  /** The size of every part but the last; the server decides, the app slices by it. */
  partSize: z.number().int(),
  expiresAt: BackendDateTimeSchema.nullish(),
  parts: z.array(UploadPartSchema),
  errorCode: z.string().nullish(),
  errorMessage: z.string().nullish(),
  mimeType: z.string().nullish(),
  durationSeconds: z.number().nullish(),
  pageCount: z.number().int().nullish(),
  mediaCheckedAt: BackendDateTimeSchema.nullish(),
});
export type Upload = z.infer<typeof UploadSchema>;
