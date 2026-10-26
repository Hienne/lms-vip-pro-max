# Spec: `asset-library` (Phase 5)

Map: [SPEC.md](SPEC.md). Read `docs/conventions/angular.md`, `contracts-and-mocks.md`, `ui-library.md` and
`visual-design.md` first. Backend reference: `corebanking-academy/docs/api/LEARNING.md` → "Upload và kiểm file".

## Objective

In the course editor, an author attaches a file to a video, PDF, image or attachment block either by uploading it or
by picking one already in the library. Uploads go in 8 MiB parts with a whole-file SHA-256, show progress, survive a
dropped connection and a reload (the author picks the same file again), can be cancelled, and show the server's
processing step separately until the file is ready. An author can delete a library file no course uses.

Screen: the existing course editor (`admin/courses/:id/edit`, `features/admin-content/course-editor/`), lesson
form. `admin/lessons` stays a placeholder (decision L4). Mockup: `admin-content.js` `courseWizard` step 2 (dropzone,
upload items).

## Endpoints

New registry `libs/contracts/src/lib/learning-asset/` (`asset.schema.ts`, `asset.endpoints.ts`, `assetEndpoints`):

| Key              | Endpoint                                                            | Body / response                                                 |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `listAssets`     | `GET /api/v1/learning-assets`                                       | query `AssetListQuerySchema` → `PageSchema(LibraryAssetSchema)` |
| `startUpload`    | `POST /api/v1/learning-assets/uploads`                              | `StartUploadCommandSchema` → `UploadSchema`                     |
| `uploadStatus`   | `GET /api/v1/learning-assets/uploads/{uploadId}`                    | → `UploadSchema`                                                |
| `uploadPart`     | `PUT /api/v1/learning-assets/uploads/{uploadId}/parts/{partNumber}` | **binary** body, header `X-Part-SHA256` → `UploadSchema`        |
| `completeUpload` | `POST /api/v1/learning-assets/uploads/{uploadId}/complete`          | → `UploadSchema`                                                |
| `cancelUpload`   | `DELETE /api/v1/learning-assets/uploads/{uploadId}`                 | → `UploadSchema`                                                |
| `deleteAsset`    | `DELETE /api/v1/learning-assets/{assetId}`                          | → `z.null()`                                                    |

```ts
export const AssetStatusSchema = z.enum(['uploading', 'completing', 'processing', 'ready', 'failed', 'canceling', 'canceled', 'expired', 'deleted']);
export const MediaKindSchema = z.enum(['video', 'document', 'image', 'attachment']);

/** MediaViews.Asset: a library row. No storage key, credential or provider upload id. */
export const LibraryAssetSchema = z.object({
  id: z.number().int(),
  ownerOrgId: z.number().int(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  mediaType: MediaKindSchema,
  status: AssetStatusSchema,
  createTime: BackendDateTimeSchema.nullish(),
});
export const AssetListQuerySchema = PageQuerySchema.extend({
  q: z.string().optional(),
  mediaType: MediaKindSchema.optional(),
  status: AssetStatusSchema.optional(),
});

/** MediaRequests.Upload. requestId is the idempotency key and becomes the uploadId. */
export const StartUploadCommandSchema = z.object({
  requestId: z.uuid(),
  ownerOrgId: z.number().int().positive(),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(1).max(500_000_000),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
});

/** MediaViews.Upload: the manifest of acknowledged parts and the processing outcome. */
export const UploadSchema = z.object({
  uploadId: z.uuid(),
  assetId: z.number().int().nullish(),
  status: AssetStatusSchema,
  totalBytes: z.number().int(),
  uploadedBytes: z.number().int(),
  partSize: z.number().int(),
  expiresAt: BackendDateTimeSchema.nullish(),
  parts: z.array(z.object({ partNumber: z.number().int(), sizeBytes: z.number().int(), checksumSha256: z.string() })),
  errorCode: z.string().nullish(),
  errorMessage: z.string().nullish(),
  mimeType: z.string().nullish(),
  durationSeconds: z.number().nullish(),
  pageCount: z.number().int().nullish(),
  mediaCheckedAt: BackendDateTimeSchema.nullish(),
});
```

