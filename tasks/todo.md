# Tasks: `learner-home-refresh`

Spec: [SPEC-learner-home.md](../SPEC-learner-home.md) · Plan: [plan.md](plan.md).
The previous `certificates` checklist, with its success criteria and how each was checked, is in git history at
`2f0f5bc`.

- **Repositories:**
  - app: this one, branch `feat/learner-home-refresh` from `origin/main` (`a27364a`);
  - backend: no change. The local backend runs `main` (`5563e76`). Nothing is pushed.
- **Local stack:**
  - The backend on :8019 is the main session's background task. Never run `mvn`, and never start another backend.
  - The app runs on :4200 against `localhost:8019`.
  - Accounts: `hocvien` and `hocvien.tichhop` as learners.
  - Passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, and are never printed.
  - In the browser, sign in with the one-shot token method, never by typing the password.
- **Never** touch the shared server `103.121.90.119`. No seeding users, and no direct edits to enrollments, progress
  or attempts.
- **No schema change** in this module. If one turns out to be needed, stop and ask.
- **Scope:** "Công cụ học nhanh" has "Ghi chú & đánh dấu" and "Chứng nhận" only. No AI assistant, no flashcards.

## Phase 0: Local environment

- [ ] **A1: Reporting tables on the local DB** (main session)
  - Run `docs/sql/learning_hub_reporting.sql` once on the local DB with `-v ON_ERROR_STOP=1`.
  - Acceptance: as `hocvien` and `hocvien.tichhop`, `/me/learning/dashboard`, `/me/learning/dashboard/competencies`
    and `/me/competency` answer `CORE-SUCCESS`; the backend log has no `does not exist`.

### Checkpoint A

- [ ] The responses are recorded here. The Sonnet child starts Phase 1.

## Phase 1: App

- [ ] **F1: Dashboard contracts**
  - `learnerEndpoints.dashboard` (`GET /api/v1/me/learning/dashboard`) and `learnerEndpoints.dashboardPrograms`
    (`GET /api/v1/me/learning/dashboard/programs`, `page`, `size` ≤ 100), with no `served: 'mock'`.
  - Schemas follow `LearningAnalytics.Home` and `Group`. Percents are numbers that may be decimals; counts are
    integers; `nextAction` is nullable.
  - Fixtures are captured from the local backend as `hocvien`.
  - Acceptance: the endpoint specs parse the fixtures; `npx nx test contracts` green.
- [ ] **F2: Mock**
  - The in-app mock serves both endpoints from the learning seed: the current cycle per course, `completionRate` =
    completed / total × 100 and `averageProgress` = the mean of the progress, both to two decimals, 0 when empty;
    programmes with at least one of the caller's courses.
  - Acceptance: mock specs for a learner with and without courses; `npx nx test mocks` green.
- [ ] **F3: KPI row and points**
  - A component in `features/learning/learn/components/` renders the four KPIs of plan Decision 7, using the `ui`
    `kpi` molecule and the `ring` atom where they fit.
  - The store reads `dashboard` with its own error and retry; only the completion KPI depends on it.
  - The points figure sits beside the continue card at `lg` and below it under `lg`.
  - `app-progress-counts`, `app-score-figures` and `app-unavailable-note` are no longer used by `/learn`; `/progress`
    is unchanged.
  - Acceptance: specs for the four values, the deltas, a dashboard error (three KPIs still render, the fourth shows
    retry), and no learner without a last score showing a "Đạt" line. The app computes no percent.
- [ ] **F4: Side column**
  - Each "Hạn hoàn thành" row shows the card's `progressPercent` as `{n}%` (`ui.num`), after the due date.
  - "Công cụ học nhanh" below the due list (above "Nhắc hạn"): the two links of plan Decision 4, title over a muted
    line and a `chevron-right` icon of size `sm`, no tile, no AI assistant, no flashcards.
  - Acceptance: specs for the percent and the two links with their `href`s.
- [ ] **F5: Tabs and journey**
  - The five course tabs fit on one line at 1280 px (column widths or tab spacing), and still wrap or scroll
    without overflow at 375 px.
  - "Lộ trình theo chương trình" in the main column after "Biểu đồ năng lực": one row per programme from
    `dashboardPrograms`, name, a `progress` bar of `averageProgress` and "{completed}/{courses} khóa đã xong". The
    section is hidden when the page is empty, and has its own error and retry.
  - Acceptance: specs for the rows, the empty case and the error; no horizontal scroll at 375 px.
- [ ] **F6: Docs and routes**
  - `SPEC-learner-home.md`: the amendments in the plan, and an "Implementation notes (learner-home-refresh)"
    section.
  - The `learn` screen entry declares `requires` for `dashboard` and `dashboardPrograms`.
  - Migration notes for `route-learn` updated if the entry exists for this screen.
  - Acceptance: `npm run check` green.

### Checkpoint B

- [ ] Main-session review of each commit's diff against angular.md §14 and visual-design.md.
- [ ] `npm run check` green.
- [ ] `/learn` in the browser as `hocvien` and `hocvien.tichhop`: the KPI values equal the backend's responses; the
      due percents equal the cards'; the journey equals `/dashboard/programs`; the two quick links open `/saved` and
      `/certificates`.
- [ ] Side by side with the mockup on :4320 at 375, 768 and 1280 px, light and dark; keyboard-only pass.
- [ ] The spec is marked built.
