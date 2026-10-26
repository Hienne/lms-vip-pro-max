# Spec: `lesson-player` (Phase 1)

Map: [SPEC.md](SPEC.md). Read `docs/conventions/angular.md`, `contracts-and-mocks.md`, `visual-design.md` and
`docs/migration/mockup-to-angular.md` first. Backend reference: `corebanking-academy/docs/api/LEARNING.md` →
"Phiên học và checkpoint" and "Media cho browser và gateway".

## Objective

A learner opens a course from the catalogue, enrols when it is optional, and studies its lessons. Each lesson
plays its blocks (video, PDF, text, process, image, attachment); the app reports what the learner does and shows
the progress the server computes. Reloading, leaving and coming back resume where the server says the learner
stopped. Opening the same lesson on a second device asks before moving the session there, and the first device
stops saving.

Mockup: `learner.js` page `course` (F.1 links, README rows F.3–F.6) and `lesson.js` page `lesson`. Migration
entries: `route-course-id`, `route-lesson-course-id-lesson-id`, `feature-viewers`.

## Endpoints

| Key (registry)                    | Endpoint                                                                       | Change                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learnerEndpoints.enroll`         | `POST /api/v1/courses/{courseId}/enrollments`                                  | none; first caller                                                                                                                                    |
| `learnerEndpoints.enrollment`     | `GET /api/v1/me/learning/enrollments/{enrollmentId}`                           | none; first caller                                                                                                                                    |
| `learnerEndpoints.openSession`    | `POST /api/v1/me/learning/sessions`                                            | **new**: `OpenSessionCommandSchema` → `StudySessionSchema`                                                                                            |
| `learnerEndpoints.saveProgress`   | `PUT /api/v1/me/learning/enrollments/{enrollmentId}/blocks/{blockId}/progress` | **schema fixed**: command gains `sessionId`, `sessionFence`, `eventType`, `assetId`, `playing`; `sequence` required; result gains `session` (receipt) |
| `courseEndpoints.getAssetContent` | `GET /api/v1/learning-assets/{assetId}/content?blockId&enrollmentId`           | none; attachments download through it; video, image and PDF load its URL (`toUrl`)                                                                    |

New and changed schemas (`libs/contracts/src/lib/learner/learner.schema.ts`), all matching the backend records:

```ts
export const ProgressEventTypeSchema = z.enum(['OPEN', 'PLAY', 'HEARTBEAT', 'PAUSE', 'SEEK', 'PDF_PAGE', 'COMPLETE', 'CLOSE']);

/** Claims the account's one study session on a block (MediaRequests.Session). */
export const OpenSessionCommandSchema = z.object({
  enrollmentId: z.number().int().positive(),
  blockId: z.number().int().positive(),
  previousSessionId: z.uuid().optional(),
  previousFence: z.number().int().positive().optional(),
  takeover: z.boolean(),
});

/** MediaViews.Session: the lease to echo on every event, and where the block resumes. */
export const StudySessionSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int(),
  leaseExpiresAt: BackendDateTimeSchema,
  lastAcceptedSequence: z.number().int(),
  enrollmentId: z.number().int(),
  blockId: z.number().int(),
  assetId: z.number().int().nullish(),
  expectedVersion: z.number().int(),
  resume: BlockProgressSchema.nullish(),
});

/** MediaViews.Receipt, returned with every progress result. */
export const SessionReceiptSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int(),
  lastAcceptedSequence: z.number().int(),
  leaseState: z.string(),
  leaseExpiresAt: BackendDateTimeSchema.nullish(),
});

