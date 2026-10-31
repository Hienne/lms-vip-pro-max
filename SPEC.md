# Capability Map: learner features from the mockup ("Học tập" gap)

Status: **map approved 2026-10-31. Module specs written, each one waits for its own approval before
planning.**

Replaces the map for the org tree and import from file. That spec is now
[SPEC-org-tree.md](SPEC-org-tree.md). The older module specs (`SPEC-lesson-player.md`, `SPEC-learner-home.md`,
`SPEC-learner-progress.md` and the rest) stay beside this file and describe what is already built.

## Objective

The learner screens (learn, catalog, course, lesson, quiz, progress, saved, certificates, leaderboard) show less
than the mockup asks for. Some of this data and these actions exist in the backend
(`~/my-projects/corebanking-academy`) but are not wired. The rest the backend does not have yet. This
initiative closes the gap:

- **Mockup sets the scope.** It decides what each screen shows and does (data, actions, states, copy).
  `docs/conventions/visual-design.md` decides how it looks.
- **Missing backend parts are built in `corebanking-academy`.** Every schema change ships as a `docs/sql/`
  upgrade script plus a rollback script and the `psql` command that applies it.
- **Everything runs on this machine.** A local Postgres, the backend on `:8019`, and the app proxied to it.
  Nothing touches the shared backend `103.121.90.119`.

Users: learners (every module). Instructors and admins only where a module says so (the quiz picker in the
course editor in `learner-quiz`; the moderation inbox is out of scope).

## Modules

| Module id              | Responsibility                                                                                                                                         | BE work                                                              | DB change                          | Depends on        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------- | ----------------- |
| `local-stack`          | Postgres, backend and app running locally, seeded with the demo data; a smoke check that proves it                                                     | none (scripts and docs only)                                         | baselines + demo                   | —                 |
| `learner-quiz`         | Quiz intro, take, result and attempts on the real `/api/v1/me/quizzes…`; quizzes of a course; a quiz lesson that opens its quiz                        | learner quiz list per course; quiz lessons saved and tracked         | `course_lessons.quiz_id`           | local-stack       |
| `catalog-discovery`    | Field / module / programme filters, status Chưa đạt / Quá hạn / Được giao, "Được giao" tab, "Xóa n bộ lọc", sort by progress / name, course breadcrumb | learner facets, `assigned` and `failed` filters, course by id, names | none                               | learner-quiz      |
| `learner-competency`   | Competency radar on the learn page and the progress page                                                                                               | none (`GET /me/competency` exists)                                   | none                               | learner-quiz      |
| `learner-scores`       | KPI "Điểm gần nhất / cao nhất", "Đạt x/y bài", column "Điểm cao nhất", attempt list on progress                                                        | `assessment` block of the progress summary; best score per course    | none                               | learner-quiz      |
| `lesson-notes`         | Notes and bookmarks on a PDF page or a video time, and the "Đã lưu & ghi chú" page on real data                                                        | notes and bookmarks API                                              | `lesson_notes`, `lesson_bookmarks` | catalog-discovery |
| `lesson-feedback`      | Star rating, comments, ask the instructor, report content; course rating on catalog and course                                                         | feedback API and rating aggregate                                    | `lesson_feedback`                  | catalog-discovery |
| `lesson-player-modes`  | Focus mode, transcript and video chapters in the player                                                                                                | transcript and chapters on video blocks                              | 2 columns on `lesson_blocks`       | local-stack       |
| `certificates`         | Certificates list, one certificate, "Xem chứng nhận" on a completed course, print / save as PDF                                                        | certificates read from completed enrollments                         | none                               | learner-scores    |
| `learning-leaderboard` | Leaderboard by unit / team / all, my points and streak                                                                                                 | points computed from progress; daily activity for the streak         | `learning_activity_days`           | learner-quiz      |

Build order:

```text
local-stack
  → learner-quiz
    → catalog-discovery, learner-competency, learner-scores, learning-leaderboard
      → lesson-notes, lesson-feedback, certificates
lesson-player-modes   (needs only local-stack; can go at any point)
```

Two changes from the map as proposed:

- `catalog-discovery` now depends on `learner-quiz`. The "Chưa đạt" filter needs the course's final exam.
- `certificates` has no table. A certificate is a completed enrollment cycle. That cycle already gives a stable
  id, a date, and the score from `learner-scores`.

