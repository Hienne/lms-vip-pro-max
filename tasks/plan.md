# Implementation Plan: `certificates`

Spec: [SPEC-certificates.md](../SPEC-certificates.md) (approved 2026-11-02, amended below). Map: [SPEC.md](../SPEC.md).
Tasks: [todo.md](todo.md).

This plan replaces the one for `lesson-feedback`. That plan is done; its PRs are hmhug19/corebanking-academy#21 and
Hienne/lms-vip-pro-max#55, and it is in git history at `a93b2ba`.

## Overview

A learner sees a certificate for each course cycle they completed:

- the list "Chứng nhận hoàn thành";
- one certificate, which they print or save as PDF from the browser;
- "Xem chứng nhận" on the page of a course they completed.

**Backend.** No schema change. A certificate is a completed enrollment cycle. There are two read endpoints, and
the course card gains a derived `certificateId`. The backend PR has no SQL step.

## What was checked while planning (2026-11-02)

**Backend (`corebanking-academy`, `origin/main` at `e686291`, with #21 merged)**

- **Completion is the server's.**
  - `LearningProgressService.updateEnrollment` sets `status = completed` and `completed_at` once:
    - when every required lesson is at 100 %;
    - and the revision has no `course_assessments`.
  - A quiz lesson reaches 100 % when its quiz is passed (`completeQuizLessons`).
  - Certificates only read the result.
- **`course_enrollments`** has every certificate field:
  - `enrollment_id`, `course_id`, `revision_id`, `user_id`, `cycle_no`, `status`, `completed_at`;
  - `withdrawn` is a status of its own.
  - The course title is per revision (`course_revisions.title`, nullable), and the code is `courses.code`.
- **`CourseCard` already carries `enrollmentId`, `learningStatus` and `completedAt`** for the card's cycle.
  - It is the record behind the catalogue, the learn lists and `LearnerCourse` (D4).
  - It has a constructor that Hibernate fills from SQL. `bestScorePercent` and `rating` are filled per page.
- **Score.** `bestScorePercent` on the card is the best score of the course's `FINAL_EXAM` quiz over all the
  learner's attempts (`LearningQuizDirectory.scores`). It is null without a final exam or a graded attempt.
- **Names.** `LearningIdentityService.fullNames(ids)` exists. `orgNames` exists, but the mockup certificate shows no
  unit.
- **Errors.** `LearningResponseCode.NOT_FOUND` exists. `CERTIFICATE_NOT_FOUND` does not.
- **Local data.** Completed cycles exist already, so no one has to finish a course to test:

  | Learner           | Enrollment | Course     | Completed  |
  | ----------------- | ---------- | ---------- | ---------- |
  | `hocvien`         | 12         | FE-DEMO-C4 | 2026-10-27 |
  | `hocvien`         | 17         | QZ-E2E-01  | 2026-10-31 |
  | `hocvien.tichhop` | 4          | FE-DEMO-C2 | 2026-10-31 |
  | `hocvien.tichhop` | 10         | FE-DEMO-C4 | 2026-10-27 |

  QZ-E2E-01 was completed through its quiz lesson. In-progress cycles to test the refusal include `hocvien`'s 3
  (FE-DEMO-C1).

**App**

- `features/achievements/certificates` predates the conventions:
  - **Template:** one template switches between the list and the detail.
  - **Store:**
    - `$`-suffixed selectors;
    - a "Tải PDF" download of a demo PDF;
    - string ids;
    - the mock path `/api/me/certificates` with `served: 'mock'`.
  - **Design:**
    - a hoa mai tile and a "Đã cấp" success badge on every card;
    - the watermark;
    - an eyebrow and an all-caps title on the document.

  It is rewritten, not patched.

- **Mock.** `libs/mocks/src/lib/personal` serves the certificates from fixtures unrelated to the learning seed.
- **Route table.**
  - The screens `certificates` and `certificate/:id` require `personalEndpoints.certificates` / `certificate`. Being
    mock-only, they are closed (`/403`) in a backend-only build.
  - `route-table.spec.ts` asserts that.
- **Course page.**
  - `primaryAction$` returns null for a completed cycle, so a completed course has no main action today.
  - The meta line has the rating.
- **Quiz result.** `assessment-result.ts` notes that the backend's result does not say whether the course was
  completed, so it has no certificate link.
- **Print.**
  - The dark theme is CSS custom properties on `:root` (`[data-theme=dark]` and `prefers-color-scheme`). They still
    apply when printing, so a dark-mode print would put light text on white paper.
  - The only `@media print` rules are in the old certificates SCSS and `ui` toasts.

**Mockup** (`tools.js` `certificates` / `certificate`, `api/learner.js` `certificates`, `learner.js` course hero,
`components.css` `.certificate`)

- **List:**
  - header "Chứng nhận hoàn thành", with "Chứng nhận tự động cấp khi bạn hoàn thành khóa học. Mỗi chứng nhận có mã
    xác thực.";
  - one card per certificate: title, then "{code} · Hoàn thành {date} · Điểm {n}%", then the code;
  - empty state "Chưa có chứng nhận", "Hoàn thành khóa học đầu tiên để nhận chứng nhận.", and the button "Xem khóa
    học của tôi" → `/learn`.
- **Detail:**
  - breadcrumb Chứng nhận › {course}, and "In / Lưu PDF";
  - **the document:**
    - "Core Banking Academy · Ban QL&PT Core Banking";
    - "Chứng nhận hoàn thành";
    - "Chứng nhận", then the name;
    - "đã hoàn thành khóa đào tạo **{title}** ({code}) với kết quả bài kiểm tra {n}%.";
    - "Ngày hoàn thành" and "Mã xác thực".
  - The missing case reads "Chứng nhận không tồn tại hoặc bạn chưa hoàn thành khóa học.".
- **Course hero:** a completed course's primary action is "Xem chứng nhận".

## Amendments to the spec

1. **Errors.** C2 answers the existing `LEARNING-NOT_FOUND` for every case it refuses:
   - an id that is not the caller's;
   - a cycle that is not completed (including `withdrawn`);
   - an id that does not exist.

   There is no `CERTIFICATE_NOT_FOUND`. A non-learner gets `CORE-ACCESS_DENIED`, as on every `/me/learning` endpoint.

2. **What counts.** A certificate is a cycle of the caller with `status = 'completed'` and `completed_at` set.
3. **`CertificateView` without `orgName`.** The mockup certificate shows no unit, and a unit raises the question of
   which one (the one at enrollment, or today's). The view is:

   ```java
   public record CertificateView(Long id, Long courseId, String courseCode, String courseTitle,
                                 Integer cycleNo, Long revisionId, String userId, String fullName,
                                 Instant completedAt, BigDecimal bestScorePercent, String verificationCode) {
   }
   ```

   - **`courseTitle`:** the completed revision's title, nullable as on the card. The app shows the code when it is
     null.
   - **`bestScorePercent`:** the card's value (the final exam's best), filled with one call per page.
   - **`verificationCode`:** `CBA-{courseCode}-{userId}-{cycleNo}` in upper case, for example
     `CBA-FE-DEMO-C4-000004-1`.

4. **C1 paging.** `page` and `size` are accepted, with size at most 100. The order is fixed: newest completion
   first, then the highest id. The app reads one page of 100 (see open question 5).
5. **C3 is derived, not a column.** `CourseCard` gets an accessor `certificateId()`, annotated `@JsonProperty`. It
   returns `enrollmentId` when `learningStatus` is `completed`, and null otherwise. The search SQL, the Hibernate
   constructor and every caller stay unchanged. The rule "a completed cycle is a certificate" stays on the server.
6. **Screens follow `visual-design.md`, not the mockup's look.**
   - **List:**
     - a plain list, one row per certificate: the course title as the link to the certificate, the meta line
       "{code} · Hoàn thành {date} · Điểm {n}%", and the code in `ui.mono`;
     - no hoa mai tile and no "Đã cấp" badge (every certificate is issued, so the badge says nothing);
     - the empty state is a whole-page one, left-aligned, with the mockup copy and the button "Xem khóa học của
       tôi" → `/learn`.
   - **Detail:**
     - the page header is the course title, with "In / Lưu PDF" as its only (primary) action, and the breadcrumb
       Chứng nhận › {course};
     - the document is a flat `surface` panel with a 1px border and a small `ui-mai` mark as the brand;
     - "Core Banking Academy · Ban QL&PT Core Banking" is plain sentence-case text;
     - "Chứng nhận hoàn thành" is an h2 in sentence case, and the name is the largest text;
     - no watermark, no all-caps, no coloured frame, no literal colours;
     - "Bản xem trước · dữ liệu môi trường demo" shows only when `mockBackend` is on.
   - **Detail error state:** a C2 `NOT_FOUND` renders "Chứng nhận không tồn tại hoặc bạn chưa hoàn thành khóa học."
     with a link back to the list. A non-numeric id goes to the same state without a call.
7. **Print.**
   - "In / Lưu PDF" calls `window.print()`.
   - The print rules:
     - hide the shell, the breadcrumb, the page header and the toasts;
     - print the document alone on one A4 landscape page (`@page`);
     - print in the light theme's colours whatever the screen theme is.

     The light-colour rule is a `@media print` block in the `ui` global theme, with a styles spec. Every printed page
     then gets it, not only this one.

   - The browser's "Lưu dưới dạng PDF" makes the file.

8. **Download removed.** These go:
   - `downloadCertificate` and its mock;
   - `demoCertificatePdf`;
   - the "Tải PDF" button.

   `FileSaver` stays, since others use it.

9. **Endpoints move to `learningEndpoints`** (or a `certificates` group under `/api/v1/me/learning/certificates`),
   with numeric ids and no `served: 'mock'`.
   - Both screens open in a backend-only build. `route-table.spec.ts` drops `/certificates` and `/certificate/1`
     from the closed list.
   - The admin case keeps `/403` with `LEARNING_PROGRESS`.
   - Its "closed in a backend-only build" test changes to whatever personal mock-only screen remains. It is deleted
     if none remains.
10. **Mock from the seed.** The in-app mock serves C1 and C2 from the learning seed's completed enrollments, and the
    mock course card derives `certificateId` the same way. The list, the card and the detail then agree under
    `mockBackend: true`. The old `certificateFixtures` go.
11. **Testing locally uses the existing completed cycles** (table above), not a new course completion. The
    QZ-E2E-01 cycle covers a course completed through its quiz lesson.

## Architecture decisions

- **No table, no write path.** Certificates are a read model over `course_enrollments`. Revoking or numbering them
  would need a table; nobody asked for that.
- **The id is the enrollment id.** It is stable, it carries the cycle, and C2 checks ownership with one query
  (`enrollment_id = :id and user_id = :caller and status = 'completed'`).
- **Per-page fills, as on the card:**
  - names come from one `fullNames` call (it is the caller, so one name);
  - scores come from one `quizzes.scores(userId, courseIds)` call for the page's courses.
- **A new `LearningCertificateService` and controller** in `learning`. It does not grow `LearningSearchService`.
- **The app has two components:** `certificates` (the list) and `certificate` (the detail and its document), each
  with its own store under `data-access`.
- **The course page reads `card.certificateId`.** It never infers a certificate from `learningStatus`.

## Shared server

There is no schema change. The order:

1. merge the backend PR, and wait for the deploy;
2. merge the app PR. The app calls C1 and C2 and reads `certificateId`, so it must not land first.

## Task list

Detailed in [todo.md](todo.md).

**Phase 1 (backend)**

- **B1:** C1 and C2: query, service, controller, `CertificateView`, ITs.
- **B2:** C3 `CourseCard.certificateId`, with an IT.
- **B3:** docs.
- **Checkpoint A:** the main session restarts :8019 on the branch, checks with `curl`, and captures the responses
  for F1.

**Phase 2 (app)**

- **F1:**
  - contracts, captured responses, mock from the seed;
  - the download removed;
  - the route table opened.
- **F2:** the list screen and its store.
- **F3:** the certificate screen, its document and the print rules (with the `ui` print theme).
- **F4:** "Xem chứng nhận" on the course page.
- **F5:** end-to-end check.
- **Checkpoint B:** the main session checks in the browser. The user checks the print preview.

## Risks and mitigations

| Risk                                                                                        | Mitigation                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dark-mode print puts light text on white.                                                 | The `ui` print block re-declares the light colour tokens under `@media print`. A styles spec asserts it. The user's print preview at Checkpoint B is taken in dark mode.               |
| `@page` inside a component's emulated-encapsulation SCSS is dropped or rewritten.           | F3 checks the built CSS. If it is dropped, the `@page` rule goes in the app's global styles, next to the print theme.                                                                  |
| The derived `certificateId` is not serialised (Jackson and record accessors).               | B2's IT asserts the JSON field on the card, both when completed and when not, on the catalogue and on `GET /courses/{id}`.                                                             |
| The score on an old cycle's certificate includes later attempts.                            | Accepted for now (open question 4). The score is the card's, so both screens agree.                                                                                                    |
| The main session cannot open the print dialog in the in-app browser.                        | The main session checks that the print rules are in the built CSS. The user does one print preview (Cmd+P) in dark mode, and says whether it fits one A4 landscape page with no shell. |
| The learner card shows the latest cycle, so a learner on a retake sees no "Xem chứng nhận". | Intended: the card describes the current cycle. Earlier certificates stay in the list.                                                                                                 |

## Open questions (defaults apply unless the user says otherwise)

1. **Public verification:** none in this initiative (spec question 1).
2. **Seal or signature image:** none, since there is no approved asset (spec question 2).
3. **"Xem chứng nhận" on the quiz result:** not in this module. The backend's quiz result does not say whether the
   course was completed, and adding that is a change to `assessment`.
4. **Score per cycle:** the certificate shows the course's best final-exam score over all attempts, as the card
   does, not the score inside that cycle.
5. **More than 100 certificates:** the list shows the newest 100. No learner is near that.

## Verification

- **Backend:** `mvn clean test`, then Checkpoint A on the local stack:
  - C1 as `hocvien` lists 17 and 12, in that order;
  - C2 shows each field;
  - `hocvien.tichhop` gets `NOT_FOUND` on 12, and `hocvien` gets `NOT_FOUND` on 3 (in progress);
  - an admin gets `ACCESS_DENIED`;
  - the card of course 4 has `certificateId: 12` for `hocvien`, and course 1 has null.
- **App:** `npm run check`, then Checkpoint B in the browser:
  - 1280 px light and 375 px dark;
  - the list, a certificate, and the not-found state at `/certificate/3`;
  - the course page of FE-DEMO-C4 shows "Xem chứng nhận", and FE-DEMO-C1 does not;
  - `hocvien.tichhop` sees its own two certificates only;
  - the print preview, by the user.
