# Spec: `learner-progress` (Phase 2)

Map: [SPEC.md](SPEC.md). Read `docs/conventions/angular.md`, `contracts-and-mocks.md`, `visual-design.md` and
`docs/migration/mockup-to-angular.md` first. Backend reference: `corebanking-academy/docs/api/LEARNING.md` →
"Summary, CSV và thông tin gửi FE".

## Objective

The learner's "Tiến độ của tôi" page: how many of their courses are done, in progress, not started and overdue,
a table of every course with the server's progress and dates, and a CSV of that table. Everything shown is the
server's; the page invents no hours, scores, streaks or competency numbers the backend does not have.

Mockup: `tools.js` page `progress` (README row F.8). Route `progress` (menu group `LEARNING_PROGRESS`). Migration
entry: `route-progress`. Feature folder `features/achievements/progress/` (migration feature mapping).

## Endpoints

| Key (registry)                     | Endpoint                                   | Change                                                                          |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `learnerEndpoints.progressSummary` | `GET /api/v1/me/learning/progress/summary` | **new**: `LearningProgressOverviewSchema`                                       |
| `learnerEndpoints.exportProgress`  | `GET /api/v1/me/learning/progress/export`  | **new**: `responseType: 'blob'`, query `ProgressExportQuerySchema`              |
| `learnerEndpoints.myCourses`       | `GET /api/v1/me/learning/courses`          | query becomes `MyCoursesQuerySchema` (adds `overdue`); card fields from Phase 1 |

```ts
export const AvailabilitySchema = z.object({ availability: z.string() });

/** LearningProgressOverview: counts over the caller's current cycles, independent of any table filter. */
export const LearningProgressOverviewSchema = z.object({
  serverTime: BackendDateTimeSchema,
  timeZone: z.string(),
  counts: z.object({
    total: z.number().int(),
    completed: z.number().int(),
    inProgress: z.number().int(),
    notStarted: z.number().int(),
    overdue: z.number().int(),
  }),
  activity: AvailabilitySchema,
  assessment: AvailabilitySchema,
  competency: AvailabilitySchema,
});

export const LearningStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
export const MyCoursesQuerySchema = CourseListQuerySchema.extend({
  learningStatus: LearningStatusSchema.optional(),
  overdue: z.boolean().optional(),
});
/** The same filters and sort as the table, no paging; at most 10,000 rows. */
export const ProgressExportQuerySchema = MyCoursesQuerySchema.omit({ page: true, size: true });
```

`catalog` keeps `CourseListQuerySchema`; only `myCourses` and the export take `overdue`. Sort fields the backend
allows: `id`, `title`, `updateTime`, `dueAt`, `progressPercent`, `startedAt`, `lastAccessAt`, `completedAt`.

### A refusal on a file endpoint

The export answers a CSV on success and an `ERROR` envelope (HTTP 200, `application/json`) on refusal, for example
`LEARNING-EXPORT_TOO_LARGE`. Today a `blob` endpoint skips `envelopeInterceptor`, so that refusal would be saved as
a `.csv` file. Change: for a `blob` endpoint, `envelopeInterceptor` reads a response whose `Content-Type` is
`application/json` as an envelope (an `ApiError` on `ERROR`), and passes any other blob through. This also ends the
"Known limit" in `contracts-and-mocks.md` (an HTTP error on a blob endpoint now shows the server's message when it
sent an envelope), which is updated in the same commit. `envelope.interceptor.spec.ts` covers a CSV passing through,
a JSON `ERROR` blob becoming an `ApiError`, and a 403 JSON blob keeping its status.

## Screen (`progress`)

```text
apps/lms/src/app/features/achievements/progress/
├── progress.ts|html|scss|spec.ts
└── data-access/progress.store.ts (+ spec)
```

Store (`ProgressStore`):

- State: `q`, `learningStatus` (`'all'` or a status), `overdueOnly`, `sort`, `page`. Read from and written to the URL
  query, as `catalog` does, so a reload or a shared link opens the same table.
- `summary = serverData(progressSummary)`; `courses = serverData(myCourses, { params: query$ })` with `size: 20`;
  `q` debounced 300 ms; any filter change resets `page` to 0.
- `export = serverMutation(exportProgress, { errors: 'toast', onSuccess: save })`: the query is the table's filters
  and sort; the file is `tien-do-cua-toi-<yyyy-mm-dd>.csv` saved with `FileSaver`. No success toast (the download is
  the feedback).
- Selectors: `kpis$`, `rows$`, `isEmpty$` (no course at all, from `summary.counts.total === 0`), `noMatch$` (courses
  exist, the filters match none), `unavailableNote$` (true while any of `activity`, `assessment`, `competency` is
  `unavailable`).

View:

1. `ui-page-header`: h1 "Tiến độ của tôi", description "Số liệu theo lần học hiện tại của từng khóa.", action
   "Xuất CSV" (`download` icon, secondary, disabled while exporting or when the table is empty). The mockup's
   eyebrow "Hồ sơ học tập" and its two-clause description are dropped.
