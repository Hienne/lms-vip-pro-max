import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AssetListQuerySchema,
  LibraryAssetSchema,
  PartHeadersSchema,
  StartUploadCommandSchema,
  UploadSchema,
} from './asset.schema';

const uploadParams = z.object({ uploadId: z.uuid() });

/** The backend's asset library and chunked upload (/api/v1/learning-assets). */
export const assetEndpoints = {
  /** The caller's library, filtered by kind and status and paged on the server. */
  listAssets: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-assets',
    query: AssetListQuerySchema,
    response: PageSchema(LibraryAssetSchema),
  }),
  /** Starts an upload, or returns the one the same `requestId` started (idempotent). */
  startUpload: defineEndpoint({
    method: 'post',
    path: '/api/v1/learning-assets/uploads',
    body: StartUploadCommandSchema,
    response: UploadSchema,
  }),
  /** The manifest of acknowledged parts: where a resumed upload continues. */
  uploadStatus: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-assets/uploads/{uploadId}',
    params: uploadParams,
    response: UploadSchema,
  }),
  /** One part, in order, as raw bytes with its own SHA-256 in `X-Part-SHA256`. */
  uploadPart: defineEndpoint({
    method: 'put',
    path: '/api/v1/learning-assets/uploads/{uploadId}/parts/{partNumber}',
    params: z.object({
      uploadId: z.uuid(),
      partNumber: z.number().int().positive(),
    }),
    encoding: 'binary',
    headers: PartHeadersSchema,
    body: z.instanceof(Blob),
    response: UploadSchema,
  }),
  /** Ends the upload; the server then processes the file (`completing`, `processing`, `ready`). */
  completeUpload: defineEndpoint({
    method: 'post',
    path: '/api/v1/learning-assets/uploads/{uploadId}/complete',
    params: uploadParams,
    response: UploadSchema,
  }),
  /** Cancels an upload that is not finished. */
  cancelUpload: defineEndpoint({
    method: 'delete',
    path: '/api/v1/learning-assets/uploads/{uploadId}',
    params: uploadParams,
    response: UploadSchema,
  }),
  /** Removes a library file; `LEARNING-ASSET_IN_USE` refuses one a course still uses. */
  deleteAsset: defineEndpoint({
    method: 'delete',
    path: '/api/v1/learning-assets/{assetId}',
    params: z.object({ assetId: z.number().int() }),
    response: z.null(),
  }),
};