/** LearningRequests.ProgressRequest. The server scores it; the app never sends a percentage. */
export const SaveProgressCommandSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int().positive(),
  eventType: ProgressEventTypeSchema,
  assetId: z.number().int().positive().nullable(),
  playing: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
  sequence: z.number().int().positive(),
  complete: z.boolean(),
  videoPositionSeconds: z.number().nonnegative().optional(),
  watchedFromSeconds: z.number().nonnegative().optional(),
  watchedToSeconds: z.number().nonnegative().optional(),
  pdfPage: z.number().int().positive().optional(),
});
```

`ProgressResultSchema` gains `session: SessionReceiptSchema`. `BlockProgressSchema` gains `lastEventSequence`,
`mediaAssetId` and `watchedSeconds` (all `nullish`) if they are missing. `CourseCardSchema`
(`course.schema.ts`) gains the backend's newer card fields, all `nullish`: `cycleNo`, `startedAt`, `lastAccessAt`,
`completedAt`, `lastLessonId`, `lastBlockId`, `completedRequiredLessonCount`, `requiredLessonCount`,
`deadlineStatus` (`z.enum` of the backend's six values), `mediaAssetId`, `lastPdfPage`,
`lastVideoPositionSeconds`. New message codes in
`MESSAGE_CODE_KIND` only where a screen behaves differently (below): `LEARNING-SESSION_IN_USE`,
`LEARNING-SESSION_EXPIRED`, `LEARNING-STALE_EVENT`, `LEARNING-CONFLICT`, `LEARNING-MEDIA_CHANGED`,
`LEARNING-ASSET_PROCESSING`, `LEARNING-NOT_AVAILABLE`. `backendRefusal` gets their real titles and messages from
`LearningResponseCode` (all HTTP 200 `ERROR`).

## Finding the learner's course by id (interim)

The backend has no learner endpoint for one course: `GET /courses/{id}` is the author's (it requires edit rights),
and the catalogue lists cannot filter by id. Both routes start from a `courseId` and need its `CourseCard` (for
`enrollmentId`, requirement, due date, counts).

`core/learning/learner-course.ts` exports `findLearnerCourse(client, courseId): Observable<CourseCard | null>`: it
reads `myCourses` pages (`size: 100`, `sort: 'id,asc'`) until the card is found or the pages end, then the same on
`catalog`, at most 5 pages each, and returns `null` when it is in neither. It lives in `core/` because `learning`,
`lesson` and (Phase 4) `learner-home` all use it, and a feature may not import another's internals. It is replaced
by one call when the backend adds a learner course endpoint (Open question 1).

## Screen 1: course page (`course/:id`)

```text
apps/lms/src/app/features/learning/course/
├── course.ts|html|scss|spec.ts
├── data-access/course.store.ts (+ spec)
└── components/course-outline/   chapters → lessons with the server's lesson status
```

Store (`CourseStore`):

- `courseId` from the route param; `card = serverData(findLearnerCourse)`; `detail = serverData(enrollment)`
  keyed by `card.enrollmentId` (idle while it is `null`).
- `enroll = serverMutation(enroll, { errors: 'toast', success: 'Đã đăng ký khóa học', invalidates })`; on success
  the card and detail reload, so the page turns into the enrolled view without navigating.
- Selectors: `view$` (`'loading' | 'missing' | 'not-enrolled' | 'enrolled'`), `canEnroll$` (no enrollment and
  `requirement === 'optional'`), `resumeLink$` (`/lesson/:courseId/:lastLessonId`, else the first content lesson),
  `outline$` (chapters with each lesson's status and % from `detail.lessons`), `isOverdue$` from the card.

View, top to bottom (the mockup's hero, gradient, white badges and mai art are replaced, per visual-design.md):

1. `ui-breadcrumb`: "Danh mục khóa học" → `/catalog`, then the course title.
2. `ui-page-header`: h1 the title; description line "`code` · level · `n` bài · duration", the
   `app-required-mark` and `app-due-date` in the meta line (one coloured badge at most: the due state). Action on the
   right: "Đăng ký học" (primary, `canEnroll$`), "Tiếp tục học" or "Bắt đầu học" (primary link to `resumeLink$`,
   enrolled), nothing when completed.
3. `ui-alert tone="danger"` only when overdue: "Khóa học đã quá hạn. Hoàn thành sớm để cập nhật trạng thái."
4. Two columns from `lg`, one below:
   - Main: "Mục tiêu đầu ra" as a plain list (`content.objectives`), then "Nội dung khóa học" with
     "`completedRequired`/`required` bài bắt buộc đã hoàn thành" and `app-course-outline`: chapters as `<details>`
     (the first and the one holding the resume lesson open), each lesson a link to the lesson route with a status
     mark (done, in progress, not started) and its duration. A `quiz` lesson is not a link: its title and the muted
     "Bài kiểm tra chưa mở".
   - Side: `ui-ring` with `enrollment.progressPercent`, "Đã học x/y bài", the start and last-access dates;
     "Điều kiện hoàn thành" as a list ("Học đủ y bài bắt buộc"); `completionRule.rewardPoints > 0` →
     "+N điểm thưởng khi hoàn thành" in `accent-ink`.
5. Not enrolled: the outline is unknown before enrolment (the backend serves it only with an enrollment), so the
   main column shows the card facts and one muted line: "Đăng ký để xem nội dung và bắt đầu học." A mandatory course
   with no enrollment shows "Khóa học bắt buộc này cần được giao để học." and no button.
6. `missing`: whole-page empty state, left-aligned: "Không tìm thấy khóa học", "Khóa học không còn mở cho bạn
   hoặc đường dẫn không đúng.", link "Về danh mục".

Loading: skeletons for the header and the outline. Error: `ui-error-state` with retry.

## Screen 2: lesson player (`lesson/:courseId/:lessonId`, layout `focus`)

```text
apps/lms/src/app/features/lesson/lesson/
├── lesson.ts|html|scss|spec.ts
├── data-access/
│   ├── lesson.store.ts (+ spec)        route store: course, enrollment detail, active block, session, events
│   ├── study-protocol.ts (+ spec)      pure functions: next command, range, receipt, error → action
│   └── study-session.storage.ts (+ spec)  the tab's last session per enrollment, in sessionStorage
└── components/
    ├── lesson-outline/      chapters → lessons (side panel "Mục lục")
    ├── block-list/          the lesson's blocks with their state; selects the active one
    ├── video-block/         <video>, reports play/pause/seek/time
    ├── pdf-block/           pdf.js canvas pages, page buttons, reports the page (@defer)
    ├── text-block/          app-markdown / plain text
    ├── process-block/       ordered steps
    ├── image-block/         <img> with alt and caption
    ├── attachment-block/    file list, download
    └── session-alert/       "moved to another device", "content changed", takeover