`courseEndpoints.uploadAsset` (the one-shot multipart upload) is removed from the registry, the mock and the editor
in the same commit: every file now takes the parts flow (a 5 MB image is one part), so nothing would call it.
New `MESSAGE_CODE_KIND`/`backendRefusal` entries: `LEARNING-UPLOAD_FILE_MISMATCH`, `LEARNING-UPLOAD_EXPIRED`,
`LEARNING-UPLOAD_PART_CONFLICT`, `LEARNING-ASSET_INVALID`, `LEARNING-ASSET_CODEC_UNSUPPORTED`,
`LEARNING-ASSET_IN_USE`, `LEARNING-MEDIA_PROCESSING_UNAVAILABLE`.

### A new transport: binary body with a header

Per the extension rule in `contracts-and-mocks.md`: `defineEndpoint` gains `encoding: 'binary'` (the body is one
`Blob`, sent as `application/octet-stream`, not parsed) and an optional `headers` schema (`z.object` of header
names); `EndpointClient` sets the declared headers from `input.headers`, required exactly when the endpoint declares
them. `endpoint-client.spec.ts` covers both; the doc's endpoint-registry section lists them.

## Upload flow (`course-editor/data-access/chunked-upload.ts`)

A function `chunkedUpload(client, hasher, file, ownerOrgId, resume?)` returns an `Observable<UploadProgress>`
(`hashing` %, `uploading` bytes, `processing`, `ready` with the asset facts, `failed` with code and message).
`CourseEditorStore` runs one per block key (raw RxJS subscription with a comment: an upload is a long-running
stream, not a single request), keeps the progress in `state.uploads`, and attaches the asset to the block on
`ready`, as it does today.

1. **Check** the file against the block's rules (accepted types, the backend's limits: video 500 MB, PDF 20 MB,
   image 5 MB, attachment 10 MB) before anything is sent.
2. **Hash** the whole file in a Web Worker (`sha256.worker.ts`), reading 8 MiB slices, never the whole file at once;
   the same worker hashes each part before it is sent. Row: "Đang kiểm tra tệp… n%".
3. **Start** with a new UUID `requestId` (from `crypto.getRandomValues`, so it also works on a plain-HTTP page).
4. **Parts** one at a time, in order, skipping the part numbers already in `parts`; each PUT carries its
   `X-Part-SHA256`. Row: `ui-upload-item` with `uploadedBytes / totalBytes` and "Đang tải lên… x MB / y MB".
5. **Complete**, then poll `uploadStatus` every 3 s while `completing` or `processing` (row: "Đang xử lý tệp…", no
   byte bar), up to 15 minutes, then "Máy chủ chưa xử lý xong. Kiểm tra lại sau." with "Kiểm tra lại".
6. **Ready** → the block gets the asset (with `durationSeconds`/`pageCount` from the server, replacing today's
   client-side `readFileFacts`, which is deleted). **Failed** → the row shows `errorMessage`;
   `LEARNING-MEDIA_PROCESSING_UNAVAILABLE` adds "Xử lý lại" (POST complete again); other failures add "Chọn tệp
   khác".
7. **Cancel** ("Hủy" on the row while hashing or uploading) stops the stream and sends `cancelUpload`; the row goes.
8. **Offline or 5xx** during parts: the row says "Mất kết nối, sẽ tiếp tục khi có mạng."; on reconnect,
   `uploadStatus` gives the acknowledged parts and the upload continues from the first missing one.
9. **Reload.** `localStorage` keeps, per course, `{ uploadId, blockKey, name, sizeBytes, checksumSha256, expiresAt }`
   (no bytes) under `lms.asset-uploads.v1.<userId>.<courseId>`, removed on ready, cancel or expiry. On opening the
   editor, each kept upload shows on its block as "Tải lên bị gián đoạn: <name>" with "Tiếp tục" (the author picks
   the file; a different name, size or hash is refused with "Tệp không khớp tệp đang tải lên.") and "Hủy".

Refusals on start or part (`UPLOAD_FILE_MISMATCH`, `UPLOAD_PART_CONFLICT`, `ASSET_INVALID`, `ASSET_CODEC_UNSUPPORTED`)
end the row in its error state with the server's message; `UPLOAD_EXPIRED` clears the kept entry and offers "Tải lên
lại". No toast for a row's own failure (the row is the feedback); one toast "Tải lên thành công" on ready, as today.

