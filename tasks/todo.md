# Tasks: learner and lesson APIs ("Học viên & bài học")

Spec: [SPEC.md](../SPEC.md) · Plan: [plan.md](plan.md). Frontend only, this worktree, branch
`claude/fe-be-missing-apis-c5a9bd`. Backend `corebanking-academy` runs locally and is not changed. One commit per
task; stop at each checkpoint. Paths: `app/` = `apps/lms/src/app/`, `contracts/` = `libs/contracts/src/lib/`,
`mocks/` = `libs/mocks/src/lib/`.

Every task's verification includes the focused tests named and `npx nx test <project>` for the projects it
touches; every checkpoint runs `npm run check`. Screen tasks also run the browser pass of
`docs/migration/mockup-to-angular.md` → Verify (375/768/1280, light/dark, keyboard, error states).

## Phase 0: local stack

- [x] **T0 Local stack up** (machine + BE) · XS
  - Do: start Docker Desktop; `docker compose up -d db` in the BE repo; apply `learning_hub_learning.sql`,
    `learning_hub_media_progress.sql` and `learning_hub_learning_demo.sql` if their tables or demo rows are missing;
    `mvn spring-boot:run` on :8019; FE with `LMS_API_TARGET=http://localhost:8019 npm start`. **Ask before**
    `brew install ffmpeg` (video processing needs `ffprobe`/`ffmpeg`).
  - Accept: health UP; `hocvien`, `hocvien.tichhop`, `giangvien` and the content admin sign in through the proxy;
    a PDF uploaded in the course editor (one-shot upload, still in place) becomes `ready` on S3; one
    `POST /me/learning/sessions` through the proxy returns `Set-Cookie: academy_media` that the browser keeps for
    `/api/v1/learning-assets`.
  - Verify: `curl -s localhost:8019/actuator/health`; browser; `curl -i` through :4200 for the cookie.
  - Files: none committed (`proxy.conf.mjs` only if the cookie needs a rewrite, then committed with a note).
  - Done 2026-10-26: Docker up; the backend's `.env` points `DB_URL` at the shared remote database, so the backend
    runs against the local `core_academy` container instead (env `DB_URL`/`DB_USER`/`DB_PASSWORD` override the
    file; the local role's password was aligned with `.env` by `ALTER USER`). The local DB already had the
    identity and learning tables; `learning_hub_media_progress.sql` and `learning_hub_learning_demo.sql` were
    applied. Backend `GET /actuator/health` UP on :8019. `hocvien`, `hocvien.tichhop`, `giangvien`, `quantri`
    sign in through :4200 (`Demo@123`). A 3-page PDF uploaded as `giangvien` went to S3 (`s3.chanacademy.io.vn`,
    shared bucket `academy-media`) and came back `ready` (asset id 2). `POST /me/learning/sessions` through the
    proxy answers `Set-Cookie: academy_media; Path=/api/v1/learning-assets; Max-Age=300; HttpOnly;
SameSite=Strict` with no domain, so the proxy needs no rewrite (browser retention is checked in T13).
    `ffmpeg`/`ffprobe` are not installed: the install was asked of the user; until approved, video is verified
    on the mock only.

## Phase 1a: course page

- [x] **T1 Learner fixtures and the enrollment read** · M
  - Accept: `CourseCardSchema` has the backend's newer fields (resume, counts, `deadlineStatus` enum, dates);
    `BlockProgressSchema` has `lastEventSequence`, `mediaAssetId`, `watchedSeconds`; fixtures give `hocvien` an
    optional published course (not enrolled) and an assigned one (enrolled, in progress) with every block type and
    completion mode, and a quiz lesson; `LearningBackend` answers `enrollment` for the caller's own enrollment and 403
    otherwise; `myCourses`/`catalog` cards carry the new fields.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/course/course.schema.ts`, `contracts/learner/learner.schema.ts`,
    `mocks/learning/learning.fixtures.ts`, `mocks/learning/learning.backend.ts`, a fixtures spec.
  - Depends on: none.
- [x] **T2 Study-session contract and mock protocol** · M · _highest contract risk, early_
  - Accept: `ProgressEventTypeSchema`, `OpenSessionCommandSchema`, `StudySessionSchema`, `SessionReceiptSchema`;
    `SaveProgressCommandSchema` as the backend's `ProgressRequest`; `ProgressResultSchema.session`;
    `learnerEndpoints.openSession`; the seven `LEARNING-*` codes in `MESSAGE_CODE_KIND` and `backendRefusal`; new
    `mocks/learning/learner-session.backend.ts` (lease per user, fence, sequence = last + 1, same payload re-ACKed,
    `expectedVersion`, `SESSION_IN_USE` without takeover, `SESSION_EXPIRED` after 60 s, stand-in scoring) wired into
    `LearningBackend`.
  - Verify: `npx nx test contracts mocks` (a mock spec drives claim → OPEN → events → takeover → stale).
  - Files: `contracts/learner/learner.schema.ts`, `contracts/learner/learner.endpoints.ts`,
    `contracts/http/envelope.ts`, `mocks/backend-responses.ts`, `mocks/learning/learner-session.backend.ts` (+ spec).
  - Depends on: T1.
- [x] **T3 `findLearnerCourse`** · S
  - Accept: finds a card in `myCourses` first, then `catalog`; stops at the last page or after 5 pages each; `null`
    when absent; one request at a time.
  - Verify: `npx nx test lms -- learner-course`.
  - Files: `app/core/learning/learner-course.ts` (+ spec).
  - Depends on: T1.
- [x] **T4 Course page (`course/:id`)** · M
  - Accept: claims `route-course-id`; `CourseStore` (card, detail by `enrollmentId`, `enroll` with toast and reload,
    `view$`, `canEnroll$`, `resumeLink$`, `outline$`); page per SPEC-lesson-player "Screen 1": breadcrumb, header
    with the one primary action, overdue alert, objectives, `course-outline` (quiz lesson not a link), side ring and
    completion rule, not-enrolled and mandatory lines, `missing`, loading, error with retry; `screens.ts` loads it.
  - Verify: `npx nx test lms -- course`; browser on the mock as `hocvien`.
  - Files: `app/features/learning/course/course.ts|html|scss|spec.ts`, `…/data-access/course.store.ts` (+ spec),
    `…/components/course-outline/*`, `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T1, T3.

### Checkpoint 1a

- [x] `npm run check` green (2026-10-26, exit 0; Nx flagged `ui:test` as flaky, it passed on retry)
- [x] Mock: `hocvien` opens the optional course (7, NV-402), enrols and sees the outline without leaving the page;
      course 3 (mandatory, unassigned) shows "cần được giao để học" and no button; course 4 shows the overdue alert;
      999 shows "Không tìm thấy khóa học". Checked at 375, 768 and 1280, light and dark. Keyboard-only pass and
      forced error states in the browser are left to T13 (spec covers the error and retry).
- [x] Stop for approval: recorded only, `/build auto` was approved

## Phase 1b: text lessons end to end

- [x] **T5 `study-protocol.ts`** · S
  - Accept: pure functions: next command from session + last result + event; range only after a `playing: true`
    event and never on `SEEK`/`OPEN`; seek flushes a heartbeat first; receipt → next sequence and version; refusal
    code → action (re-claim, takeover prompt, reload, block error, page error, retry).
  - Verify: `npx nx test lms -- study-protocol` (table tests).
  - Files: `app/features/lesson/lesson/data-access/study-protocol.ts` (+ spec).
  - Depends on: T2.
- [x] **T6 Study-session storage** · XS
  - Accept: `lms.study-session.v1.<userId>.<enrollmentId>` in `sessionStorage`; bad data discarded; blocked storage
    works in memory; cleared on sign-out.
  - Verify: `npx nx test lms -- study-session.storage`.
  - Files: `app/features/lesson/lesson/data-access/study-session.storage.ts` (+ spec).
  - Depends on: none.
- [ ] **T7 `LessonStore`** · M
  - Accept: loads card and detail; active block from `?block`, `lastBlockId`, first; claim on entry and block change
    with the previous ids; `OPEN` after claim; 20 s heartbeat while visible, none while hidden; one request in flight
    through a serial queue, offline resend of the same payload; results override shown progress; every refusal row
    of the spec; `CLOSE` on block change, route leave and sign-out; `markComplete()`; video and PDF event commands
    exist (used by T10/T11).
  - Verify: `npx nx test lms -- lesson.store` (mock backend, fake timers).
  - Files: `app/features/lesson/lesson/data-access/lesson.store.ts` (+ spec).
  - Depends on: T2, T3, T5, T6.
- [ ] **T8 `app-markdown`, text and process blocks** · M
  - Accept: `app-markdown` builds nodes for the editor's markdown subset; `html` bodies rebuilt from the allowlist;
    `plain` keeps line breaks; never a `script`, `style`, `iframe` or `on*` attribute; `text-block` and
    `process-block` render their data; new inventory row and migration entry for `app-markdown`.
  - Verify: `npx nx test lms -- markdown text-block process-block`.
  - Files: `app/shared/content/markdown/*`, `app/features/lesson/lesson/components/text-block/*`,
    `…/process-block/*`, `docs/migration/mockup-to-angular.md`, `migration-entries.data.ts`.
  - Depends on: none.
- [ ] **T9 Lesson page (`lesson/:courseId/:lessonId`)** · M
  - Accept: claims `route-lesson-course-id-lesson-id`; focus bar (Thoát, course · chapter, title, save line
    `aria-live`), `block-list` (keyboard selection, `?block` follows), the active block (text/process now, a
    placeholder line for the media types until T10–T12), completion row with "Đánh dấu hoàn thành", block and
    lesson prev/next, `lesson-outline` side panel (drawer below `lg`), `session-alert` with the takeover button,
    empty lesson, quiz lesson, page error; `screens.ts` loads it.
  - Verify: `npx nx test lms -- lesson`; browser on the mock.
  - Files: `app/features/lesson/lesson/lesson.ts|html|scss|spec.ts`, `…/components/block-list/*`,
    `…/components/lesson-outline/*`, `…/components/session-alert/*`, `app/core/routing/screens.ts`.
  - Depends on: T7, T8.

### Checkpoint 1b

- [ ] `npm run check` green
- [ ] Mock (lesson-player criterion 1): enrol, open a text lesson, "Đánh dấu hoàn thành", lesson and course % move,
      reload lands on the same block
- [ ] Mock: a second tab of the same user gets the takeover prompt; after taking over, the first tab shows the moved
      alert
- [ ] Stop for approval

## Phase 1c: media blocks and the local backend

- [ ] **T10 Video block** · M
  - Accept: `<video controls preload="metadata">` with the content URL (`toUrl`, `blockId`, `enrollmentId`), starts
    at the resume position, no autoplay; emits play, pause, ended, seeking and time; the store sends `PLAY`, 10 s
    `HEARTBEAT` with ranges, `PAUSE`, heartbeat-then-`SEEK`; "Đã xem x% · cần y%"; load error with "Thử lại".
  - Verify: `npx nx test lms -- video-block lesson.store`.
  - Files: `app/features/lesson/lesson/components/video-block/*`, `lesson.store.ts` (+ spec), `lesson.html`.
  - Depends on: T9.
- [ ] **T11 `pdfjs-dist` and the PDF block** · M
  - Accept: `pdfjs-dist` added (exact version pinned); the block in `@defer`, worker loaded as an asset; one page on a
    canvas, "Trang trước"/"Trang sau", "Trang p/n", zoom; opens at the resume page with the muted line; `PDF_PAGE`
    after 1 s on a page; load error state; production build within budget and the bundle guard green.
  - Verify: `npx nx test lms -- pdf-block`; `npm run check`.
  - Files: `package.json`, `package-lock.json`, `apps/lms/project.json` (asset), `…/components/pdf-block/*`,
    `lesson.html`.
  - Depends on: T9.
- [ ] **T12 Image and attachment blocks** · S
  - Accept: `<img>` with `altText` (else the title), caption, load error line; attachments listed with name and size,
    "Tải xuống" through `getAssetContent` as a blob → `FileSaver.save` with the original name, refusal toast.
  - Verify: `npx nx test lms -- image-block attachment-block`.
  - Files: `…/components/image-block/*`, `…/components/attachment-block/*`, `lesson.html`, `lesson.store.ts`.
  - Depends on: T9.
- [ ] **T13 Local-backend pass for the lesson player** · S
  - Do: as the content admin, build and publish a course with a PDF (`pdf_end`), a video (`video_coverage`, if
    `ffmpeg` is installed), a text block and an image; assign or share it to `hocvien`; run lesson-player success
    criteria 2 and 3 in two browsers; fix what the pass finds (each fix its own commit with a spec).
  - Accept: criteria 1–4 of SPEC-lesson-player met; `route-course-id`, `route-lesson-course-id-lesson-id`,
    `feature-viewers` marked `done` with their checks.
  - Verify: browser; the network log shows no `STALE_EVENT`/`CONFLICT` during a normal 5-minute session.
  - Files: `migration-entries.data.ts`, fixes as found.
  - Depends on: T10, T11, T12.

### Checkpoint 1c (Phase 1 done)

- [ ] `npm run check` green
- [ ] lesson-player success criteria 1–4 reported with how each was verified
- [ ] Stop for approval

## Phase 2: `learner-progress`

- [ ] **T14 JSON refusal on `blob` endpoints** · S
  - Accept: `envelopeInterceptor` reads a `blob` response with `Content-Type: application/json` as an envelope
    (`ApiError` on `ERROR`, on a 2xx or a 4xx/5xx), passes other blobs through; `contracts-and-mocks.md` "Known
    limit" updated.
  - Verify: `npx nx test lms -- envelope.interceptor`.
  - Files: `app/core/http/envelope.interceptor.ts` (+ spec), `docs/conventions/contracts-and-mocks.md`.
  - Depends on: none.
- [ ] **T15 Progress contracts and mock** · S
  - Accept: `LearningProgressOverviewSchema`, `LearningStatusSchema`, `MyCoursesQuerySchema` (`overdue`),
    `ProgressExportQuerySchema`; `progressSummary` and `exportProgress` (`blob`); mock summary counts, `overdue`
    filter and sort on `myCourses`, CSV blob with BOM, `EXPORT_TOO_LARGE` as a JSON blob.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/learner/learner.schema.ts`, `learner.endpoints.ts`, `mocks/learning/learning.backend.ts`,
    `mocks/backend-responses.ts`.
  - Depends on: T1.
- [ ] **T16 Progress page (`progress`)** · M
  - Accept: claims `route-progress`; `ProgressStore` (URL-synced filters, debounced `q`, page reset, export with the
    table's query and the dated file name); header with "Xuất CSV", KPI row, unavailable note, filters, data table
    per spec, empty / no-match / error states; `screens.ts` loads it.
  - Verify: `npx nx test lms -- progress`; browser on the mock and the local backend (criteria 1–3).
  - Files: `app/features/achievements/progress/progress.ts|html|scss|spec.ts`, `…/data-access/progress.store.ts`
    (+ spec), `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T14, T15.

### Checkpoint 2

- [ ] `npm run check` green
- [ ] learner-progress success criteria 1–4 (CSV opened in Excel with Vietnamese intact)
- [ ] Stop for approval

## Phase 3: `learning-reminders`

- [ ] **T17 Reminder contract and mock** · S
  - Accept: `status` enum; fixtures (three due for `hocvien`, one overdue, one not yet scheduled); `reminders` lists
    pending and due for the caller; `markReminderRead` sets `sent`, 403 for another user's; mock `navCounts`
    `notifications` = the caller's due reminders.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/learner/learner.schema.ts`, `mocks/learning/learning.fixtures.ts`,
    `mocks/learning/learning.backend.ts`, `mocks/backend/fake-backend.ts`.
  - Depends on: T1.
- [ ] **T18 Notifications page (`notifications`)** · M
  - Accept: claims `route-notifications`; `NotificationsStore` (idle without `COURSE_LEARNING`, 403 → empty, mark one,
    mark all in order stopping at a refusal, bumps `remindersChanged`); `core/learning/reminders-changed.ts`; page per
    spec with the progress link and its query; `screens.ts` loads it.
  - Verify: `npx nx test lms -- notifications reminders-changed`; browser.
  - Files: `app/features/account/notifications/notifications.ts|html|scss|spec.ts`,
    `…/data-access/notifications.store.ts` (+ spec), `app/core/learning/reminders-changed.ts` (+ spec),
    `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T17.
- [ ] **T19 Bell count on the real backend** · S
  - Accept: while `navCounts` is not served, `ShellStore.unread$` is the reminders count for a `COURSE_LEARNING`
    user, refreshed on navigation and on `remindersChanged`, 0 on 403 or error.
  - Verify: `npx nx test lms -- shell.store`; local backend: read a reminder, the bell drops without reload.
  - Files: `app/layout/shell/data-access/shell.store.ts` (+ spec).
  - Depends on: T18.

### Checkpoint 3

- [ ] `npm run check` green
- [ ] learning-reminders success criteria 1–4
- [ ] Stop for approval

## Phase 4: `learner-home`

- [ ] **T20 Promote shared learning pieces** · M
  - Accept: `progress-counts`, `unavailable-note` and `reminder-item` move to `app/shared/learning/` with their
    specs; the progress and notifications pages use them; no behaviour change.
  - Verify: `npx nx test lms -- progress notifications shared/learning` green before and after.
  - Files: `app/shared/learning/*`, `progress.html`, `notifications.html` (+ the moved files).
  - Depends on: T16, T18.
- [ ] **T21 Learn page (`learn`)** · M
  - Accept: claims `route-learn`; `LearnStore` (summary, resume card + its detail, tab courses incl. `mandatory`, due
    list filtered to 5, reminders idle/403); `continue-card`; page per spec with independent loading and error per
    section; `screens.ts` loads it.
  - Verify: `npx nx test lms -- learn continue-card`; browser on the mock and the local backend (criteria 1–3).
  - Files: `app/features/learning/learn/learn.ts|html|scss|spec.ts`, `…/data-access/learn.store.ts` (+ spec),
    `…/components/continue-card/*`, `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T20, T13.

### Checkpoint 4

- [ ] `npm run check` green
- [ ] learner-home success criteria 1–4
- [ ] Stop for approval

## Phase 5: `asset-library`

- [ ] **T22 Binary transport** · S · _new transport, early in the phase_
  - Accept: `defineEndpoint` `encoding: 'binary'` (one `Blob`, `application/octet-stream`) and an optional `headers`
    schema; `EndpointClient` sets declared headers, required exactly when declared (type and runtime);
    `contracts-and-mocks.md` documents both.
  - Verify: `npx nx test contracts lms -- endpoint`.
  - Files: `contracts/http/endpoint.ts` (+ spec), `app/core/http/endpoint-client.ts` (+ spec),
    `docs/conventions/contracts-and-mocks.md`.
  - Depends on: none.
- [ ] **T23 Asset contracts and mock** · M
  - Accept: `contracts/learning-asset/` with the seven endpoints and schemas; the seven codes in `MESSAGE_CODE_KIND`
    and `backendRefusal`; mock uploads in memory (idempotent start, parts, conflict, complete → processing → ready
    on the second poll, cancel), library list, delete with `ASSET_IN_USE`.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/learning-asset/asset.schema.ts`, `asset.endpoints.ts`, `libs/contracts/src/index.ts`,
    `contracts/http/envelope.ts`, `mocks/learning/asset.backend.ts` (+ spec), `mocks/backend-responses.ts`.
  - Depends on: T22.
- [ ] **T24 `@noble/hashes` and the SHA-256 worker** · S
  - Accept: `@noble/hashes` added (exact version); `sha256.worker.ts` hashes a file in 8 MiB slices and single
    parts, reports progress, matches known vectors and the one-shot digest; a 100 MB file's time is reported.
  - Verify: `npx nx test lms -- sha256`.
  - Files: `package.json`, `package-lock.json`, `app/features/admin-content/course-editor/data-access/sha256.worker.ts`
    (+ spec), a small client wrapper.
  - Depends on: none.
- [ ] **T25 `chunkedUpload`** · M
  - Accept: the Observable of the spec: check → hash → start → parts in order with headers, skipping acknowledged →
    complete → poll 3 s up to 15 min → ready/failed; "Xử lý lại" path; cancel; offline pause and continue; a
    mismatched file on resume refused before any request.
  - Verify: `npx nx test lms -- chunked-upload`.
  - Files: `app/features/admin-content/course-editor/data-access/chunked-upload.ts` (+ spec).
  - Depends on: T23, T24.
- [ ] **T26 Course editor uploads through parts** · M
  - Accept: `CourseEditorStore` runs `chunkedUpload` per block key; rows show hashing, bytes, processing, failed with
    the server message, cancel; kept uploads in `localStorage` with resume ("Tiếp tục" / "Hủy"); asset attached on
    ready with server duration/page count; `courseEndpoints.uploadAsset`, its mock and `readFileFacts` removed.
  - Verify: `npx nx test lms contracts mocks -- course-editor`; browser on the mock.
  - Files: `course-editor.store.ts` (+ spec), `components/lesson-form/lesson-form.ts|html`, `file-facts.ts`
    (deleted), `contracts/course/course.endpoints.ts`, `mocks/learning/learning.backend.ts`.
  - Depends on: T25.
- [ ] **T27 Library drawer** · M
  - Accept: "Chọn từ thư viện" per file block opens the drawer with its store; kind fixed by block type, `ready` only,
    search, server paging and sort; row click picks and closes; row menu delete with confirm, `ASSET_IN_USE` toast;
    empty and error states.
  - Verify: `npx nx test lms -- asset-library`; browser on the mock.
  - Files: `course-editor/components/asset-library/asset-library.ts|html|scss|spec.ts`,
    `…/data-access/asset-library.store.ts` (+ spec), `lesson-form.html|ts`.
  - Depends on: T23.

### Checkpoint 5

- [ ] `npm run check` green
- [ ] asset-library success criteria 1–5 on the local backend (criterion 1 needs `ffmpeg`)
- [ ] Stop for approval

## Phase 6: `course-sharing`

- [ ] **T28 Share contract and mock checks** · XS
  - Accept: `ShareCourseCommandSchema` fields required; `CourseShareSchema.status` enum; mock `share` checks the
    booleans, upserts by `orgId`, sets `revokedAt`, refuses the owner org.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/course/course.schema.ts`, `mocks/learning/learning.backend.ts` (+ spec).
  - Depends on: none.
- [ ] **T29 Shares drawer in the course list** · M
  - Accept: "Chia sẻ cho đơn vị" in the row menu opens the drawer; `CourseSharesStore` (shares, owner from
    `getCourse`, org names with fallback, debounced org options without owner and active shares, add/change/revoke
    with confirm); active and revoked sections with rights as text; combobox and switches by keyboard.
  - Verify: `npx nx test lms -- course-shares courses.store`; browser on the mock and the local backend.
  - Files: `app/features/admin-content/courses/components/course-shares/*` (+ store and specs),
    `courses.store.ts` (+ spec), `courses.html`.
  - Depends on: T28.

### Checkpoint 6

- [ ] `npm run check` green
- [ ] course-sharing success criteria 1–3
- [ ] Stop for approval

## Phase 7: wrap-up

- [ ] **T30 End-to-end pass and as-built notes** · S
  - Do: run every success criterion in SPEC.md on the local backend; add "Implementation notes (as built)" to each
    module spec (deviations, known gaps); open the pull request; fill each migration entry's `pullRequest`.
  - Accept: every SPEC.md criterion reported with how it was verified; `npm run check` green.
  - Files: `SPEC*.md`, `migration-entries.data.ts`.
  - Depends on: T29.

### Checkpoint: complete

- [ ] Every success criterion in SPEC.md met and reported with how it was verified
- [ ] Ready for review and the pull request
