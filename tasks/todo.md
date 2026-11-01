# Tasks: `learner-competency`

Spec: [SPEC-learner-competency.md](../SPEC-learner-competency.md) · Plan: [plan.md](plan.md).
The previous `catalog-discovery` checklist, with its success criteria and how each was checked, is in git history
at `2a298e0`.

- **Repository:** this one only. No backend change.
- **Branch:** `feat/learner-mockup-gap`. Nothing is pushed.
- **Local stack:**
  - the backend on :8019 is the main session's background task, running from `~/my-projects/corebanking-academy`;
    message the main session if it needs a restart, and do not run `mvn` in that checkout;
  - the app runs on :4200, against `localhost:8019`;
  - accounts: `hocvien` and `hocvien.tichhop` as learners;
  - passwords come only from `LOCAL_DEMO_PASSWORD` in the backend's `.env.local`, never printed;
  - in the browser, sign in with the one-shot token method, never by typing the password.

## Phase 1: Contract and the shared piece

- [x] **T1: `percent` nullable, with a fixture captured from the local backend**
  - Acceptance:
    - `MyCompetencySchema.percent` is `z.number().nullable()`, with a comment saying the server sends null when
      `maxScore` is 0.
    - `learner-quiz.captured.ts` gains a `myCompetency` response captured from `GET /api/v1/me/competency` as
      `hocvien`.
    - The mock's `COMPETENCIES` seed gains one row with `percent: null` and `totalQuestions: 0`.
  - Verify: a contracts spec parses the captured response and a row with `percent: null`, and refuses a row
    without `name`. `npx nx test contracts` and `npx nx test mocks` are green.
  - Files: `libs/contracts/src/lib/assessment/learner-quiz.schema.ts`, `learner-quiz.captured.ts`, its spec,
    `libs/mocks/src/lib/assessment/learner-quiz.mock.ts`.
  - Size: S. Depends on: none.

- [x] **T2: `toRadarData`, `app-competency-view`, and `fmtPct` in `ui-radar-chart`**
  - Acceptance:
    - `shared/learning/competency/competency-data.ts`:
      - `toRadarData(rows)` maps each row to `{ name, value: percent }`, keeping null;
      - `withData(rows)` is the rows with a non-null `percent`.

      The app computes no percent.

    - `app-competency-view` takes `rows` (required) and `size` (`'compact' | 'large'`). It shows:
      - with three or more rows with data: `ui-radar-chart` with `seriesLabel` "Tỷ lệ đúng trên mọi lượt thi đã
        chấm";
      - with one or two: a short list of those rows (name, "x/y câu đúng", the percent through `fmtPct`);
      - with none: `ui-empty variant="inline"`, title "Chưa có dữ liệu năng lực", description "Biểu đồ sẽ có sau
        khi bạn làm bài kiểm tra."
    - It shows only the competencies the server returned.
    - `ui-radar-chart` shows each value through `fmtPct` in its labels, tooltips and data table. Null stays
      "Chưa có dữ liệu".
    - Tokens only, no status colours. visual-design.md applies.

  - Verify:
    - The `competency-data` spec covers null kept, and a row with no data left out of `withData`.
    - The `app-competency-view` spec covers 0, 2 and 3 rows with data.
    - The `ui` radar spec covers the "14,29%" format and the null label.
    - The report screen specs stay green. `npx nx test ui` and `npx nx test lms` are green.
  - Files: `apps/lms/src/app/shared/learning/competency/*`, `libs/ui/src/lib/organisms/charts/radar-chart.*`.
  - Size: M. Depends on: T1.

### Checkpoint A

- [ ] `npm run check` green.
- [ ] Stop for the main session's review of the T1–T2 diff.

## Phase 2: The two pages

- [x] **T3: "Biểu đồ năng lực" card on the learn page**
  - Acceptance:
    - `LearnStore` loads `learnerQuizEndpoints.myCompetency` (no `courseId`) with `serverData`. It exposes
      `competency$`, `isCompetencyLoading$` and `competencyError$`, and gets `retryCompetency()`.
    - The card sits in the main column under "Khóa học của tôi", as in the mockup. Its heading is "Biểu đồ năng
      lực", with a "Chi tiết" text link to `/progress`.
    - The card shows a skeleton while loading, `ui-error-state` with retry on failure (the rest of the page stays),
      and `app-competency-view size="compact"` otherwise.
  - Verify: store spec (rows reach `competency$`; an error does not touch the summary). Page spec (heading, link,
    the three states). `npx nx test lms` is green.
  - Files: `features/learning/learn/data-access/learn.store.ts` (+ spec), `learn.html` / `.ts` / `.scss`,
    `learn.spec.ts`.
  - Size: S. Depends on: Checkpoint A.

- [x] **T4: "Năng lực theo nhóm kiến thức" card on the progress page**
  - Acceptance:
    - `ProgressStore` loads `myCompetency` the same way, with the same three states.
    - The card is titled "Năng lực theo nhóm kiến thức" and uses `app-competency-view size="large"`.
    - It sits where the mockup's `tools.js` puts it: after the KPIs and before the course table, unless the page's
      current layout makes another spot clearer. The commit message says which.
    - No course select (plan amendment 4).
  - Verify: store and page specs for the three states. `npx nx test lms` is green.
  - Files: `features/achievements/progress/data-access/progress.store.ts`, `progress.html` / `.scss`,
    `progress.spec.ts`.
  - Size: S. Depends on: Checkpoint A.

- [x] **T5: The unavailable note drops competency**
  - Acceptance:
    - `app-unavailable-note` shows when `activity` or `assessment` is unavailable. It ignores `competency`.
    - It reads "Giờ học và điểm kiểm tra sẽ hiển thị khi hệ thống có dữ liệu."
  - Verify: `unavailable-note.spec.ts` covers competency-only unavailable (no note) and the new sentence.
  - Files: `apps/lms/src/app/shared/learning/unavailable-note/*`.
  - Size: XS. Depends on: none.

- [ ] **T6: End-to-end check against the spec**
  - Acceptance: the success criteria below are written here, each with how it was checked.
  - Verify, on the local stack:
    - As `hocvien`:
      - `/learn` and `/progress` each make one `GET /api/v1/me/competency`;
      - the three axes, values and the data table match `curl` of the same endpoint;
      - check at 1280 px light and 375 px dark, with no horizontal scroll and no label overlap at 375 px.
    - Find a learner with no graded attempts with `curl`. If one exists, their `/learn` shows the empty state. If
      none exists, say so and point to the specs and `mockBackend: true`.
    - Open the admin report's competency radar once as `baocao` and check the percent format.
    - `npm run check` is green.
  - Files: `tasks/todo.md`, `SPEC-learner-competency.md` (status, amendments).
  - Size: S. Depends on: T3, T4, T5.

### Checkpoint B

- [ ] Success criteria 1–4 recorded:
  1. The learn page and the progress page each show the radar from `/api/v1/me/competency` on the local
     backend, and the values match the API response.
  2. The empty state shows when no competency has data; with one or two, the short list shows.
  3. (Dropped by amendment 4: no course select.)
  4. `npm run check` is green, and the visual-design checklist passes for both cards.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan `learner-scores`.
