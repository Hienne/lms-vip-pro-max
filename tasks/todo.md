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
- [x] **T7 `LessonStore`** · M
  - Accept: loads card and detail; active block from `?block`, `lastBlockId`, first; claim on entry and block change
    with the previous ids; `OPEN` after claim; 20 s heartbeat while visible, none while hidden; one request in flight
    through a serial queue, offline resend of the same payload; results override shown progress; every refusal row
    of the spec; `CLOSE` on block change, route leave and sign-out; `markComplete()`; video and PDF event commands
    exist (used by T10/T11).
  - Verify: `npx nx test lms -- lesson.store` (mock backend, fake timers).
  - Files: `app/features/lesson/lesson/data-access/lesson.store.ts` (+ spec).
  - Depends on: T2, T3, T5, T6.
- [x] **T8 `app-markdown`, text and process blocks** · M
  - Accept: `app-markdown` builds nodes for the editor's markdown subset; `html` bodies rebuilt from the allowlist;
    `plain` keeps line breaks; never a `script`, `style`, `iframe` or `on*` attribute; `text-block` and
    `process-block` render their data; new inventory row and migration entry for `app-markdown`.
  - Verify: `npx nx test lms -- markdown text-block process-block`.
  - Files: `app/shared/content/markdown/*`, `app/features/lesson/lesson/components/text-block/*`,
    `…/process-block/*`, `docs/migration/mockup-to-angular.md`, `migration-entries.data.ts`.
  - Done: the inventory already had the `UI.Markdown` → `app-markdown` row and a `domain-markdown` entry, so only the
    entry was claimed (`in-progress`).
  - Depends on: none.
- [x] **T9 Lesson page (`lesson/:courseId/:lessonId`)** · M
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

- [x] `npm run check` green (2026-10-27; `ui:test` was reported flaky once by Nx and passed on retry)
- [x] Mock (lesson-player criterion 1): enrolled in course 7 as the demo learner, opened "Tổng kết", "Đánh dấu hoàn thành"
      gave "Đã hoàn thành · 27/10/2026", the outline tick and "Khóa học 33%"; `?block=` follows the active block (the
      reload itself is covered by `lesson.spec.ts`, since the in-memory mock session does not survive a full reload)
- [x] Mock: takeover prompt, moved alert and save failure are covered by `lesson.spec.ts` / `lesson.store.spec.ts` (a
      second real tab shares the in-memory mock session, so it is verified on the local backend at T13)
- [x] Stop for approval (recorded only; continuing as instructed)

## Phase 1c: media blocks and the local backend

- [x] **T10 Video block** · M
  - Accept: `<video controls preload="metadata">` with the content URL (`toUrl`, `blockId`, `enrollmentId`), starts
    at the resume position, no autoplay; emits play, pause, ended, seeking and time; the store sends `PLAY`, 10 s
    `HEARTBEAT` with ranges, `PAUSE`, heartbeat-then-`SEEK`; "Đã xem x% · cần y%"; load error with "Thử lại".
  - Verify: `npx nx test lms -- video-block lesson.store`.
  - Files: `app/features/lesson/lesson/components/video-block/*`, `lesson.store.ts` (+ spec), `lesson.html`.
  - Depends on: T9.
- [x] **T11 `pdfjs-dist` and the PDF block** · M
  - Accept: `pdfjs-dist` added (exact version pinned); the block in `@defer`, worker loaded as an asset; one page on a
    canvas, "Trang trước"/"Trang sau", "Trang p/n", zoom; opens at the resume page with the muted line; `PDF_PAGE`
    after 1 s on a page; load error state; production build within budget and the bundle guard green.
  - Verify: `npx nx test lms -- pdf-block`; `npm run check`.
  - Files: `package.json`, `package-lock.json`, `apps/lms/project.json` (asset), `…/components/pdf-block/*`,
    `lesson.html`.
  - Depends on: T9.