apps/lms/src/app/shared/content/markdown/   app-markdown (node-built, no innerHTML) — new inventory row
```

### One active block at a time (decision LP1)

The backend gives the account **one** session, on **one** block, and the media cookie is valid only for that block.
So the player shows the lesson's blocks as a list (`block-list`, only when there is more than one) and renders the
**active** block below it; selecting another block, or "Tiếp theo", moves the session to it. The mockup stacks every
block on one page; this is a deliberate difference forced by the backend contract.

Active block on entry: `?block=<id>` when it belongs to the lesson, else `enrollment.lastBlockId` when it does,
else the first block. The query param follows the active block (`replaceUrl`), so reload and back keep it.

### Study protocol (store + `study-protocol.ts`)

1. **Claim.** On entry and on every block change: `openSession` with `{ enrollmentId, blockId, takeover: false }`
   plus `previousSessionId`/`previousFence` from the session held in this tab (memory, else
   `study-session.storage.ts`). The answer is kept in `state.session` (protocol state the app must echo, not a
   cached read) and written to `sessionStorage` under `lms.study-session.v1.<userId>.<enrollmentId>`.
2. **Open.** Right after a claim, an `OPEN` event (video: with `videoPositionSeconds` = the resume position).
3. **Events by block type** (`playing` is true only while a video is actually playing):

   | Block  | Events                                                                                                                                                           |
   | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | video  | `PLAY` on play; `HEARTBEAT` every 10 s while playing; `PAUSE` on pause and on `ended`; before a seek, a `HEARTBEAT` closing the range played so far, then `SEEK` |
   | PDF    | `PDF_PAGE` when the shown page changes (after 1 s on the page)                                                                                                   |
   | all    | `HEARTBEAT` every 20 s while the tab is visible (keeps the 60 s lease and the 5 min media cookie); `CLOSE` on block change, route leave and sign-out             |
   | manual | `COMPLETE` with `complete: true` from "Đánh dấu hoàn thành"                                                                                                      |

   A video event carries `videoPositionSeconds`; `watchedFromSeconds`/`watchedToSeconds` go only on an event that
   follows a `playing: true` event and is not `SEEK` or `OPEN`, from the last reported position to the current one.
   Ranges, coverage and completion are the server's; the app never sends or computes a percentage.

4. **One request at a time.** Events go through one serial queue (`concatMap`, raw RxJS with a comment: a
   `serverMutation` cancels its in-flight run, and a cancelled event may still be applied by the server and break
   the sequence). Heartbeats coalesce while one is waiting. `sequence` = the receipt's `lastAcceptedSequence + 1`;
   `expectedVersion` = the result's `block.rowVersion` (the session's `expectedVersion` before the first result).
   A request that fails offline is resent with the **same** payload when the connection returns.
5. **Results.** Each `ProgressResult` replaces the block, lesson and enrollment progress shown (kept in
   `state.results`, overriding the enrollment detail until it reloads). The save line says "Đã lưu tiến độ" only
   after an ACK.
6. **Refusals** (no toast; the session alert or the save line is the one feedback):

   | Code                                                             | Action                                                                                                                                                                                         |
   | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `LEARNING-SESSION_IN_USE` (on claim)                             | Media stays unloaded; `session-alert`: "Bài học đang mở ở nơi khác" / the server's message, button "Học trên thiết bị này" → claim with `takeover: true`. Never taken over without that click. |
   | `LEARNING-SESSION_EXPIRED` (on an event)                         | One silent re-claim with the previous ids; if that answers `SESSION_IN_USE`, the video pauses and `session-alert` says "Bài học đã chuyển sang thiết bị khác." with the takeover button.       |
   | `LEARNING-STALE_EVENT`, `LEARNING-CONFLICT`                      | Drop the event, re-claim (fresh sequence and version) and reload the enrollment detail; at most twice in a row, then the save line shows "Chưa lưu được tiến độ" with "Thử lại".               |
   | `LEARNING-MEDIA_CHANGED`                                         | Stop events; `session-alert`: "Nội dung bài đã thay đổi." with "Tải lại bài" (reloads the detail and re-claims).                                                                               |
   | `LEARNING-ASSET_PROCESSING`, `LEARNING-ASSET_INVALID` (on claim) | The block shows "Tài nguyên đang được xử lý hoặc chưa sẵn sàng." with "Thử lại"; other blocks stay usable.                                                                                     |
   | `LEARNING-NOT_AVAILABLE`, 403                                    | Whole-page error: the server's title and message, link back to the course.                                                                                                                     |
   | offline, 5xx                                                     | The save line: "Chưa lưu được tiến độ" with "Thử lại"; the queue keeps the unsent event.                                                                                                       |

7. **Leaving.** Route leave and block change send `CLOSE` (with the last range when playing). Sign-out sends
   `CLOSE` before the session ends, best effort. A closed tab is covered by the lease running out; a reload in the
   same tab reclaims with the stored ids, so it is not asked to take over.

### Layout and copy

- Focus bar (the `focus` layout's header): "Thoát" (`arrow-left`, link to the course), the course · chapter line
  (`text-muted`, truncated), the lesson title, the save line (`aria-live="polite"`), "Mục lục" toggle below `lg`.
- Main column: h1 the lesson title; meta "Bài k/n · m phút"; `block-list`; the active block; under it the block's
  completion row: done → "Đã hoàn thành" with the date; manual and not done → "Đánh dấu hoàn thành" (primary);
  video → "Đã xem x% · cần y%" from the server's `progressPercent` and the block's `completionThreshold`; then
  "Khối trước" / "Khối tiếp theo" inside the lesson, and "Bài trước" / "Bài tiếp theo" at the last block.
- Side panel "Mục lục" (from `lg`; a drawer below): `lesson-outline` with the server's lesson states; the current
  lesson marked with `aria-current="page"`. The mockup's "Ghi chú" and "Trợ lý AI" tabs and the rating/feedback
  section are out of scope (map: Out of scope), so the panel has no tabs.
- Blocks:
  - **video**: `<video controls preload="metadata">` with `src` = the content URL (`toUrl(getAssetContent, …)` with
    `blockId` and `enrollmentId`), starting at `resume.lastVideoPositionSeconds`; no autoplay. Load error →
    "Không phát được video." with "Thử lại" (re-claim refreshes the cookie).
  - **pdf**: pdf.js renders one page at a time on a canvas with "Trang trước" / "Trang sau", "Trang p/n", zoom in
    and out; opens at `resume.lastPdfPage` with "Đã mở lại tại trang p." (muted). Loaded in `@defer` with the
    worker from the package.
  - **text**: `markdown` → `app-markdown`; `html` → parsed with `DOMParser` and rebuilt as nodes from an allowlist
    (`p`, `h2`–`h4`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `pre`, `br`, `a` with an `http(s)` `href`), the rest
    as text; `plain` → text with line breaks kept.
  - **process**: an ordered list, number then title (semibold) and description; no tiles.
  - **image**: `<img>` with `alt` = the asset's `altText`, else the block title; caption below; load error → "Không
    tải được hình ảnh."
  - **attachment**: one row per asset: name, size, "Tải xuống" (`getAssetContent` as a blob → `FileSaver.save` with
    the original name; refused → toast).
- Empty lesson: inline "Bài học chưa có nội dung." Quiz lesson opened by URL: "Bài kiểm tra chưa mở." with a link
  back to the course.

### Mock (`libs/mocks`)

- Fixtures: one published optional course and one assigned course for `hocvien`, each lesson type and each block
  type, with completion modes `open`, `manual`, `pdf_end`, `video_coverage`; assets with `pageCount` and
  `durationSeconds`.
- `LearningBackend` answers `enrollment`, `openSession` and `saveProgress` with the protocol checks (one lease per
  user, fence, sequence = last + 1, same payload re-ACKed, `expectedVersion`, `SESSION_IN_USE` without takeover,
  `SESSION_EXPIRED` after 60 s) and simple scoring (open → 100, manual complete → 100, last PDF page with `pdf_end`
  → 100, video by the sum of reported ranges over duration against the threshold). It is a stand-in, not the
  backend's rules.
- Media bytes are not mocked: on the mock a video or PDF fails to load and shows its error state; playback is
  verified on the local backend.

## Testing

- `study-protocol.spec.ts`: sequence and version advance from a result; a range only after a playing event and
  never on `SEEK`/`OPEN`; seek flushes a heartbeat first; each refusal code maps to its action; the same payload on
  resend.
- `lesson.store.spec.ts` (mock backend, `signInToMockBackend('hocvien')`, fake timers): entry claims then opens;
  heartbeats every 10 s while playing and 20 s otherwise, none while hidden; one request in flight; block change
  closes then claims with the previous ids; `SESSION_IN_USE` waits for the takeover click; expired → silent
  re-claim; stale → re-claim at most twice; route leave sends `CLOSE`; reload reuses the stored ids.
- `study-session.storage.spec.ts`: per user and enrollment key, bad data discarded, blocked storage works in memory.
- `course.store.spec.ts`: lookup through `myCourses` then `catalog`; `missing`; enrol reloads into the enrolled
  view; mandatory without enrollment cannot enrol.
- Component specs: the course page's states and actions; `block-list` keyboard selection; each block renders its
  data and emits its events; `app-markdown` renders the subset and never creates `script`, `style`, `iframe` or an
  `on*` attribute.
- `npx nx test contracts mocks`: the new schemas parse the fixtures; the Postman replay still passes.

## Boundaries

- Always: the server's progress, status and completion only; one progress request in flight; takeover only on a
  click; tokens and the visual-design rules; Vietnamese copy above.
- Ask first: adding `pdfjs-dist` (decision LP2); any other new dependency; changing `catalog` beyond its links.
- Never: a percentage, range credit or completion computed in the app; a token in a media URL; `innerHTML` for
  lesson content; a session id in `localStorage`; autoplay.

## Success criteria

1. Mock (`mockBackend: true`), as `hocvien`: open the optional course from `catalog`, enrol, open a text lesson,
   "Đánh dấu hoàn thành", see the lesson and course % move; reload and land on the same block.
2. Local backend, with a course published from the course editor holding a PDF and a video (video needs `ffmpeg`
   on the backend machine): the PDF reopens at the last page; `pdf_end` completes on the last page; watching the
   video past its threshold completes it; seeking past the end does not.
3. Same lesson in a second browser: it asks before taking over; after "Học trên thiết bị này" the first browser
   pauses and shows the moved alert, and its later events are not saved.
4. `npm run check` green; angular.md §14, the visual-design checklist and the migration verify step pass for both
   routes at 375, 768 and 1280 px, light and dark, keyboard only; the three migration entries marked `done`.

## Open questions

1. **Learner course endpoint.** Ask the backend for `GET /api/v1/me/learning/courses/{courseId}` returning a
   `CourseCard` (and the outline before enrolment). Until then `findLearnerCourse` pages through two lists.
2. **LP2: PDF renderer.** Page tracking (`PDF_PAGE`, `pdf_end`) needs to know the shown page, which the browser's
   built-in viewer in an `<iframe>` does not expose. Recommended: add `pdfjs-dist` (lazy, in `@defer`). Without it,
   PDFs open in an `<iframe>`, no page is reported, and a `pdf_end` block cannot complete.
3. **LP1: one block at a time.** Confirm the deliberate difference above (stacked blocks would need one session per
   block, which the backend does not offer).
