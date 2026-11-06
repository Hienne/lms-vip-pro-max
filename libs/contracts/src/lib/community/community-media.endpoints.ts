import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';

const uploadParams = z.object({ uploadId: z.uuid() });
export const CommunityUploadSchema = z.object({
  uploadId: z.uuid(),
  assetId: z.number().int().positive(),
  status: z.string(),
  partSize: z.number().int().positive(),
  totalBytes: z.number().int().nonnegative(),
  uploadedBytes: z.number().int().nonnegative(),
  processingErrorCode: z.string().nullish(),
  retryAfterSeconds: z.number().int().nullish(),
});

/** Community media uses its own assets and revision-scoped, authenticated reads. */
export const communityMediaEndpoints = {
  startUpload: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/assets/uploads',
    body: z.strictObject({
      requestId: z.uuid(),
      originalName: z.string().min(1).max(255),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    response: CommunityUploadSchema,
  }),
  uploadPart: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/assets/uploads/{uploadId}/parts/{partNumber}',
    params: z.object({
      uploadId: z.uuid(),
      partNumber: z.number().int().positive(),
    }),
    encoding: 'binary',
    body: z.instanceof(Blob),
    headers: z.object({ 'X-Part-SHA256': z.string().regex(/^[0-9a-f]{64}$/) }),
    response: z.object({
      uploadId: z.uuid(),
      assetId: z.number().int().positive(),
      partNumber: z.number().int().positive(),
      sizeBytes: z.number().int().positive(),
      checksumSha256: z.string(),
      status: z.string(),
      uploadedBytes: z.number().int().nonnegative(),
    }),
  }),
  completeUpload: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/assets/uploads/{uploadId}/complete',
    params: uploadParams,
    response: CommunityUploadSchema,
  }),
  uploadStatus: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/assets/uploads/{uploadId}',
    params: uploadParams,
    response: CommunityUploadSchema,
  }),
  content: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/revision-assets/{revisionAssetId}/content',
    params: z.object({ revisionAssetId: z.number().int().positive() }),
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
};