2. KPI row (label over value, `ui.num`, no card per number): "Tổng số khóa", "Hoàn thành", "Đang học",
   "Chưa bắt đầu", "Đang quá hạn" (value in the danger text token only when > 0).
3. One muted line under the KPIs while `unavailableNote$`: "Giờ học, điểm kiểm tra và năng lực sẽ hiển thị khi hệ
   thống có dữ liệu." The mockup's hours, average score, streak, radar, weekly chart, attempts list and badge cabinet
   are not built (no source on the backend; badges belong to the out-of-scope achievements screens).
4. Filters: `ui-search` "Tìm khóa học"; `ui-segmented` "Tất cả · Chưa bắt đầu · Đang học · Hoàn thành"; checkbox
   "Chỉ khóa quá hạn".
5. `ui-data-table`, one line per row, row click opens `/course/:courseId`, sortable headers mapped to the server's
   sort fields, `ui-pagination`:

   | Column            | Content                                                                                  |
   | ----------------- | ---------------------------------------------------------------------------------------- |
   | Khóa học          | title (truncated with `title`), code in `ui.mono` in a second column "Mã"                |
   | Tiến độ           | `ui-progress` (sm) + `progressPercent` % (`ui.num`, right-aligned)                       |
   | Bài bắt buộc      | `completedRequiredLessonCount/requiredLessonCount`                                       |
   | Trạng thái        | `app-course-status` (one dot badge; overdue shown there), the row's only coloured badge  |
   | Bắt đầu           | `startedAt` date                                                                         |
   | Truy cập gần nhất | `lastAccessAt` relative                                                                  |
   | Hoàn thành        | `completedAt` date; `deadlineStatus === 'completed_late'` adds "(trễ hạn)" as muted text |
   | Hạn               | `dueAt` date as text, "—" when none                                                      |

   The mockup's "Điểm cao nhất" column is dropped (no quiz results on the backend).

6. States: loading skeleton rows; `isEmpty$` → whole-page empty state, left-aligned: "Bạn chưa có khóa học nào.",
   link "Xem danh mục khóa học"; `noMatch$` → inline muted "Không có khóa học phù hợp bộ lọc." with "Xóa bộ lọc";
   errors → `ui-error-state` with retry, the summary and the table independently.

## Mock

- `LearningBackend` answers `progressSummary` by counting the caller's enrollments in its fixtures (a stand-in for
  the backend's counts), with the three availabilities `unavailable`.
- `myCourses` accepts `overdue` and the sort fields above.
- `exportProgress` answers a `text/csv` `Blob` with a UTF-8 BOM and the filtered rows; more than 10,000 rows (forced
  by `Prefer: code=LEARNING-EXPORT_TOO_LARGE` through the dev toolbar) answers the `ERROR` envelope as a JSON blob.

## Testing

- `progress.store.spec.ts`: filters round-trip through the URL; `q` is debounced; a filter change resets the page;
  the export sends the table's filters and sort without paging and saves the named file; `EXPORT_TOO_LARGE` toasts
  the server's message and saves nothing; empty versus no-match.
- `progress.spec.ts`: KPIs, the unavailable note, the table columns, row navigation, each state with retry.
- `envelope.interceptor.spec.ts`: the three blob cases above.

## Boundaries

- Always: the server's counts and percentages; one coloured badge per row; the same query for the table and the
  export.
- Ask first: showing any metric the backend returns as `unavailable`; a chart library.
- Never: zeros or placeholders for hours, scores, streaks or competency; client-side CSV building on the real
  backend.

## Success criteria

1. Local backend, as a demo learner: the five KPIs equal the server's summary; the table pages and sorts on the
   server; "Chỉ khóa quá hạn" shows only overdue courses.
2. "Xuất CSV" downloads a file that opens in Excel with Vietnamese titles intact and the same rows as the filtered
   table.
3. A forced `LEARNING-EXPORT_TOO_LARGE` shows its message in a toast and downloads nothing.
4. `npm run check` green; angular.md §14, the visual-design checklist and the migration verify step pass at 375,
   768 and 1280 px, light and dark, keyboard only; `route-progress` marked `done`.

## Open questions

None.

## Implementation notes (as built)

Built in T14–T16; verified on the local backend in Checkpoint 2 of `tasks/todo.md`.

- `envelopeInterceptor` now reads a `blob` response whose `Content-Type` is JSON as an envelope, so
  `LEARNING-EXPORT_TOO_LARGE` reaches the store as a refusal (T14, `contracts-and-mocks.md` updated).
- The CSV was checked for `text/csv`, the UTF-8 BOM and Vietnamese text; it was not opened in Excel itself.
- `EXPORT_TOO_LARGE` is covered by specs only (the real backend has too few rows to force it).
- The table scrolls horizontally up to 1280 px; at 375 px the rows become cards.
- Nx reported `lms:test` flaky under load a few times; the failing test was never identified and every rerun was green.