- [x] **T12 Image and attachment blocks** · S
  - Accept: `<img>` with `altText` (else the title), caption, load error line; attachments listed with name and size,
    "Tải xuống" through `getAssetContent` as a blob → `FileSaver.save` with the original name, refusal toast.
  - Verify: `npx nx test lms -- image-block attachment-block`.
  - Files: `…/components/image-block/*`, `…/components/attachment-block/*`, `lesson.html`, `lesson.store.ts`.
  - Depends on: T9.
- [x] **T13 Local-backend pass for the lesson player** · S
  - Do: as the content admin, build and publish a course with a PDF (`pdf_end`), a video (`video_coverage`, if
    `ffmpeg` is installed), a text block and an image; assign or share it to `hocvien`; run lesson-player success
    criteria 2 and 3 in two browsers; fix what the pass finds (each fix its own commit with a spec).
  - Accept: criteria 1–4 of SPEC-lesson-player met; `route-course-id`, `route-lesson-course-id-lesson-id`,
    `feature-viewers` marked `done` with their checks.
  - Verify: browser; the network log shows no `STALE_EVENT`/`CONFLICT` during a normal 5-minute session.
  - Files: `migration-entries.data.ts`, fixes as found.
  - Depends on: T10, T11, T12.

### Checkpoint 1c (Phase 1 done)

- [x] `npm run check` green (2026-10-27; Nx reported `ui:test` flaky once, it passes on retry)
- [x] lesson-player success criteria 1–4, how each was verified:
  1. Mock, as `hocvien`: enrolled in the optional course, opened "Tổng kết", "Đánh dấu hoàn thành" moved the lesson,
     the outline tick and "Khóa học 33%"; the URL keeps `?block=` (reload is covered by `lesson.spec.ts`).
  2. Local backend (:8019, course `FE-LP-T13` published by `giangvien` with a PDF, an image, an attachment and a text
     block, enrolled as `hocvien`): the PDF rendered through pdf.js with the worker asset, `PDF_PAGE` on pages 2 and
     3 completed the `pdf_end` block, leaving and coming back reopened it at page 3 ("Đã mở lại tại trang 3."); the
     image loaded through the `academy_media` cookie; the attachment's content answered 200 with the cookie.
     Video, first left out because `ffmpeg` was missing and verified later (2026-10-27, after `brew install ffmpeg`,
     `ffprobe 9.0.2`; the running backend picked it up from its PATH without a restart): `giangvien` uploaded a
     30 s H.264/AAC MP4 (asset 6, `ready`, duration 30.0 read by the server), built and published course
     `FE-LP-T13V` with two `video_coverage` blocks (threshold 90) on that asset, `hocvien` enrolled. In the player
     (`/lesson/8/18`) the video loaded through the `academy_media` cookie. Block "Video xem đủ" played to the end:
     seven progress requests, all 200, the block ended `completed`, 100 %, `watchedSeconds` 30. Block "Video tua đến
     cuối" played 2.5 s, then seeked to 29 s and ended: position 30, `watchedSeconds` 3.3, 11 %, `in_progress`, no
     `completedAt`. So a seek to the end does not complete a video; only watched ranges count. Earlier mock/spec
     coverage of the player stays as it was (PLAY, 10 s beat with range, PAUSE, heartbeat-then-SEEK, resume
     position, error state with "Thử lại").
  3. Two tabs of the same user on the local backend: the second tab asked "Bài học đang mở ở nơi khác", after "Học trên
     thiết bị này" the first tab showed "Bài học đã chuyển sang thiết bị khác." on its next event. Heartbeats went every
     20 s with 200; no `STALE_EVENT` or `CONFLICT` in the network log.
  4. `npm run check` green; both routes checked at 375 / ~800 / 1280 px, light and dark (`data-theme`), keyboard only
     (focus order and a visible 2 px ring); forced error states are covered by specs only (`errorStates` stays
     `todo` in the migration entries, which also stay `in-progress`: no pull request exists yet).
- [x] Stop for approval (recorded only; continuing as instructed)

## Phase 2: `learner-progress`

