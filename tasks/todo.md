# Tasks: UX review Wave 1 (app only)

Spec: [SPEC-ux-wave1.md](../SPEC-ux-wave1.md) · Plan: [plan.md](plan.md).
The Wave 0 checklist is in git history (merged in PR #63).

Run `nvm use` first. Focused tests: `npx nx test lms`, `npx nx test contracts`, `npx nx test mocks`. Whole gate:
`npm run check`. One commit per task: the message names the module and review ID and ends with the attribution line.

## A1: Store-owned step validity; "Tiếp tục" blocks with errors (B12)

**Acceptance criteria:**

- [x] The editor store decides step validity from the readers the component registers for steps 0, 1 and 2. The
      component's `invalidSteps` computed is replaced by a store selector.
- [x] `continue()` marks the current step's fields as touched. If they are invalid, the step stays, the danger alert
      shows, and the first `[aria-invalid="true"]` control in the step gets focus. If they are valid, the next step
      opens.
- [x] "Lưu nháp" and "Xuất bản khóa học" behave as today.

**Verification:** `npx nx test lms` (store spec with fake readers; `course-editor.spec.ts` checks blocked and allowed
continue, the alert and the focus)

**Dependencies:** none · **Files:** `course-editor.store.ts` (+ spec), `course-editor.{ts,html,spec.ts}` · **Size:** M

## A2: ✓ only for visited, valid, non-current steps (B12, U13)

**Acceptance criteria:**

- [x] The store records `visited$`. Each `steps` item passed to `ui-stepper` has
      `completed = visited && valid && !current`.
- [x] Clicking a header still moves. An invalid visited step shows its number, with no ✓ and no "Đã hoàn thành".

**Verification:** `npx nx test lms` (✓ appears after a valid continue and goes away when the title is cleared)

**Dependencies:** A1 · **Files:** `course-editor.store.ts` (+ spec), `course-editor.{ts,html,spec.ts}` · **Size:** S

## A3: Published revision renders no edit controls (B6)

**Acceptance criteria:**

- [x] `course-outline`, `course-info` and `course-rules` take `editable` (from `isDraft$`). Their edit, add, delete,
      move, drag and upload controls are not rendered when it is false, and the lesson drawer cannot open. The values
      stay visible.
- [x] The banner and its "Mở bản nháp để sửa" are unchanged. The footer of a published revision shows only "Quay lại"
      and "Tiếp tục".

**Verification:** `npx nx test lms` (published mode: no control with the texts "Sửa", "Thêm bài học", "Thêm chương",
and none with a delete, move or drag `aria-label`; draft mode unchanged)

**Dependencies:** none (after A2 by file order) · **Files:** `components/course-outline/*`,
`components/course-info/*`, `components/course-rules/*`, `course-editor.html` · **Size:** M

## A4: A11y: chapter title label and focus, title name, no unnamed tab or tabpanel (U13, U18)

**Acceptance criteria:**

- [ ] Each chapter title input is labelled "Tên chương {n}". "Thêm chương" focuses the new one.
- [ ] `read_page` shows "Tên khóa học" as the title input's name, and every wizard `ui-field` named by its label. Any
      control that fails is fixed.
- [ ] No unnamed `tab` or `tabpanel` role is left from the stepper or the CDK steps.

**Verification:** `npx nx test lms` (`course-outline.spec.ts` checks the label and focus; a stepper spec checks the
roles if changed); browser `read_page`

**Dependencies:** A3 · **Files:** `components/course-outline/*`, and if needed `libs/ui/.../stepper/*` or
`course-info.html` · **Size:** S

## Checkpoint A

- [ ] `npx nx test lms` green
- [ ] Browser: `/admin/courses/new` with an empty step 1 and "Tiếp tục"; a published course in every step; 1280 and
      375px, light and dark; screenshots and `read_page` notes

## B1: `report-picker` component (U1)

**Acceptance criteria:**

- [ ] `features/reports/report-screen/components/report-picker` follows the `org-picker` pattern.
- [ ] Inputs: `label`, `options {id,name,meta?}`, `selected`, `busy`, `disabled`, `disabledReason`, `error`,
      `required`, `emptyLabel`. Outputs: `queried` (300 ms debounce), `picked`.
- [ ] Options read "meta · name" when `meta` is set. "Xóa" clears. The disabled reason is the field hint.

**Verification:** `npx nx test lms` (keys, pick, clear, disabled reason, debounce with fake timers)

**Dependencies:** none · **Files:** `components/report-picker/*` (new) · **Size:** S

## B2: Filters in the URL; tab links keep the filters (U21)

**Acceptance criteria:**

- [ ] Pure `filtersFromQuery` and `queryFromFilters` cover orgId, teamId, courseId, quizId, from, to, userId,
      status, passed, learnerStatus, groupBy and page. Empty values are dropped and bad values are ignored.
- [ ] "Áp dụng bộ lọc" navigates with `replaceUrl`. The store's filters come from the URL. Tab links carry the
      filters each tab supports.

**Verification:** `npx nx test lms` (helper round trip; store reads the URL; tab link query params)

**Dependencies:** none · **Files:** `report-screen/data-access/report-query.ts` (new, + spec),
`report-screen.store.ts` (+ spec), `report-screen.{ts,html}` · **Size:** M

## B3: Four pickers wired; "Tình trạng học viên" by pickers; unresolved ids (P3/U1, U21)

**Acceptance criteria:**

- [ ] Đơn vị (flattened `orgs/tree`, matched locally), Phòng / nhóm (`orgs/{orgId}/teams`, disabled with "Chọn đơn
      vị trước"), Khóa học (`instructorCourses?q=`, "mã · tên"), Bài kiểm tra (`courseQuizList`, disabled with
      "Chọn khóa học trước").
- [ ] Changing a parent clears its children.
- [ ] No "ID …" inputs are left. On "Tình trạng học viên" the quiz picker is required and comes first, and the alert
      reads "Chọn khóa học và bài kiểm tra để xem cả học viên chưa thi."
- [ ] URL ids are resolved to names. An id that cannot be resolved sets the picker error "Không tìm thấy … trong
      phạm vi của bạn." and blocks the report request.

**Verification:** `npx nx test lms` (store: clearing, resolution, blocked request; screen: learners flow)

**Dependencies:** B1, B2 · **Files:** `report-screen.store.ts` (+ spec), `report-screen.{ts,html,scss}`,
`report-screen.spec.ts` · **Size:** M

## B4: Per-tab descriptions, CSV reasons, bad-URL copy, wrapping tab bar (P3)

**Acceptance criteria:**

- [ ] The description follows the view. The overview description is "Tiến độ học và kết quả thi theo phạm vi được
      cấp."
- [ ] A disabled "Xuất CSV" has a tooltip and an `aria-describedby` text. The three reasons are the ones in the spec.
- [ ] The unsupported copy becomes "Không có báo cáo này. Chọn một báo cáo ở trên." The tab bar wraps at about
      800px.

**Verification:** `npx nx test lms`

**Dependencies:** B3 · **Files:** `report-screen.{html,scss,ts,spec.ts}`, `report-screen.store.ts` · **Size:** S

## Checkpoint B

- [ ] `npx nx test lms` green
- [ ] Browser (`lms-local-backend`) as `super.admin` and `baocao`: the picker chain, sharing the URL in a new tab,
      `?courseId=9999`, the CSV reasons, at 1280, ~800 and 375px, light and dark

## C1: Learning report contracts, captured fixtures, mock handlers (U2)

**Acceptance criteria:**

- [ ] `libs/contracts/src/lib/reports/learning-reports.{schema,endpoints}.ts` hold `Counts`, `Summary`, `Group`,
      `Enrollment`, `EnrollmentRow`, `LearningReportFilter`, and the endpoints `summary`, `groups`, `enrollments` and
      `exportEnrollments`, all exported from the index.
- [ ] `learning-reports.captured.ts` is captured from the local backend (`contracts-and-mocks.md`), and the schemas
      parse it.
- [ ] `libs/mocks/src/lib/reports` answers the four endpoints from the seed. Scope matches the other report mocks.

**Verification:** `npx nx test contracts`, `npx nx test mocks`

**Dependencies:** none · **Files:** `libs/contracts/src/lib/reports/learning-reports.*` (new, + spec), the index,
`libs/mocks/src/lib/reports/*` · **Size:** M

## C2: Tổng quan "Tiến độ học" KPIs above "Kết quả thi" (U2)

**Acceptance criteria:**

- [ ] The overview shows "Tiến độ học" first: the KPI row (label over value, no cards) for Lượt học, Học viên, Hoàn
      thành, Đang học, Chưa bắt đầu, Quá hạn (danger tone only when above 0), Tỷ lệ hoàn thành and Tiến độ trung
      bình. Under it, the muted "Số liệu tính đến … (…)" line.
- [ ] "Kết quả thi" is unchanged below. Each section has its own loading, error (`ui-error-state` with retry) and
      empty state.

**Verification:** `npx nx test lms` (rendering, overdue tone, one section failing while the other shows)

**Dependencies:** C1, B4 · **Files:** `report-screen.store.ts` (+ spec), `report-screen.{html,scss,spec.ts}` ·
**Size:** S

## C3: `/reports/progress` filters and the course / unit views with drill-down (U2)

**Acceptance criteria:**

- [ ] `progress` is a view of the report store. The tab "Tiến độ & hoàn thành" is listed right after Tổng quan. The
      description reads "Tiến độ học theo phạm vi được cấp. Đơn vị và nhóm lấy theo thời điểm ghi danh."
- [ ] Filters: Đơn vị, Phòng / nhóm and Khóa học (the pickers), Trạng thái, "Chỉ quá hạn", and the enrolment date
      range. They are kept in the URL.
- [ ] A segmented "Theo khóa học / Theo đơn vị / Theo học viên" (`view` in the URL). The course and unit views call
      `/groups` with the spec's columns. The Tên cell links to the learner view with that filter set.

**Verification:** `npx nx test lms` (request per view, drill-down, URL round trip)

**Dependencies:** C2 · **Files:** `report-screen.store.ts` (+ spec), `report-screen.{html,ts,scss,spec.ts}` (or
`components/progress-report/*` if the template grows past readability) · **Size:** M

## C4: "Theo học viên" view, server sort and paging, CSV export (U2)

**Acceptance criteria:**

- [ ] `/enrollments` shows the spec's columns, sorts on the backend's keys, and pages on the server. Quá hạn is a
      single danger `uiBadge` with `dot`.
- [ ] "Xuất CSV" calls `exportEnrollments` with the current filters and sort and saves `bao-cao-tien-do.csv`. A
      server error (for example over 10,000 rows) shows its message in a toast.
- [ ] Empty: "Không có lượt học phù hợp với bộ lọc."

**Verification:** `npx nx test lms` (columns, sort and page requests, export call, error toast)

**Dependencies:** C3 · **Files:** `report-screen.store.ts` (+ spec), `report-screen.{html,spec.ts}` (or the
component from C3) · **Size:** M

## Checkpoint C (complete)

- [ ] `npm run check` green
- [ ] Browser: `lms-local-backend` as `baocao`, `quantri.ban` and `giangvien`, and `lms` with `mockBackend`; 1280 and
      375px, light and dark; screenshots in the PR
- [ ] angular.md §14 and visual-design.md checklists reported
- [ ] B12, B6, U13, U18, P3/U1, U21 and U2 re-tested as the review reproduced them
- [ ] `SPEC-ux-wave1.md` status "built" with the amendments; the three packages marked done in `PLAN.md`
