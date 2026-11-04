# Spec: UX review, Wave 1 (app only)

Plan: [docs/reviews/2026-11-04-ux-review/PLAN.md](docs/reviews/2026-11-04-ux-review/PLAN.md) §4 Wave 1. Review:
[README.md](docs/reviews/2026-11-04-ux-review/README.md). Status: **approved 2026-11-04; planned in `tasks/plan.md` (amendments there).**

Three packages that need no backend change. `question-bank`, the fourth Wave 1 package, has backend work and gets its
own spec and capability map later. `report-filters` and `progress-reports` both change `features/reports`, so they
run in that order. `course-editor-guards` runs on its own track.

| Module id              | Review IDs                     | Area                                   | Size |
| ---------------------- | ------------------------------ | -------------------------------------- | ---- |
| `course-editor-guards` | B12, U13, B6, U18 (editor)     | `features/admin-content/course-editor` | M    |
| `report-filters`       | P3 / U1, U21, CSV reason       | `features/reports`                     | M    |
| `progress-reports`     | P3 / U2 (D2)                   | `features/reports`, `libs/contracts`   | M    |

Decisions (2026-11-04):

- A published revision is shown read-only. Its edit controls are not rendered, and the banner's "Mở bản nháp để sửa"
  is the only way to start editing.
- "Tiếp tục" validates the current step and stays on it when the step has errors. Clicking a step header still moves,
  but a step with errors never shows ✓.
- The report pickers are a component inside `features/reports`, not a new `libs/ui` piece.
- "Tổng quan" shows the learning KPIs first and the exam KPIs below them. A new tab "Tiến độ & hoàn thành"
  (`/reports/progress`) holds the detail. Per D2 it shows groups by course and by unit, the learner list and a CSV
  export, for the same roles as the other report tabs, `giangvien` included.

---

## 1. `course-editor-guards`

### Objective

In the course wizard (`/admin/courses/new`, `/admin/courses/:id/edit`):

- "Tiếp tục" moves on from an empty step 1 and marks it "Đã hoàn thành". Only "Lưu nháp" validates.
- On a published revision the edit controls look clickable but do nothing.

The wizard should stop the user where the problem is, and a published revision should look like what it is.

### Requirements

**Validation per step**

- The store gets a per-step validity model, which replaces the private `invalidSteps` computed in `course-editor.ts`
  (angular.md §5: the store owns state). The step fields are:
  - step 0: `code` (create mode only), `title`, `programId`, `summary`, `objectives`;
  - step 1: `chapters`, including every lesson;
  - step 2: `rewardPoints` and the completion rules;
  - step 3: the publish checklist. It is only checked by "Xuất bản khóa học", as it is today.
- "Tiếp tục" marks the current step's fields as touched. If any of them is invalid, it stays on the step, focuses the
  first invalid control, and shows the existing danger alert "Còn thông tin chưa hợp lệ ở: …". If they are all valid,
  it moves to the next step.
- `ui-stepper` gets `completed` per step. A step is completed only when it has been visited, its fields are valid, and
  it is not the current step. A step that is visited but invalid shows its number, with no ✓ and no "Đã hoàn thành"
  `sr-only` text.
- Clicking a step header moves freely (`linear` stays false). The alert keeps listing the invalid steps as links.
- "Lưu nháp" and "Xuất bản khóa học" keep their current validation and messages.

**Published revision is read-only**

- When `isDraft$()` is false, the edit controls are not rendered. Today they sit disabled inside the
  `<fieldset disabled>`. This covers the controls of these components:
  - `course-outline`: "Sửa", "Thêm bài học", "Thêm chương", delete, move up and down, and the drag handle;
  - `course-info`: the cover upload and remove;
  - `course-rules`: add and remove;
  - the lesson drawer: it cannot open.
- The values stay visible as text or read-only inputs.
- The banner "Đây là bản đang xuất bản…" with "Mở bản nháp để sửa" stays, unchanged.
- The footer of a published revision keeps only "Quay lại" and "Tiếp tục". This already holds, and is now checked.

**Accessibility (U18) and chapter name (U13)**

- Check in the browser that "Tên khóa học" and every `ui-field` in the wizard get their accessible name from the
  label. `ui-field` already sets `for` and `id`. Fix only the controls where the browser shows the placeholder as the
  name, such as a control that is not a direct `uiInput` child.
