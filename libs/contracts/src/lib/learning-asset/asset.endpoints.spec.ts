import { toUrl } from '../http/endpoint';
import { MESSAGE_CODE_KIND } from '../http/envelope';
import { PageSchema } from '../http/page';
import { assetEndpoints } from './asset.endpoints';
import {
  AssetListQuerySchema,
  LibraryAssetSchema,
  MEDIA_PROCESSING_UNAVAILABLE_CODE,
  StartUploadCommandSchema,
  UploadSchema,
} from './asset.schema';

// Answers captured from the local backend (corebanking-academy, 2026-10-27).
const upload = {
  uploadId: 'cc7c1202-dd27-40d0-ad9e-2db72d721e2c',
  assetId: 7,
  status: 'uploading',
  totalBytes: 1116,
  uploadedBytes: 1116,
  partSize: 8388608,
  expiresAt: '2026-10-28T03:39:11.730481Z',
  parts: [
    {
      partNumber: 1,
      sizeBytes: 1116,
      checksumSha256:
        '5adaa3c516398a571be43b7ad5e44ab7f3b25de54a895684723166babef31988',
    },
  ],
  errorCode: null,
  errorMessage: null,
  mimeType: 'application/pdf',
  durationSeconds: null,
  pageCount: null,
  mediaCheckedAt: null,
};

const libraryRow = {
  id: 7,
  ownerOrgId: 1,
  originalName: 'doc.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1116,
  mediaType: 'document',
  status: 'ready',
  createTime: '2026-10-27T03:39:11.716318Z',
};

const sha = 'a'.repeat(64);

describe('assetEndpoints', () => {
  it('lists the library with the query the table sends', () => {
    expect(assetEndpoints.listAssets.method).toBe('get');
    expect(toUrl(assetEndpoints.listAssets)).toBe('/api/v1/learning-assets');
    expect(
      AssetListQuerySchema.parse({
        q: 'doc',
        mediaType: 'document',
        status: 'ready',
        page: 0,
        size: 20,
        sort: 'createTime,desc',
      }),
    ).toMatchObject({ mediaType: 'document' });
    expect(AssetListQuerySchema.safeParse({ mediaType: 'audio' }).success).toBe(
      false,
    );
    const page = PageSchema(LibraryAssetSchema).parse({
      items: [libraryRow],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    expect(page.items[0].mediaType).toBe('document');
  });

  it('starts an upload with the file facts and reads the manifest back', () => {
    expect(assetEndpoints.startUpload.method).toBe('post');
    expect(toUrl(assetEndpoints.startUpload)).toBe(
      '/api/v1/learning-assets/uploads',
    );
    expect(
      StartUploadCommandSchema.safeParse({
        requestId: 'cc7c1202-dd27-40d0-ad9e-2db72d721e2c',
        ownerOrgId: 1,
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1116,
        checksumSha256: sha,
      }).success,
    ).toBe(true);
    expect(UploadSchema.parse(upload).parts[0].partNumber).toBe(1);
  });

  it.each([
    ['an empty file', { sizeBytes: 0 }],
    ['a file over 500 MB', { sizeBytes: 500_000_001 }],
    ['an upper-case checksum', { checksumSha256: 'A'.repeat(64) }],
    ['a short checksum', { checksumSha256: 'a'.repeat(63) }],
    ['a request id that is not a UUID', { requestId: 'abc' }],
  ])('refuses %s before any request is sent', (_name, patch) => {
    expect(
      StartUploadCommandSchema.safeParse({
        requestId: 'cc7c1202-dd27-40d0-ad9e-2db72d721e2c',
        ownerOrgId: 1,
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1116,
        checksumSha256: sha,
        ...patch,
      }).success,
    ).toBe(false);
  });

  it('sends a part as a binary body with its checksum header', () => {
    const endpoint = assetEndpoints.uploadPart;
    expect(endpoint.method).toBe('put');
    expect(endpoint.encoding).toBe('binary');
    expect(Object.keys(endpoint.headers.shape)).toEqual(['X-Part-SHA256']);
    expect(toUrl(endpoint, { uploadId: upload.uploadId, partNumber: 2 })).toBe(
      `/api/v1/learning-assets/uploads/${upload.uploadId}/parts/2`,
    );
    expect(endpoint.headers.safeParse({ 'X-Part-SHA256': sha }).success).toBe(
      true,
    );
    expect(endpoint.headers.safeParse({ 'X-Part-SHA256': 'xyz' }).success).toBe(
      false,
    );
  });

  it('polls, completes and cancels an upload by its id', () => {
    const params = { uploadId: upload.uploadId };
    expect(assetEndpoints.uploadStatus.method).toBe('get');
    expect(toUrl(assetEndpoints.uploadStatus, params)).toBe(
      `/api/v1/learning-assets/uploads/${upload.uploadId}`,
    );
    expect(assetEndpoints.completeUpload.method).toBe('post');
    expect(toUrl(assetEndpoints.completeUpload, params)).toBe(
      `/api/v1/learning-assets/uploads/${upload.uploadId}/complete`,
    );
    expect(assetEndpoints.cancelUpload.method).toBe('delete');
    expect(toUrl(assetEndpoints.cancelUpload, params)).toBe(
      `/api/v1/learning-assets/uploads/${upload.uploadId}`,
    );
  });

  it('deletes a library file by its id and answers no data', () => {
    expect(assetEndpoints.deleteAsset.method).toBe('delete');
    expect(toUrl(assetEndpoints.deleteAsset, { assetId: 7 })).toBe(
      '/api/v1/learning-assets/7',
    );
    expect(assetEndpoints.deleteAsset.response.safeParse(null).success).toBe(
      true,
    );
  });

  it('reads the processing outcome of a finished or failed upload', () => {
    expect(
      UploadSchema.parse({
        ...upload,
        status: 'ready',
        durationSeconds: 30,
        mediaCheckedAt: '2026-10-27T03:33:59.110303Z',
      }).durationSeconds,
    ).toBe(30);
    expect(
      UploadSchema.parse({
        ...upload,
        status: 'failed',
        errorCode: MEDIA_PROCESSING_UNAVAILABLE_CODE,
        errorMessage: 'Máy chủ chưa xử lý được tệp.',
      }).errorCode,
    ).toBe('LEARNING-MEDIA_PROCESSING_UNAVAILABLE');
  });
});

describe('the refusals an upload can meet', () => {
  it.each([
    'LEARNING-UPLOAD_FILE_MISMATCH',
    'LEARNING-UPLOAD_EXPIRED',
    'LEARNING-UPLOAD_PART_CONFLICT',
    'LEARNING-ASSET_INVALID',
    'LEARNING-ASSET_CODEC_UNSUPPORTED',
    'LEARNING-ASSET_IN_USE',
  ])('%s is a refusal, not a system failure', (code) => {
    expect(MESSAGE_CODE_KIND[code as keyof typeof MESSAGE_CODE_KIND]).toBe(
      'refused',
    );
  });
});