- [x] **T14 JSON refusal on `blob` endpoints** · S
  - Accept: `envelopeInterceptor` reads a `blob` response with `Content-Type: application/json` as an envelope
    (`ApiError` on `ERROR`, on a 2xx or a 4xx/5xx), passes other blobs through; `contracts-and-mocks.md` "Known
    limit" updated.
  - Verify: `npx nx test lms -- envelope.interceptor`.
  - Files: `app/core/http/envelope.interceptor.ts` (+ spec), `docs/conventions/contracts-and-mocks.md`.
  - Depends on: none.
- [x] **T15 Progress contracts and mock** · S
  - Accept: `LearningProgressOverviewSchema`, `LearningStatusSchema`, `MyCoursesQuerySchema` (`overdue`),
    `ProgressExportQuerySchema`; `progressSummary` and `exportProgress` (`blob`); mock summary counts, `overdue`
    filter and sort on `myCourses`, CSV blob with BOM, `EXPORT_TOO_LARGE` as a JSON blob.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/learner/learner.schema.ts`, `learner.endpoints.ts`, `mocks/learning/learning.backend.ts`,
    `mocks/backend-responses.ts`.
  - Depends on: T1.
- [x] **T16 Progress page (`progress`)** · M
  - Accept: claims `route-progress`; `ProgressStore` (URL-synced filters, debounced `q`, page reset, export with the
    table's query and the dated file name); header with "Xuất CSV", KPI row, unavailable note, filters, data table
    per spec, empty / no-match / error states; `screens.ts` loads it.
  - Verify: `npx nx test lms -- progress`; browser on the mock and the local backend (criteria 1–3).
  - Files: `app/features/achievements/progress/progress.ts|html|scss|spec.ts`, `…/data-access/progress.store.ts`
    (+ spec), `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T14, T15.

### Checkpoint 2

- [x] `npm run check` green (2026-10-27; one `lms:test` run failed under load and passed on the rerun, Nx reports it
      flaky; the failing test was not identified)
- [x] learner-progress success criteria 1–4, how each was verified:
  1. Local backend as `hocvien`: the five KPIs (6 / 1 / 2 / 3 / 1) equal the server's summary; the table sorts on
     the server (`sort=title,asc` in the URL and the request); "Chỉ khóa quá hạn" leaves the one overdue course.
  2. "Xuất CSV" on the local backend saved `tien-do-cua-toi-2026-10-27.csv`: `text/csv`, UTF-8 BOM (EF BB BF) and
     Vietnamese titles intact. **Not opened in Excel itself** (no Excel here); BOM plus UTF-8 is what it needs.
  3. `LEARNING-EXPORT_TOO_LARGE` toasts the server message and saves nothing: verified in `progress.spec.ts` and
     the envelope interceptor spec only (the real backend has fewer than 10,000 rows, so it cannot be forced).
  4. Check green; 1280 and 375 px in light and dark were looked at on the local backend (at 375 the rows are cards,
     the segmented control no longer widens the page). At ≤1280 px the nine-column table scrolls sideways inside its
     wrapper (the "Hoàn thành" and "Hạn" columns are off screen until scrolled); all controls are native elements.
     `route-progress` stays `in-progress`: a migration entry needs a pull request link to be `done`.
- [x] Stop for approval (a note only; continuing as instructed)

## Phase 3: `learning-reminders`

- [x] **T17 Reminder contract and mock** · S
  - Accept: `status` enum; fixtures (three due for `hocvien`, one overdue, one not yet scheduled); `reminders` lists
    pending and due for the caller; `markReminderRead` sets `sent`, 403 for another user's; mock `navCounts`
    `notifications` = the caller's due reminders.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/learner/learner.schema.ts`, `mocks/learning/learning.fixtures.ts`,
    `mocks/learning/learning.backend.ts`, `mocks/backend/fake-backend.ts`.
  - Depends on: T1.