- Check that the stepper and the CDK steps expose no unnamed `tab` or `tabpanel` role. Name or remove any that do.
- A new chapter's title input (`course-outline__chapter-title`) is visible, labelled "Tên chương {n}", and focused
  right after "Thêm chương". The review saw it disabled on a published revision, which the read-only rule above
  now covers.

### Success criteria

1. On `/admin/courses/new` with step 1 empty, "Tiếp tục" stays on step 1, shows the field errors and the alert, and
   focuses "Tên khóa học". Step 1 never shows ✓ while it is invalid.
2. Fill step 1, then "Tiếp tục": step 2 opens and step 1 shows ✓. Clear the title and click step 1's header: the ✓ goes.
3. On a published course: no "Sửa", "Thêm bài học", "Thêm chương", delete, move or drag control in any step. "Mở
   bản nháp để sửa" works as before.
4. The accessibility tree shows "Tên khóa học" as the title input's name, and no unnamed tab or tabpanel.

### Testing

- Store spec: validity per step; "Tiếp tục" blocks and advances; completed rules (visited, valid, not current).
- `course-editor.spec.ts`: alert and focus on a blocked "Tiếp tục"; ✓ appears and disappears; published mode renders
  no edit control (query each control by its text and its `aria-label`).
- `course-outline.spec.ts`: "Thêm chương" focuses the new chapter's title input, which has its label.
- Browser: create mode and a published course, 1280 and 375px, light and dark. Accessibility tree read with
  `read_page`.

---

## 2. `report-filters`

### Objective

The `/reports/*` filters ask for numeric ids ("ID đơn vị", "ID phòng / nhóm", "ID khóa học", "ID bài kiểm tra") that
users cannot know. "Tình trạng học viên" requires a quiz id. An unknown id silently returns zeros, filters are lost on
reload or share, and "Xuất CSV" is disabled with no reason. Users should pick by name, share a filtered report by URL,
and always know why something is empty or disabled.

### Requirements

**Pickers** (`features/reports/report-screen/components/report-picker`)

- One component built on `@angular/aria` `Combobox` + `Listbox` + `Option`, following the pattern of
  `course-shares/components/org-picker`. It is a text box and a list of matches. Arrow keys move, Enter picks,
  Escape closes, and "Xóa" clears the choice.
- Inputs: `label`, `options` (`{ id, name, meta? }`), `selected`, `busy`, `disabled` with a `disabledReason`,
  `error`. Outputs: `queried` (debounced 300 ms), `picked`. It owns no data.
- Four instances in the filter form, each feeding the next:

  | Picker          | Source                                                                    | Filtered by          | When empty                            |
  | --------------- | ------------------------------------------------------------------------- | -------------------- | ------------------------------------- |
  | Đơn vị          | `GET /api/v1/orgs/tree`, flattened, matched locally on name and code      | —                    | "Toàn bộ phạm vi được cấp"            |
  | Phòng / nhóm    | `GET /api/v1/orgs/{orgId}/teams`                                          | Đơn vị (disabled until one is picked, with the reason "Chọn đơn vị trước") | "Tất cả phòng / nhóm" |
  | Khóa học        | `GET /api/v1/courses?q=` (the list the admin course screen uses)           | Đơn vị when the endpoint accepts it | "Tất cả khóa học"         |
  | Bài kiểm tra    | the course quiz list endpoint used by `/admin/quizzes` (`assessmentV1Endpoints.courseQuizList`) | Khóa học (disabled until one is picked) | "Tất cả bài kiểm tra" |

- Options read "mã · tên" when there is a code, so two courses named "test" can be told apart (U9 in reports).
- Changing a parent clears its children.
- "Tình trạng học viên" needs a quiz. Its alert becomes "Chọn khóa học và bài kiểm tra để xem cả học viên chưa
  thi." The quiz picker is required there and is placed first in the form.
- "Mã cán bộ" stays a text field, since staff codes are known to users.

**Filters in the URL**

- "Áp dụng bộ lọc" writes the applied filters to the query string with `replaceUrl`: `orgId`, `teamId`, `courseId`,
  `quizId`, `from`, `to`, `userId`, `status`, `passed`, `learnerStatus`, `groupBy` and `page`. Empty values are left
  out. The store reads them on load, so a shared URL opens the same report.