## Library picker and delete

- In the lesson form, every file block gets "Chọn từ thư viện" beside the dropzone, opening a `ui-drawer` "Thư viện
  tài nguyên" with its own store (`components/asset-library/data-access/asset-library.store.ts`, provided by the
  drawer component; it receives the block type and returns the picked asset through an output).
- The drawer: `ui-search` "Tìm theo tên tệp"; the media kind fixed by the block (video → `video`, PDF → `document`,
  image → `image`, attachment → `attachment`) and `status: 'ready'`; `ui-data-table` with Tên tệp (truncated), Loại
  (MIME as text), Dung lượng (`ui.num`, right), Ngày tải lên; server paging (size 20) and sort (`createTime,desc`
  default, `name`). Clicking a row picks it (the block gets the asset) and closes the drawer.
- Row `ui-menu`: "Xóa khỏi thư viện" → `ui-confirm-dialog` "Xóa tệp <name>?" / "Tệp sẽ không còn chọn được. Chỉ xóa
  được tệp chưa dùng trong khóa học nào." → `deleteAsset`; `LEARNING-ASSET_IN_USE` toasts the server's message.
- Empty: inline "Thư viện chưa có tệp loại này." Error: `ui-error-state` with retry.

## Mock

`LearningBackend` keeps uploads in memory: start is idempotent on `requestId`, parts are recorded (the mock does not
re-hash bytes; a part number already recorded with another checksum answers `UPLOAD_PART_CONFLICT`), complete moves
to `processing` and the second status poll after it to `ready` with a new library asset (`durationSeconds` 120 for
video, `pageCount` 8 for PDF), cancel moves to `canceled`. `listAssets` pages fixtures plus uploaded assets;
`deleteAsset` refuses an asset used by a fixture course with `ASSET_IN_USE`.

## Testing

- `chunked-upload.spec.ts` (fake hasher, mock backend): parts in order with their headers; resume skips acknowledged
  parts; polling until ready and the 15 minute cap; failed with and without "Xử lý lại"; cancel sends
  `cancelUpload`; offline pause and continue; a mismatched file on resume is refused before any request.
- `sha256.worker.spec.ts`: known vectors, a file larger than one slice equals the one-shot digest.
- `course-editor.store.spec.ts`: the kept-uploads round trip, attach on ready, removal on cancel and expiry.
- `asset-library.store.spec.ts` and component spec: media kind by block type, paging, pick, delete confirm,
  `ASSET_IN_USE`.
- `endpoint-client.spec.ts`: `binary` body and declared headers.

## Boundaries

- Always: the server's verdict on type, codec, size and page count; hashing off the main thread; one part in flight.
- Ask first: adding the hashing library (Open question 1); parallel parts; a separate library screen.
- Never: load a whole file into memory; send a file's bytes or a hash to anything but the upload endpoints; keep
  bytes in storage; show a file as ready before the server says `ready`.

## Success criteria

1. Local backend, as an author: upload a video of about 100 MB; the bar moves by parts; after "Đang xử lý tệp…" it
   becomes ready with its duration (needs `ffmpeg` on the backend machine).
2. Kill the network mid-upload, restore it: the upload continues from the next part. Reload mid-upload, pick the
   same file: it continues; pick another file: refused.
3. Cancel an upload: it disappears and its status on the server is `canceled`.
4. Pick an existing PDF from the library for a PDF block; delete an unused file; a used file refuses with the
   server's message.
5. `npm run check` green; angular.md §14 and the visual-design checklist pass for the lesson form and the drawer at
   375 and 1280 px, light and dark, keyboard only.

## Open questions

1. **Hashing library.** The whole-file SHA-256 must be incremental (Web Crypto's `digest` is one-shot and would load
   a 500 MB video into memory, and it needs a secure context). Recommended: `@noble/hashes` (audited, no
   dependencies, incremental `sha256.create().update()`), run in the worker. Alternative: `hash-wasm` (faster, a
   WebAssembly blob).
