# Implementation Plan: UX review Wave 1 (app only)

Spec: [SPEC-ux-wave1.md](../SPEC-ux-wave1.md) (approved 2026-11-04; amended below). Tasks: [todo.md](todo.md).
Review plan: [PLAN.md](../docs/reviews/2026-11-04-ux-review/PLAN.md). The Wave 0 plan is in git history (merged in
PR #63).

## Overview

Three modules:

- `course-editor-guards`: per-step validation, honest ✓ marks, a read-only published revision, and the a11y checks.
- `report-filters`: report pickers instead of numeric ids, filters in the URL, and a reason for every disabled state.
- `progress-reports`: learning-progress contracts and mock, KPIs on Tổng quan, and a "Tiến độ & hoàn thành" tab.

## Findings from the codebase (answers to the spec's open questions)

- **Course picker source:** the admin course list is `courseEndpoints.instructorCourses`
  (`GET /api/v1/instructor/courses`, `CourseListQuerySchema`: q, fieldId, programId, moduleId, …). It has **no
  `orgId`**. The Khóa học picker therefore searches by `q` alone and does not narrow by Đơn vị. Narrowing it would be a
  backend change, which the spec says to ask about first, so this plan does not include it. The report still filters
  by both values.
- **Quiz picker source:** `assessmentV1Endpoints.courseQuizList` (`/api/v1/courses/{courseId}/quizzes`), already
  used by `/admin/quizzes`.
- **Org sources:** `organization.endpoints.ts`: `/api/v1/orgs/tree` and `/api/v1/orgs/{orgId}/teams`.
- **Course codes in the learner list:** `/enrollments` returns `courseCode`.
- **Report routes:** `reports` and `reports/:dim` already load `ReportScreen`. `dimension$` parses `:dim` with
  `AssessmentReportTypeSchema`, so `progress` needs its own branch: a `ReportView` union of `'overview' | 'progress'
| AssessmentReportType`. No new route is needed.
- **Pattern to copy:** `course-shares/components/org-picker`, an `@angular/aria` `Combobox`, `ComboboxPopup` and
  `ComboboxWidget` over a `Listbox` with `focusMode="activedescendant"`.
- **Mocks:** `libs/mocks/src/lib/reports` already holds the assessment report mocks. The learning report handlers go
  beside them.
- **Editor:** `invalidSteps` is a component `computed` in `course-editor.ts`, and `goToStep` clamps without
  validating. The edit controls sit inside `<fieldset [disabled]="!store.isDraft$()">`. `ui-field` already wires
  `for` and `id`, so U18 on the title is most likely a stale finding. Task A4 checks it in the browser.

## Architecture decisions

1. **The editor store owns step validity.** The store gets a `StepFields` map and the commands `continue()` and
   `visit(step)`, plus `visited$`. The form tree stays in the component (Signal Forms). The component hands the store
   a validity reader per step once, so the store can decide without owning the form.
2. **Read-only via `isDraft$`, not the fieldset.** Each subcomponent takes an `editable` input, and the edit controls
   are wrapped in `@if (editable())`. The fieldset stays as a second guard.
3. **`ReportView` union in the report store.** Overview, progress and the four exam types each have their own
   request builder. URL parsing and writing is one pair of pure functions, `filtersFromQuery` and `queryFromFilters`,
   tested on their own.
4. **One picker component, four instances.** The parent-child rules live in the store (`pickOrg`, `pickTeam`,
   `pickCourse`, `pickQuiz` clear the children). The picker only reports what was typed and what was picked.
5. **Name resolution for URL ids.** On load, each id in the URL is resolved through its picker source:
   - the org comes from the tree;
   - the team comes from its org's teams;
   - the course comes from `getCourse`, falling back to `instructorCourses?q=` if access is refused;
   - the quiz comes from the course's quiz list.
     If an id is not resolved, the store sets `unresolved$` and no report request is made.

## Dependency graph

```text
Track A (editor):   A1 step validity + Tiếp tục ── A2 ✓ rule ── A3 read-only published ── A4 a11y checks
Track B (reports):  B1 picker ── B2 URL filters ── B3 wire pickers ── B4 copy + CSV reasons
Track C (reports):  C1 contracts + mock ── C2 Tổng quan KPIs ── C3 progress groups ── C4 progress learners + CSV
                    (C2–C4 after B2/B3: they reuse the URL helpers and the pickers)
```

Track A is independent of B and C. B and C both edit `report-screen.*`, so C starts after B3. C1 only touches
`libs/contracts` and `libs/mocks`, so it can run any time.

Default order: A1 → A4, then B1 → B4, then C1 → C4.

## Task list

### Phase A: `course-editor-guards`

- [ ] A1: Store-owned step validity; "Tiếp tục" blocks with errors and focuses the first invalid control
- [ ] A2: ✓ only for visited, valid, non-current steps
- [ ] A3: Published revision renders no edit controls
- [ ] A4: A11y: chapter title label and focus, title name, no unnamed tab or tabpanel

### Checkpoint A

- [ ] `npx nx test lms` green
- [ ] Browser: create mode, empty step 1, Tiếp tục; a published course; 1280 and 375px, light and dark; `read_page`
      accessibility tree

### Phase B: `report-filters`

- [ ] B1: `report-picker` component
- [ ] B2: Filters in the URL (pure helpers + store), tab links keep the filters
- [ ] B3: Four pickers wired with parent-child clearing; "Tình trạng học viên" by pickers; unresolved ids
- [ ] B4: Per-tab descriptions, CSV reasons, the bad-URL copy, wrapping tab bar

### Checkpoint B

- [ ] `npx nx test lms` green
- [ ] Browser as `super.admin` and `baocao`: pickers, URL share, `?courseId=9999`, CSV reasons at 1280, ~800 and
      375px

### Phase C: `progress-reports`

- [ ] C1: Learning report contracts, captured fixtures, mock handlers
- [ ] C2: Tổng quan "Tiến độ học" KPIs above "Kết quả thi", with an error per section
- [ ] C3: `/reports/progress` filters and the "Theo khóa học / Theo đơn vị" views with drill-down
- [ ] C4: "Theo học viên" view, sorting and paging on the server, CSV export

### Checkpoint C (complete)

- [ ] `npm run check` green
- [ ] Browser as `baocao`, `quantri.ban` and `giangvien` (local backend), and with `mockBackend`; 1280 and 375px,
      light and dark; screenshots
- [ ] angular.md §14 and visual-design.md checklists; B12, B6, U13, U18, P3/U1, U21 and U2 re-tested
- [ ] `SPEC-ux-wave1.md` marked built; Wave 1 app-only packages marked done in `PLAN.md`

## Risks and mitigations

| Risk                                                                                             | Impact | Mitigation                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| The step validity reader couples the store to the form tree                                      | Med    | The component passes plain `() => boolean` readers per step; the store specs use fakes                            |
| `focus first invalid` misses controls inside child components                                    | Med    | Use the field's `id` from `ui-field` (query `[aria-invalid="true"]` in the step's panel) and cover it in the spec |
| The read-only change misses a control (the drawer opened from a keyboard shortcut, drag handles) | Med    | The spec queries every control by text and `aria-label` in published mode; check the browser at Checkpoint A      |
| Combobox behaviour differs from `org-picker` under `@angular/aria` 22.2                          | Low    | Copy the working pattern; the picker spec covers the keys                                                         |
| The org tree is large for a local filter                                                         | Low    | Flatten once per screen and keep it memoised; the server tree is already scoped                                   |
| A URL id outside the user's scope leaks a name                                                   | Low    | Resolve only through scoped endpoints; anything that cannot be resolved shows the not-found message               |
| Captured fixtures need the local backend running                                                 | Med    | Run the `backend` launch config. If it is not reachable, stop and report rather than hand-writing fixtures        |
| The mobile card layout of `ui-data-table` hides the drill-down click                             | Low    | The row action is a link in the Tên cell, not a row click only                                                    |

## Open questions

None. The course picker is not narrowed by unit (no `orgId` on the course list). It is recorded here and in the spec
amendments.