- The tab links keep the filters that tab supports.
- An id from the URL is resolved to its name for the picker. If it cannot be resolved (not found, or outside the
  user's scope), the report is not requested and the picker shows "Không tìm thấy đơn vị / khóa học / bài kiểm tra
  này trong phạm vi của bạn." with "Xóa" to clear it.

**Copy and CSV (P3)**

- The page description follows the tab:
  - Tổng quan: "Tiến độ học và kết quả thi theo phạm vi được cấp."
  - Exam tabs: today's sentence.
  - Tiến độ: see module 3.
- When "Xuất CSV" is disabled, it gets a tooltip and an `aria-describedby` text giving the reason:
  - "Chọn một báo cáo chi tiết để xuất CSV." on Tổng quan;
  - "Chọn bài kiểm tra để xuất." on Tình trạng học viên without a quiz;
  - "Không có dữ liệu để xuất." when there are no rows.
- "Loại báo cáo này chưa có API tương ứng…" becomes "Không có báo cáo này. Chọn một báo cáo ở trên." because a user
  can only reach it through a bad URL.
- The tab bar wraps instead of scrolling sideways at about 800px (row 19 of the review).

### Success criteria

1. No "ID …" label and no numeric-only filter input is left on `/reports/*`.
2. Picking Đơn vị, then Phòng, Khóa học and Bài kiểm tra narrows each list. Changing Đơn vị clears the rest.
3. "Tình trạng học viên" works from pickers alone.
4. After applying filters, copy the URL into a new tab: the same report and the same filter labels appear.
   `?courseId=9999` shows the not-found message and makes no report request.
5. Disabled "Xuất CSV" always says why.

### Testing

- `report-picker.spec.ts`: keyboard navigation, picking, clearing, disabled reason, the debounce (fake timers).
- Store spec: filters ↔ query params round trip; children cleared on a parent change; unresolved id → no report
  request plus the message.
- `report-screen` spec: the CSV reasons, the "Tình trạng học viên" flow with pickers.
- Browser (`lms-local-backend`), as `super.admin` and `baocao`, at 1280, about 800 and 375px, light and dark.

---

## 3. `progress-reports`

### Objective

Reports cover only exams, so the `baocao` role sees zeros although learning progress data exists. The backend already
serves it (`/api/v1/reports/learning/summary`, `/groups`, `/enrollments`, `/enrollments/export`). The app adds the
contracts and the screens.

### Requirements

**Contracts** (`libs/contracts/src/lib/reports/learning-reports.*`)

- zod schemas taken from the backend's `LearningAnalytics`:
  - `Counts`: enrollments, learners, courses, assigned, mandatory, completed, inProgress, notStarted, overdue,
    averageProgress, completionRate;
  - `Summary` (`dataAsOf`, `timeZone`, `counts`);
  - `Group` (id, name, the same counts, averageProgress, completionRate);
  - `EnrollmentRow` (`enrollment` plus fullName, orgName, teamName).
- Endpoints: `summary`, `groups` (`groupBy`: `course | org`, plus the shared filter, paged), `enrollments` (filter,
  paged, sort `id | progressPercent | dueAt | lastAccessAt | enrolledAt`), `exportEnrollments` (CSV).
- Filter schema `LearningReportFilter`: q, userId, orgId, teamId, courseId, programId, fieldId, status, overdue, from,
  to.
- Fixtures are captured from the local backend (`contracts-and-mocks.md`). The in-app mock API answers the four
  endpoints from the seeded data, so `mockBackend` works.

**Tổng quan** (`/reports`)

- First section "Tiến độ học": a KPI row (label over value, no cards) with
  - "Lượt học",
  - "Học viên",
  - "Hoàn thành" (completed),
  - "Đang học" (inProgress),
  - "Chưa bắt đầu" (notStarted),
  - "Quá hạn" (overdue, in the danger tone only when it is above 0),
  - "Tỷ lệ hoàn thành" (%),
  - "Tiến độ trung bình" (%).
- Under the KPIs, one muted line: "Số liệu tính đến {dataAsOf, dd/MM/yyyy HH:mm} ({timeZone})."
- Second section "Kết quả thi": today's exam KPIs, chart and tables, unchanged.
- Each section loads and fails on its own: one `ui-error-state` per section, and the other section stays visible.

**Tab "Tiến độ & hoàn thành"** (`/reports/progress`, first in the tab bar after Tổng quan)

- The filters are Đơn vị, Phòng / nhóm and Khóa học (the module 2 pickers), plus:
  - "Trạng thái": Tất cả, Chưa bắt đầu, Đang học, Hoàn thành;
  - "Chỉ quá hạn" (checkbox);
  - "Ghi danh từ ngày" / "Đến trước ngày".
  All filters live in the URL, as in module 2.
- A segmented control "Theo khóa học / Theo đơn vị / Theo học viên":
  - **Theo khóa học / Theo đơn vị** (`/groups?groupBy=course|org`): columns Tên, Lượt học, Học viên, Hoàn thành,
    Đang học, Chưa bắt đầu, Quá hạn, Tỷ lệ hoàn thành, Tiến độ TB. Clicking a row sets the matching filter and
    switches to "Theo học viên".
  - **Theo học viên** (`/enrollments`): columns Mã cán bộ, Học viên, Đơn vị, Khóa học (mã · tên), Tiến độ (%),
    Trạng thái, Hạn, Quá hạn, Học gần nhất. It is sortable on the backend's sort keys. Quá hạn is one `uiBadge`
    with `dot` in the danger tone, and it is the only coloured badge on the row.
- "Xuất CSV" calls `exportEnrollments` with the current filters and sort, saved as `bao-cao-tien-do.csv`. If the
  backend rejects more than 10,000 rows, its message is shown in a toast.
- Page description: "Tiến độ học theo phạm vi được cấp. Đơn vị và nhóm lấy theo thời điểm ghi danh."
- Empty: "Không có lượt học phù hợp với bộ lọc."
- Access: the same function and roles as the existing report routes. Scope is enforced by the server.

### Success criteria

1. As `baocao`, `/reports` shows non-zero learning KPIs on the demo data, and the exam section is unchanged.
2. `/reports/progress` groups by course and by unit. A row click drills into learners. Sorting and paging go to the
   server.
3. The CSV downloads with the current filters. Reloading the page keeps the filters and the view (`view=course|org|
   learners` in the URL).
4. With `mockBackend: true` the same screens work from the seed.

### Testing

- Contracts: schema specs against the captured fixtures.
- Store spec: request building per view, drill-down, URL round trip, export call.
- Screen spec: KPI rendering and the danger tone only when overdue is above 0; section-level errors; the empty
  state.
- Browser (`lms-local-backend`) as `baocao`, `quantri.ban` and `giangvien`, at 1280 and 375px (the table switches
  to its card layout), light and dark.

---

## Commands

```bash
nvm use
```

```bash
npx nx test lms
```

```bash
npx nx test contracts
```

```bash
npm run check
```

Browser: `preview_start` with `lms-local-backend`. The backend runs on :8019 from `feat/course-publish-targets` (D0).

## Project structure (expected)

```text
apps/lms/src/app/features/admin-content/course-editor/
  course-editor.{html,ts,spec.ts}, data-access/course-editor.store.ts (+ spec)
  components/course-outline|course-info|course-rules/*            read-only rendering
apps/lms/src/app/features/reports/report-screen/
  report-screen.{html,ts,scss}, data-access/report-screen.store.ts (+ spec)
  components/report-picker/*                                     new
  components/progress-report/* (or a section of report-screen)   new
libs/contracts/src/lib/reports/learning-reports.{schema,endpoints,captured}.ts (+ spec)
apps/lms/src/app/core/mock-api/… (or the project's mock folder)  learning report handlers
apps/lms/src/app/core/routing/screens.ts                         only if a route is needed beyond reports/:dim
```

## Code style

Follow the surrounding code. State and commands live in the store and components render selectors (angular.md §5).
Use Signal Forms with zod, `EndpointClient` with endpoint schemas, tokens through the `ui` module, English code and
Vietnamese copy.

## Boundaries

- **Always:** test first; one commit per task with the review ID in the message; `npm run check` green; angular.md
  §14 and the visual-design.md checklist at 1280 and 375px, light and dark; re-test each review item the way the README
  reproduced it.
- **Ask first:** any backend change, including a missing filter or field found during the work; a new `libs/ui`
  component; changing the report routes' access.
- **Never:** numeric id inputs for entities a user cannot see; coloured KPI cards or a status tone used as
  decoration; client-side scoring or progress math (the server's numbers are shown as they are).

## Success criteria (whole wave)

1. Each module's criteria pass in the browser against the local backend, with screenshots.
2. `npm run check` is green.
3. B12, B6, U13, U18 (editor), P3/U1, U21 and P3/U2 are re-tested as the review reproduced them and now pass.

## Open questions

None blocking. Two things are checked during planning:

- whether `GET /api/v1/courses` accepts `orgId`;
- whether `/enrollments` returns the course code (it does: `courseCode`).
