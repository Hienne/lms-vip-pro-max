# Capability Map: course authoring wizard (`course-authoring`)

Status: **map approved 2026-11-03; all three modules built by 2026-11-04** (`SPEC-course-wizard-create.md`, `SPEC-course-final-exam.md`, `SPEC-course-publish-targets.md`).

## Objective

The admin screen "Tạo khóa học mới" / "Sửa khóa học" should match the mockup's `courseWizard`
(`lms-mockup/src/pages/admin-content.js`):

- one page with four steps, where nothing is stored until "Lưu nháp";
- a course-level final exam;
- assignment and sharing at publish time.

The backend may change. `docs/conventions/visual-design.md` still overrides the mockup, so there is no cover-icon
picker, no icon tiles and no eyebrow (the user's decision, 2026-11-03).

## Today (checked 2026-11-03)

- **App:**
  - `/admin/courses/new` asks only for the title and code, then `POST /courses` creates the course and its first
    draft.
  - `/admin/courses/:id/edit` has three steps: "Thông tin cơ bản", "Nội dung khóa học", "Hoàn thành & xuất bản".
  - Assignment is on `/admin/assignments`, and sharing is in the course list's row menu.
- **Backend (`corebanking-academy` `main` at `59aa687`):**
  - `POST /courses` takes `CreateCourse {ownerOrgId, ownerTeamId, code, title}`.
  - The tree is saved by `PUT /courses/{id}/revisions/{rid}` (`DraftRequest`), and published by
    `POST …/publish {expectedVersion}`.
  - Assignments: `POST /courses/{id}/assignments` takes an `AssignmentRequest` with a `revisionId`, so it needs a
    published revision.
  - Shares: `PUT /courses/{id}/shares`.
- **Final exam:**
  - `learning_hub.course_assessments` exists in the baseline but is a stub. Publishing refuses a revision that has
    any row (`QUIZ_UNAVAILABLE`), and `LearningProgressService` never completes such a revision.
  - Quizzes belong to a course (`quizzes.course_id`). They have a `quiz_type` of `PRACTICE` or `FINAL_EXAM` (at most
    one `FINAL_EXAM` per course), and they have no revisions.
  - Completion today: every required lesson at 100%; a quiz lesson reaches 100% when its quiz is passed.

## Modules

| Module id                | Responsibility                                                                                                                                                                                                                                                              | BE work                                                                                                                                                                                              | DB change                                                      | Depends on             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| `course-wizard-create`   | `/admin/courses/new` is the same four-step wizard as edit, with no server call until the first "Lưu nháp". The four steps follow the mockup: Thông tin cơ bản · Nội dung khóa học · Bài thi & điều kiện · Đối tượng & xuất bản. The code and program are entered in step 1. | `POST /courses` also accepts the whole draft (the `DraftRequest` body) and creates the course, the revision and the tree in one transaction. The current title-and-code body keeps working.          | none                                                           | —                      |
| `course-final-exam`      | Step 3: "Bài kiểm tra cuối khóa", a choice among the course's quizzes or "Không yêu cầu"; the completion rules reflect it; the pre-publish checklist has "Đã cấu hình bài kiểm tra (khuyến nghị)".                                                                          | The draft carries `finalQuizId`, saved as one `course_assessments` row (placement final). The revision copy keeps it. Publish validates it instead of refusing. Completion also requires passing it. | none expected (the table exists); confirmed in the module spec | `course-wizard-create` |
| `course-publish-targets` | Step 4: rows "Giao khóa học" (unit, group or person; start; due; reminder) and "Chia sẻ cho đơn vị khác"; "Xuất bản khóa học" publishes, assigns and shares in one go.                                                                                                      | `publish` accepts optional `assignments[]` and `shareOrgIds[]`, validated and applied in the same transaction as the publish; with neither, it behaves as today.                                     | none                                                           | `course-wizard-create` |

Build order:

```text
course-wizard-create
  → course-final-exam, course-publish-targets   (independent of each other; one at a time on the shared files)
```

- `course-wizard-create` owns the four-step shell. Step 3 starts with the completion rules and the reward points
  that the editor has today. Step 4 starts with the pre-publish checklist.
- The two later modules fill steps 3 and 4. They touch the same editor files (`course-editor.*`,
  `course-draft.ts`), so they are built one after the other, not in parallel.

## Decisions taken (2026-11-03)

1. **Final exam:** a real backend rule (a course-level final exam), not a quiz lesson added by the app.
2. **Assignment and sharing at publish:** the backend's `publish` accepts them in one transaction, not several
   calls from the app.
3. **Create:** the backend creates the course with its whole draft in one call, not `POST` then `PUT`.
4. **Cover icon:** not added. visual-design.md wins over the mockup.

## Boundaries for every module

- **Always:**
  - business rules on the server (completion, validation, permissions);
  - every response parsed by its zod schema;
  - Vietnamese UI copy from the mockup;
  - backend Javadoc and comments in Vietnamese;
  - one commit per task;
  - the local stack only.
- **Ask first:** any schema change; a new dependency; changing an existing response in a way that is not additive.
- **Never:**
  - touch the shared server `103.121.90.119`;
  - edit enrollments, progress or attempts directly in the DB;
  - push, merge or open a PR without the user's request;
  - bring back the banned visual patterns.

## Open questions for the module specs

1. **`course-final-exam`:**
   - Which quizzes can be picked: only the course's `FINAL_EXAM` quiz (at most one), or any published quiz of the
     course, as in the mockup's list?
   - `course_assessments.assessment_revision_id` would hold a quiz id, since quizzes have no revisions. Do we reuse
     the column as is, or rename it with an upgrade script?
2. **`course-final-exam`:** for learners already enrolled in a published revision, adding a final exam only applies
   to the next revision. Is that acceptable?
3. **`course-publish-targets`:** when an assignment row is invalid, the whole publish fails and nothing is
   published. Is that the wanted behaviour, or should it publish and report the rows that failed?
