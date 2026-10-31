# Spec: `catalog-discovery`

Map: [SPEC.md](SPEC.md). Status: **draft, waiting for approval.** Depends on `learner-quiz`, which provides the
final exam used by "Chưa đạt".

Read first: `SPEC-lesson-player.md` (open question 1, `findLearnerCourse`), `docs/migration/mockup-to-angular.md`,
`corebanking-academy/docs/api/LEARNING.md`.

## Objective

A learner finds courses the way the mockup's `catalog` and `learn` pages describe:

- Filter by field (Lĩnh vực), module (Phân hệ) and programme (Chương trình).
- Filter by status, including Chưa đạt, Quá hạn and Được giao.
- Clear all filters with "Xóa n bộ lọc", and sort by due date, progress or name.
- See the "Được giao" and "Bắt buộc" tabs on the learn page, with counts.
- See a breadcrumb on the course page: Danh mục khóa học › {programme} › {course}, with "{field} · {module}" in
  the meta line.

Most of the app side exists already in `features/learning/catalog/data-access/catalog.store.ts`: filters in the
URL, the sort select, the clear count. What does not work against the real backend is:

| Gap                                    | Why                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Field / programme / module lists empty | The store calls `/api/v1/training-catalog/*`, which requires `requireManage`. A learner is refused.      |
| Status "Quá hạn"                       | The store sends `learningStatus=overdue`. The backend only knows `overdue=true`, and only on `/courses`. |
| Status "Chưa đạt"                      | The store sends `learningStatus=failed`, which the backend does not have.                                |
| "Được giao"                            | The tab lists `/courses` (every enrolled course), not courses assigned to the caller.                    |
| Breadcrumb names                       | `CourseCard` has `programId` / `moduleId`, no names and no field.                                        |
| Course page / lesson page              | There is no learner course-by-id endpoint, so `findLearnerCourse` pages through two lists.               |
| Learn tabs                             | "Được giao" is missing. "Bắt buộc" has no count.                                                         |

## Backend (`corebanking-academy`)

| #   | Endpoint                                              | Change                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `GET /api/v1/me/learning/facets`                      | **new**: `LearnerFacets { fields[], programs[], modules[] }`, each `{ id, code, name }`. Programs and modules also carry `fieldId`. It returns only the values used by at least one course the caller can see in the catalogue, sorted by `sort_no`, then name.                                     |
| D2  | `GET /me/learning/catalog` and `/me/learning/courses` | **changed**: new optional filters `assigned` (boolean; the caller has an active assignment) and `failed` (boolean; see the rule below). `catalog` also gets `overdue`. The export (`/progress/export`) takes the same filters.                                                                      |
| D3  | `CourseCard`                                          | **changed, additive**: `fieldId`, `fieldName`, `programName`, `moduleName`, `failed` (boolean)                                                                                                                                                                                                      |
| D4  | `GET /api/v1/me/learning/courses/{courseId}`          | **new**: `LearnerCourse { card: CourseCard, content: CourseDetail }`. `content` is the caller's enrolled revision, or the current published revision when the caller is not enrolled. Access follows the catalogue's visibility, and a course the caller cannot see is `LEARNING-COURSE_NOT_FOUND`. |
| D5  | `GET /me/learning/progress/summary`                   | **changed, additive**: `counts.assigned` and `counts.mandatory`                                                                                                                                                                                                                                     |

**Rule for `failed`.** The course has a published FINAL_EXAM quiz with at least one graded attempt by the caller,
and `everPassed` is false. It lives in `CourseRepositoryCustomImpl` as a subquery on `quiz_attempts`, reached
through the assessment adapter's read model: Learning does not import assessment repositories. If that is too
costly, the check moves behind a Learning port that Assessment implements. Which one is chosen is decided in
the plan, with a query plan on the demo data.

No schema change. Every new filter is a query over existing tables, so no upgrade script.

Docs: `docs/api/LEARNING.md` gets D1–D5, the `failed` rule and the new filter list.

## App

