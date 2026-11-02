# Tasks: `certificates`

Spec: [SPEC-certificates.md](../SPEC-certificates.md) · Plan: [plan.md](plan.md).
The previous `lesson-feedback` checklist, with its success criteria and how each was checked, is in git history at
`a93b2ba`.

- **Repositories:**
  - backend: `corebanking-academy`, branch `feat/certificates` from `origin/main` (`e686291`, #21 merged), in its
    own worktree `~/my-projects/corebanking-academy-certificates`;
  - app: this one, branch `feat/certificates` from `origin/main` (`a27364a`, #55 merged).

  Nothing is pushed.

- **Local stack:**
  - The backend on :8019 is the main session's background task. Never run `mvn` in the worktree it runs from, and
    never start another backend. Message the main session for a restart.
  - Until Checkpoint A it runs from the old feedback worktree, which is the same code as `main` for this module.
  - The app runs on :4200 against `localhost:8019`.
  - Accounts: `hocvien` and `hocvien.tichhop` as learners.
  - The completed cycles to test with are listed in the plan ("Local data").
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No seeding users, and no direct edits to enrollments, progress
  or attempts.
- **No schema change** in this module. If one turns out to be needed, stop and ask.

## Phase 1: Backend

- [x] **B1: Certificates C1 and C2**
  - Acceptance:
    - `GET /api/v1/me/learning/certificates?page&size`:
      - returns `PageResponse<CertificateView>` with the caller's cycles that have `status = 'completed'` and
        `completed_at` set;
      - newest completion first, then the highest id;
      - size at most 100.
    - `GET /api/v1/me/learning/certificates/{enrollmentId}` returns one `CertificateView`. It answers
      `LEARNING-NOT_FOUND` when the id:
      - is another learner's;
      - is not completed (including `withdrawn`);
      - does not exist.
    - `CertificateView` follows amendment 3:
      - `courseTitle` is the completed revision's;
      - `bestScorePercent` is the course's `FINAL_EXAM` best, as on the card;
      - `verificationCode` is `CBA-{courseCode}-{userId}-{cycleNo}` in upper case;
      - `fullName` comes from `LearningIdentityService.fullNames`.
    - Names and scores are filled with one call each per page, not one per row.
    - A non-learner gets `CORE-ACCESS_DENIED`.
    - The code lives in a new `LearningCertificateService` and `LearningCertificateController`.
  - Verify: a `LearningCertificatesIT` covering:
    - only the caller's completed cycles, in order, and paging;
    - another learner's id, an in-progress id, a withdrawn id and a missing id all answer `NOT_FOUND`;
    - after a new revision is published with another title, the certificate keeps the completed revision's title;
    - the score equals the card's `bestScorePercent`, and is null without a final exam;
    - two cycles of one course give two certificates with different codes;
    - non-learners are refused.
  - Size: M. Depends on: none.

- [x] **B2: `CourseCard.certificateId` (C3)**
  - Acceptance:
    - A `@JsonProperty` accessor `certificateId()` on `CourseCard` returns `enrollmentId` when `learningStatus` is
      `completed`, and null otherwise.
    - No change to the search SQL, the Hibernate constructor or any caller.
  - Verify: an IT asserts the JSON field:
    - on the catalogue and on `GET /me/learning/courses/{id}`;
    - for a completed cycle (the enrollment id), an in-progress one (null) and a course with no enrollment (null).
  - Size: XS. Depends on: none.

- [x] **B3: Docs**
  - Acceptance:
    - a "Chứng nhận" section in `docs/api/LEARNING.md` with C1 and C2, the rule, the code format, the errors and an
      example;
    - `certificateId` added where the card fields are listed.
  - Verify: the examples match the IT responses.
  - Size: XS. Depends on: B1, B2.

### Checkpoint A

- [x] `mvn -o clean test` green in the certificates worktree: 444 tests, 0 failures, 0 errors, 42 skipped
      (`CommunityApiIT`, as on `main`). Commits `570a1be` (B1), `4e0e5ea` (B2), `26c2d77` (B3).
- [x] The main session restarted :8019 from `~/my-projects/corebanking-academy-certificates` and checked with `curl`
      (2026-11-02):
  - **C1:**
    - as `hocvien`: 17 (QZ-E2E-01, score 100) then 12 (FE-DEMO-C4, score null), with every field;
    - name "Học viên tiền gửi Demo", codes `CBA-QZ-E2E-01-000004-1` and `CBA-FE-DEMO-C4-000004-1`;
    - `page=1&size=1` gives 12 with 2 pages; a page past the end is empty;
    - `size=101` and `size=0` answer `CORE-VALIDATION_FAILED`;
    - `hocvien.tichhop` gets its own 4 and 10 only.
  - **C2:**
    - 12 returns every field, and the score of 17 equals the course card's `bestScorePercent` (100);
    - `LEARNING-NOT_FOUND` for `hocvien.tichhop` on 12, for `hocvien` on 3 (in progress) and on 999999;
    - id 0 and `abc` answer `CORE-VALIDATION_FAILED`.
  - **Access:** `quantri` (ADMIN) and `baocao` (REPORT_VIEWER) get `CORE-ACCESS_DENIED`.
  - **C3:**
    - as `hocvien`, `/courses/4` has `certificateId: 12`, `/courses/8` 17, and `/courses/1` (in progress) null;
    - `/courses` and `/catalog` carry the same two ids and null elsewhere;
    - `hocvien.tichhop`'s `/courses/4` has 10.
- [x] The responses are captured (no tokens) for F1, in the main session's scratchpad `certificate-captures/`:
      the list, one certificate, the course card, not-found and a bad id.
- **Open (non-blocking):** the new Javadoc and comments in the backend are in English. `DEVELOPMENT_GUIDELINES.md`
  ("Comment, Javadoc và mô tả Swagger") asks for Vietnamese. To fix in the backend before the PR.
- [ ] Review with the user before Phase 2.

## Phase 2: App

- [ ] **F1: Contracts, captured responses, mock, route table**
  - Acceptance:
    - **Contracts:**
      - `certificates` (C1, paged) and `certificate` (C2, numeric `enrollmentId`) are under
        `/api/v1/me/learning`, with no `served: 'mock'`;
      - `CertificateSchema` follows `CertificateView`;
      - `CourseCardSchema` gains a nullable `certificateId`;
      - `downloadCertificate`, `demoCertificatePdf` and `certificateFixtures` are deleted.
    - The captured responses from Checkpoint A parse.
    - **Mock:**
      - the in-app mock serves C1 and C2 from the learning seed's completed enrollments, with the backend rules
        (only the caller's completed cycles, `NOT_FOUND` otherwise);
      - its course cards derive `certificateId`.
    - **`route-table.spec.ts`:**
      - a learner opens `/certificates` and `/certificate/1` in a backend-only build;
      - the admin case keeps `/403` with `LEARNING_PROGRESS`;
      - the "closed in a backend-only build" test changes to another mock-only screen, or is deleted if none
        remains.
  - Verify: the contracts, mocks and route-table specs are green.
  - Size: M. Depends on: Checkpoint A.

- [ ] **F2: The list "Chứng nhận hoàn thành"**
  - Acceptance:
    - A `certificates` component with its own store under `data-access`. The store reads one page of 100.
    - **Page header:** "Chứng nhận hoàn thành", with the mockup description.
    - **The list:** a plain list (amendment 6). Each row has:
      - the course title (or the code when the title is null) as the link to `/certificate/{id}`;
      - the meta line "{code} · Hoàn thành {dd/MM/yyyy} · Điểm {n}%", without the score part when it is null;
      - the verification code in `ui.mono`.
    - It has no hoa mai tile, no badge and no card grid.
    - **Empty state:** whole-page and left-aligned, with "Chưa có chứng nhận", "Hoàn thành khóa học đầu tiên để
      nhận chứng nhận." and "Xem khóa học của tôi" → `/learn`.
    - **Loading and error:** a loading state, and an error state with retry.
  - Verify: specs for the rows (with and without score and title), the empty state, and the error with retry.
  - Size: S. Depends on: F1.

- [ ] **F3: The certificate screen and print**
  - Acceptance:
    - A `certificate` component with its own store.
    - **Page header and breadcrumb:**
      - the breadcrumb Chứng nhận › {course};
      - the page header is the course title;
      - its only action is the primary "In / Lưu PDF", which calls `window.print()`.
    - **The document** (amendment 6):
      - a flat `surface` panel with a 1px border and a small `ui-mai`;
      - "Core Banking Academy · Ban QL&PT Core Banking";
      - "Chứng nhận hoàn thành" (h2);
      - "Chứng nhận", then the full name as the largest text;
      - "đã hoàn thành khóa đào tạo **{title}** ({code})", then " với kết quả bài kiểm tra {n}%" when there is a
        score, then ".";
      - "Ngày hoàn thành" and "Mã xác thực" side by side, wrapping at 375 px;
      - the demo line only under `mockBackend`.
    - **Not found:** C2 `NOT_FOUND`, or a non-numeric id (without a call), shows "Chứng nhận không tồn tại hoặc bạn
      chưa hoàn thành khóa học." with a link to `/certificates`. Other errors show the error state with retry.
    - **Print:**
      - `@media print` hides the shell, the breadcrumb, the page header and the toasts;
      - `@page` is A4 landscape, and the document fits one page;
      - a `@media print` block in the `ui` global theme re-declares the light colour tokens, so any page prints
        light from dark mode;
      - the built CSS is checked to contain `@page` (see the risk in the plan).
    - No literal colours, no uppercase, no watermark.
    - The old `certificates.html` / `.scss` / store are deleted.
  - Verify:
    - specs for every field;
    - a missing score;
    - a null title;
    - not-found from the server, and from a non-numeric id;
    - the print button calls `window.print`;
    - the styles spec for the print theme.
  - Size: M. Depends on: F1.

- [ ] **F4: "Xem chứng nhận" on the course page**
  - Acceptance:
    - When `card.certificateId` is set, the header action is the primary link "Xem chứng nhận" →
      `/certificate/{certificateId}`.
    - Nothing appears without it, whatever `learningStatus` says.
  - Verify: the course spec covers both cases.
  - Size: XS. Depends on: F1.

- [ ] **F5: End-to-end check against the spec**
  - Acceptance: the success criteria below are written here, each with how it was checked.
  - Verify: `npm run check`.
  - Size: S. Depends on: F2, F3, F4.

### Checkpoint B

- [ ] Success criteria recorded:
  1. `hocvien`'s completed cycles (FE-DEMO-C4 and QZ-E2E-01) are listed, open, and show the server's name, course,
     date, score and code.
  2. "Xem chứng nhận" appears on the FE-DEMO-C4 course page and not on FE-DEMO-C1's.
  3. The print preview (by the user, in dark mode) has no shell chrome and fits one A4 landscape page.
  4. `mvn clean test` and `npm run check` green. The visual-design checklist passes for both screens.
- [ ] Browser check by the main session at 1280 px light and 375 px dark. It covers `hocvien.tichhop`'s list
      and `/certificate/3`.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `lesson-player-modes`.