## What the backend has today (checked 2026-10-31 on `corebanking-academy` `main`)

| Need                          | Backend today                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learner quiz flow             | `LearnerQuizController` `/api/v1/me`: quiz intro, start, attempts, answer, submit, result, my attempts, export. The app still uses mock paths.                            |
| Course ↔ quiz                | `quizzes.course_id`. Saving a lesson of type `quiz` throws `LEARNING-QUIZ_UNAVAILABLE` (`LearningContentService:130`). `course_assessments` is unused and blocks publish. |
| Competency                    | `GET /api/v1/me/competency?courseId=` → `MyCompetency[]` (`code`, `name`, `totalQuestions`, `correctCount`, `maxScore`, `score`, `percent`)                               |
| Catalog filters               | `fieldId`, `programId`, `moduleId`, `level`, `requirement`, `learningStatus`, `state`. `overdue` on `courses` only. Sort on `title` and `progressPercent` exists.         |
| Field / programme / module    | `/api/v1/training-catalog/*` requires `requireManage`, so learners cannot read it. `CourseCard` has ids but no names.                                                     |
| Learner course by id          | none. The app pages through `catalog` / `courses` (`SPEC-lesson-player.md` open question 1).                                                                              |
| Progress summary              | `activity`, `assessment`, `competency` are `{ availability: "unavailable" }`                                                                                              |
| Notes, bookmarks, saved       | none (the app's `personal` endpoints are mock)                                                                                                                            |
| Rating, comments, Q&A, report | none for lessons (Community has its own reports and comments on community content)                                                                                        |
| Transcript, chapters          | only `community_media_transcripts` for community recordings. Nothing on lesson video blocks.                                                                              |
| Points, streak, leaderboard   | `course_completion_rules.reward_points` stored, never totalled. The leaderboard is the community contribution board.                                                      |
| Certificates                  | none                                                                                                                                                                      |

## Tech stack

- **App:** this repository. Angular 22, Nx, zod contracts in `libs/contracts`, fixtures in `libs/mocks`, `ui`
  Sass module, Vitest. Node 24.
- **Backend:** `~/my-projects/corebanking-academy`. Java 21, Spring Boot, Maven, PostgreSQL 16 with pgvector
  (`compose.yaml`). Flyway present but `spring.flyway.enabled: false`; `ddl-auto=validate`.

## Commands

App (this repository; run `nvm use` first):

```bash
LMS_API_TARGET=http://localhost:8019 npm start
npx nx test lms
npx nx test contracts
npm run check
```

Backend (`~/my-projects/corebanking-academy`, JDK 21):

```bash
docker compose --env-file .env up -d db
mvn clean test
mvn spring-boot:run
mvn clean verify
```

Upgrade scripts (one per module that changes the schema; the password comes from `PGPASSWORD` or `~/.pgpass`,
never from the command line):

```bash
psql -h localhost -U core_academy -d core_academy -v ON_ERROR_STOP=1 -f docs/sql/upgrade/<file>.sql
psql -h localhost -U core_academy -d core_academy -v ON_ERROR_STOP=1 -f docs/sql/upgrade/<file>.rollback.sql
```

## Project structure

```text
lms vip pro max/
├── SPEC.md, SPEC-<module-id>.md      → this map and one spec per module
├── libs/contracts/src/lib/<domain>/  → zod schemas and endpoints; `served: 'mock'` removed when a path is real
├── libs/mocks/src/lib/<domain>/      → fixtures and handlers for `mockBackend: true`, kept in step with the real API
└── apps/lms/src/app/features/…       → screens and their stores (paths in each module spec)

corebanking-academy/
├── src/main/java/vn/com/coreacademy/<module>/{controller,service,repository,entity,dto,constants,exception}
├── src/test/java/vn/com/coreacademy/<module>/   → tests for new services and controllers
├── docs/sql/upgrade/<yyyy-mm-dd>-<module-id>.sql (+ .rollback.sql)
└── docs/api/<MODULE>.md, docs/sql/README.md     → updated with every new endpoint and script
```

## Code style

App: `docs/conventions/angular.md`, `contracts-and-mocks.md`, `ui-library.md`, `visual-design.md`,
`docs/migration/mockup-to-angular.md`. A new real endpoint looks like the existing ones in
`learner.endpoints.ts`:

```ts
courseQuizzes: endpoint({
  method: 'GET',
  path: '/api/v1/me/courses/{courseId}/quizzes',
  params: z.object({ courseId: z.coerce.number().int() }),
  response: z.array(LearnerQuizCardSchema),
}),
```

Backend: `DEVELOPMENT_GUIDELINES.md`. A controller returns `BaseResponse<…>`, has `@Operation` and
`@ApiResponse`, and keeps access checks in the service (`LearningAccessPolicy`, the assessment's
`LearningAssessmentAccess`). New error codes go in the module's `*ResponseCode` enum with Vietnamese messages.
New tables follow the baselines in `docs/sql/learning_hub_*.sql`:

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS learning_hub.lesson_notes (
    note_id     bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id     varchar(20) NOT NULL,
    lesson_id   bigint      NOT NULL,
    created_by  varchar(20) NOT NULL,
    updated_by  varchar(20) NOT NULL,
    row_version bigint      NOT NULL DEFAULT 0,
    create_time timestamptz NOT NULL DEFAULT now(),
    update_time timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN learning_hub.lesson_notes.user_id IS 'Người tạo ghi chú (users.user_id).';
COMMIT;
```

The SQL rules:

- No `REFERENCES`, no cascade, no business `UNIQUE`. Relations and uniqueness are checked in the service.
- Every column has a comment.
- Indexes only where a module spec names the query that needs one.

## Testing strategy

- **App:** Vitest specs next to each store, component and contract; the mock handlers cover every new endpoint so
  `mockBackend: true` keeps working. Each converted screen passes the migration verify step in the browser.
- **Backend:** JUnit tests in `src/test/java` for each new service rule (access, validation, aggregates). Approved
  2026-10-31 as an exception to the backend rule "no test files unless asked", only for code this initiative adds.
  `mvn clean test` green before each commit.
- **End to end, locally:** each module ends with its success criteria checked in the app against the local backend,
  signed in as the seeded learner `hocvien` (and `giangvien` / `quantri` where a module says so), plus `curl`
  against `:8019` for the new endpoints.

## Boundaries

- **Always:**
  - Run on the local stack only.
  - Pair every schema change with an upgrade script, a rollback script, the `psql` command and a
    `docs/sql/README.md` entry.
  - Keep business rules (scores, progress, points, permissions, scope) on the server.
  - Parse every response with its zod schema.
  - Update `docs/api/*.md` together with each endpoint.
- **Ask first:**
  - A new dependency in either repository.
  - A change to course completion rules beyond the quiz lesson in `learner-quiz`.
  - Any change to Identity or permissions.
  - Turning on Flyway.
  - Anything that would run against the shared backend.
- **Never:**
  - Push, deploy or open a PR without being asked.
  - Run SQL against a database other than the local one.
  - Seed users, reset passwords or grant roles beyond what the baseline scripts already do.
  - Print secrets.
  - Log out the shared seed account.

Branches: `feat/learner-mockup-gap` in each repository, from `main`. The open UI polish branch
`claude/learning-ui-polish-e4f473` is not a base: it still waits for review. Screens that branch also touches will
be rebased onto it if it merges first.

## Decisions taken with the map (2026-10-31)

1. **Leaderboard points:** a learning points total, separate from community contribution points. It is computed
   from progress, quiz passes, course `reward_points` and the streak, with weights from configuration.
2. **Certificates:** the app renders a certificate page that prints or saves as PDF through the browser. No PDF
   library is added.
3. **Star rating:** per lesson. Course pages show the average across the course's lessons.
4. **Ask the instructor:** the learner sends a question and sees its status. The instructor inbox
   (`instructor/inbox`) and replies are out of scope.
5. **Transcript and chapters:** entered through the block write API or the demo SQL. There is no authoring UI.
6. **Backend tests:** allowed for code this initiative adds.
7. **Local data:** the baseline Identity script already creates the demo accounts (`hocvien`, `giangvien`,
   `quantri`, …) with a known demo password. The Learning, assessment and community demo scripts add the content.
   No other seeding.

## Open questions

None on the map. Each module spec lists its own.