### Contracts (`libs/contracts/src/lib/learner`)

- `learnerEndpoints.facets` (D1), `learnerEndpoints.course` (D4).
- `CourseListQuerySchema` gains `assigned`, `failed` and `overdue`.
- `CourseCardSchema` gains the D3 fields.
- `LearningProgressOverviewSchema.counts` gains `assigned` and `mandatory`.

### Screens

| Where                             | Change                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog.store.ts`                | The field, programme and module lists come from `facets` (one call), not `trainingCatalogEndpoints`. The module and programme selects show only entries of the chosen field. The status filter maps `overdue` → `overdue: true`, `failed` → `failed: true`, `assigned` → `assigned: true`, and the rest → `learningStatus`. The "Được giao" scope becomes `catalog` with `assigned: true`. |
| catalog page                      | Status options: Chưa bắt đầu, Đang học, Đã hoàn thành, Chưa đạt, Quá hạn, Được giao (mockup `STATUS_OPTS`). "Xóa n bộ lọc" counts these too. Sort options stay Hạn hoàn thành / Tiến độ / Tên.                                                                                                                                                                                             |
| `learn.store.ts`                  | Tabs: Đang học, Chưa bắt đầu, Đã hoàn thành, Bắt buộc, Được giao, each with the summary's count (mockup `learner.js` dashboard). "Đang học" includes failed courses, as in the mockup.                                                                                                                                                                                                     |
| course page                       | Loads `learnerEndpoints.course` (D4). Breadcrumb: Danh mục khóa học › {programName} › {title}. The meta line starts with "{fieldName} · {moduleName}". A null name is left out, not shown as "—".                                                                                                                                                                                          |
| `core/learning/learner-course.ts` | `findLearnerCourse` is replaced by D4 and deleted with its spec. `lesson.store.ts` uses D4 too.                                                                                                                                                                                                                                                                                            |
| course card (`shared/course`)     | A "Chưa đạt" status label when `failed`; "Quá hạn" when `deadlineStatus` says so. These are status, not decoration, per `visual-design.md`.                                                                                                                                                                                                                                                |

### Mock

`libs/mocks/src/lib/learning` adds `facets`, `course` and the new filters and fields in its seed.

## Testing

- **Backend:**
  - D1 shows only values used by visible courses.
  - D2 `assigned`, `failed` and `overdue` each return the right demo courses.
  - D4 refuses a course outside the caller's scope and returns the enrolled revision when one exists.
  - D5 counts agree with D2 totals.
- **App:**
  - Store specs map each status option to its query.
  - URL round trip with the new filters.
  - The facets drive the selects.
  - Course page breadcrumb with and without names.
  - Learn tabs and counts.
- **Local, as `hocvien`:**
  - Every filter and each sort changes the list.
  - "Xóa n bộ lọc" shows the right n and clears.
  - "Được giao" lists only assigned courses.
  - The breadcrumb shows the programme.

## Boundaries

- **Always:** the server filters, sorts and counts; the app does not filter a fetched page.
- **Ask first:** making `/api/v1/training-catalog/*` readable by learners instead of D1.
- **Never:** compute `failed` or `overdue` in the app.

## Success criteria

1. As `hocvien` on the local stack, the field, programme and module selects list real names, and each one narrows
   the list. No call to `/api/v1/training-catalog` is made from learner screens.
2. Each status option returns the courses the backend's rule says, checked against `curl` with the same filter.
   "Chưa đạt" lists a demo course whose final exam `hocvien` failed in `learner-quiz`.
3. The learn page shows five tabs with counts that match `progress/summary`.
4. The course page and the lesson page each make one course call (D4), checked in the network panel. The
   breadcrumb shows the programme, and the meta line shows field · module.
5. `mvn clean test` and `npm run check` green.

## Open questions

1. **What "Được giao" means:** is it "has an active assignment" (default), or "assigned and not yet completed"?
2. **Facets for unassigned courses:** should D1 also list values for courses the caller can only self-enroll in?
   Default: yes, because it covers the whole visible catalogue.