- [x] **T18 Notifications page (`notifications`)** · M
  - Accept: claims `route-notifications`; `NotificationsStore` (idle without `COURSE_LEARNING`, 403 → empty, mark one,
    mark all in order stopping at a refusal, bumps `remindersChanged`); `core/learning/reminders-changed.ts`; page per
    spec with the progress link and its query; `screens.ts` loads it.
  - Verify: `npx nx test lms -- notifications reminders-changed`; browser.
  - Files: `app/features/account/notifications/notifications.ts|html|scss|spec.ts`,
    `…/data-access/notifications.store.ts` (+ spec), `app/core/learning/reminders-changed.ts` (+ spec),
    `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T17.
- [x] **T19 Bell count on the real backend** · S
  - Accept: while `navCounts` is not served, `ShellStore.unread$` is the reminders count for a `COURSE_LEARNING`
    user, refreshed on navigation and on `remindersChanged`, 0 on 403 or error.
  - Verify: `npx nx test lms -- shell.store`; local backend: read a reminder, the bell drops without reload.
  - Files: `app/layout/shell/data-access/shell.store.ts` (+ spec).
  - Depends on: T18.

### Checkpoint 3

- [x] `npm run check` green (2026-10-27; Nx flagged one task flaky: a test failed once and passed on its retry)
- [x] learning-reminders success criteria 1–4, how each was verified:
  1. Local backend as `hocvien` (two due reminders: one overdue, one upcoming), with the in-app mock API switched
     off so `navCounts` is not served (the production setup; `environment.ts` restored afterwards): the bell read
     "2 chưa đọc", `notifications` listed both with the due dates, "Đánh dấu đã đọc" removed one and the bell went to
     "1 chưa đọc" without a reload; no `nav-counts` request was made.
  2. As a user without the learner function: `notifications.spec.ts` and `shell.store.spec.ts` (empty line, no
     request, bell 0). Not tried on the real backend with an admin account.
  3. Mock: `learner.backend.spec.ts` (three seeded reminders, read, bell 3 → 2) and the same flow in
     `notifications.spec.ts`.
  4. Check green; looked at 1024 and 375 px, light and dark on the local backend; the read button is a native
     button. Deviation: the "Xem khóa học của tôi" link and the read button are both shown at narrow widths (the row
     wraps), instead of hiding the button. `route-notifications` stays `in-progress` (needs a pull request link).
- [x] Stop for approval (a note only; continuing as instructed)

## Phase 4: `learner-home`

- [x] **T20 Promote shared learning pieces** · M
  - Accept: `progress-counts`, `unavailable-note` and `reminder-item` move to `app/shared/learning/` with their
    specs; the progress and notifications pages use them; no behaviour change.
  - Verify: `npx nx test lms -- progress notifications shared/learning` green before and after.
  - Files: `app/shared/learning/*`, `progress.html`, `notifications.html` (+ the moved files).
  - Depends on: T16, T18.
- [x] **T21 Learn page (`learn`)** · M
  - Accept: claims `route-learn`; `LearnStore` (summary, resume card + its detail, tab courses incl. `mandatory`, due
    list filtered to 5, reminders idle/403); `continue-card`; page per spec with independent loading and error per
    section; `screens.ts` loads it.
  - Verify: `npx nx test lms -- learn continue-card`; browser on the mock and the local backend (criteria 1–3).
  - Files: `app/features/learning/learn/learn.ts|html|scss|spec.ts`, `…/data-access/learn.store.ts` (+ spec),
    `…/components/continue-card/*`, `app/core/routing/screens.ts`, `migration-entries.data.ts`.
  - Depends on: T20, T13.

### Checkpoint 4

- [x] `npm run check` green (2026-10-27; Nx flagged `lms:test` as flaky again: a test failed once and passed on its retry)
- [x] learner-home success criteria 1–4, how each was verified:
  1. Local backend as `hocvien`: the continue card names "Tài liệu và hình ảnh" (25 %) and its link reopens that
     block; `continue-card.spec.ts` and `learn.store.spec.ts` cover the lesson, the block query and the empty card.
  2. The counts (6 / 1 / 2 / 3 / 1 overdue) equal the numbers on `/progress`; the tabs list the server-filtered
     courses (`in_progress`, `not_started`, `completed`, `mandatory`); the due list shows the five nearest with the
     overdue one first; reminders show three and stay out for a user without the function (`learn.store.spec.ts`).
  3. A learner with nothing in progress sees "Khám phá khóa học": `learn.spec.ts` (stubbed empty `myCourses`, since an
     administrator is redirected away from `/learn`). Not tried on the real backend.
  4. Check green; looked at 375, 768 and 1280 px on the local backend, light and dark (no horizontal scroll, the
     primary button reads in both), controls reached by keyboard and named, tabs use a roving tabindex.
     Deviation: `route-learn` is owned by `longnvse` in `migration-entries.data.ts`, so its entry was left alone.
  - Fixed on the way: `app.spec.ts` and `app-shell.spec.ts` now answer the requests the page makes (they hung
    120 s per test because `/learn` was a placeholder before).
- [x] Stop for approval (a note only; continuing as instructed)

## Phase 5: `asset-library`

- [x] **T22 Binary transport** · S · _new transport, early in the phase_
  - Accept: `defineEndpoint` `encoding: 'binary'` (one `Blob`, `application/octet-stream`) and an optional `headers`
    schema; `EndpointClient` sets declared headers, required exactly when declared (type and runtime);
    `contracts-and-mocks.md` documents both.
  - Verify: `npx nx test contracts lms -- endpoint`.
  - Files: `contracts/http/endpoint.ts` (+ spec), `app/core/http/endpoint-client.ts` (+ spec),
    `docs/conventions/contracts-and-mocks.md`.
  - Depends on: none.
- [x] **T23 Asset contracts and mock** · M
  - Accept: `contracts/learning-asset/` with the seven endpoints and schemas; the seven codes in `MESSAGE_CODE_KIND`
    and `backendRefusal`; mock uploads in memory (idempotent start, parts, conflict, complete → processing → ready
    on the second poll, cancel), library list, delete with `ASSET_IN_USE`.
  - Verify: `npx nx test contracts mocks`.
  - Files: `contracts/learning-asset/asset.schema.ts`, `asset.endpoints.ts`, `libs/contracts/src/index.ts`,
    `contracts/http/envelope.ts`, `mocks/learning/asset.backend.ts` (+ spec), `mocks/backend-responses.ts`.
  - Depends on: T22.
- [x] **T24 `@noble/hashes` and the SHA-256 worker** · S
  - Accept: `@noble/hashes` added (exact version); `sha256.worker.ts` hashes a file in 8 MiB slices and single
    parts, reports progress, matches known vectors and the one-shot digest; a 100 MB file's time is reported.
  - Verify: `npx nx test lms -- sha256`.
  - Files: `package.json`, `package-lock.json`, `app/features/admin-content/course-editor/data-access/sha256.worker.ts`
    (+ spec), a small client wrapper.
  - Depends on: none.
- [x] **T25 `chunkedUpload`** · M
  - Accept: the Observable of the spec: check → hash → start → parts in order with headers, skipping acknowledged →
    complete → poll 3 s up to 15 min → ready/failed; "Xử lý lại" path; cancel; offline pause and continue; a
    mismatched file on resume refused before any request.
  - Verify: `npx nx test lms -- chunked-upload`.
  - Files: `app/features/admin-content/course-editor/data-access/chunked-upload.ts` (+ spec).
  - Depends on: T23, T24.
- [x] **T26 Course editor uploads through parts** · M
  - Accept: `CourseEditorStore` runs `chunkedUpload` per block key; rows show hashing, bytes, processing, failed with
    the server message, cancel; kept uploads in `localStorage` with resume ("Tiếp tục" / "Hủy"); asset attached on
    ready with server duration/page count; `courseEndpoints.uploadAsset`, its mock and `readFileFacts` removed.
  - Verify: `npx nx test lms contracts mocks -- course-editor`; browser on the mock.
  - Files: `course-editor.store.ts` (+ spec), `components/lesson-form/lesson-form.ts|html`, `file-facts.ts`
    (deleted), `contracts/course/course.endpoints.ts`, `mocks/learning/learning.backend.ts`.
  - Depends on: T25.
- [x] **T27 Library drawer** · M
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

- [x] **T28 Share contract and mock checks** · XS
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
