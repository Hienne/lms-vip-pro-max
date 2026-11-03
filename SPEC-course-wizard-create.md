# Spec: `course-wizard-create`

Map: [SPEC-course-authoring.md](SPEC-course-authoring.md). Status: **approved 2026-11-03** (open questions answered in `tasks/plan.md` Decision 1).
Depends on nothing. `course-final-exam` and `course-publish-targets` build on it.

## Objective

An admin who opens "Tạo khóa học mới" gets the same four-step wizard as "Sửa khóa học", as in the mockup's
`courseWizard` (`lms-mockup/src/pages/admin-content.js`, from line 117). Nothing is stored until the first
"Lưu nháp"; that save creates the course with its whole draft in one call.

**Steps** (labels from the mockup; the same in create and edit):

| #   | Label                | Subtitle                          | Content in this module                                                                  |
| --- | -------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Thông tin cơ bản     | Tên, mã, chương trình             | title, code (create only), program, module, level, required/optional, summary, outcomes |
| 2   | Nội dung khóa học    | Chương, bài, khối nội dung        | the editor's outline as today                                                           |
| 3   | Bài thi & điều kiện  | Điều kiện hoàn thành, điểm thưởng | the completion rules and reward points the editor has today                             |
| 4   | Đối tượng & xuất bản | Kiểm tra trước khi xuất bản       | the pre-publish checklist and the summary; assignment and sharing come later            |

**Create mode** (`/admin/courses/new`):

- Step 1 has "Mã khóa học" (required, at most 50 characters, hint "Duy nhất trong hệ thống, không đổi sau khi tạo.")
  and the line "Đơn vị sở hữu: {org}". The code is read-only in edit mode, shown in the header as today.
- The header reads "Tạo khóa học mới", and the status "Chưa lưu" until the first save.
- The footer has "Hủy" (step 1) or "Quay lại", "Lưu nháp", and "Tiếp tục" (steps 1–3) or "Xuất bản khóa học"
  (step 4). One primary button: "Tiếp tục" or "Xuất bản khóa học".
- **"Lưu nháp"** sends `POST /courses` with the code, the owner and the whole draft. On success: the toast
  "Đã lưu nháp", then `/admin/courses/{id}/edit` with `replaceUrl`, on the same step. The leave guard does not ask.
- **"Xuất bản khóa học"** in create mode creates, then publishes the new revision with its returned version (two
  calls, as edit mode does today: save, then publish).
- A `DUPLICATE` code error is shown on the code field and takes the user to step 1.
- Leaving with any entered value asks first (the existing `unsavedChangesGuard`).
- **Before the first save** (the course has no id yet):
  - a quiz lesson cannot pick a quiz, since quizzes belong to a course; the picker says "Lưu nháp trước để chọn bài
    kiểm tra";
  - file uploads work (assets belong to the org), but an interrupted upload can be resumed only once the course
    exists, because kept uploads are stored per course.

`/admin/courses/new` keeps its route id `course-new`; the course-new screen and its store are removed, and the route
loads the editor in create mode.

## Backend (`corebanking-academy`, module `learning`)

`POST /api/v1/courses` accepts an optional `draft`:

```text
CreateCourse {
  ownerOrgId*, ownerTeamId?, code*, title?,     // as today
  draft?: DraftContent                          // new
}
DraftContent = DraftRequest without expectedVersion
  (programId, moduleId, title, summary, level, defaultRequirement*, coverAssetId, coverIcon, coverColor,
   objectives*, chapters*, rewardPoints)
```

- Without `draft`, the behaviour is unchanged: the course and an empty revision 1.
- With `draft`, one transaction: the current checks (`requireManage`, the owner team, `DUPLICATE` code), the course,
  revision 1, then the same tree write and validation as `saveDraft` (`writeTree`). Any validation error rolls
  everything back, so no empty course is left behind.
- If both `title` and `draft.title` are sent, `draft.title` wins.
- `DraftRequest` and `DraftContent` share one validation path; no rule is duplicated.
- Audit: `COURSE_CREATED` as today; no second draft-saved event.
- The response is the same `CourseDetail` (revision 1, version as after a save).
- Javadoc and comments in Vietnamese (`DEVELOPMENT_GUIDELINES.md`).
- **DB:** none.
- `docs/api/LEARNING.md` documents the optional `draft`.

## App

- **Contracts:** `CreateCourseCommandSchema` gains `draft: SaveDraftCommandSchema.omit({ expectedVersion })`,
  optional. Fixtures for a create with a draft are captured from the local backend.
- **Mock:** the in-app create handler accepts `draft` and stores the tree as its `saveDraft` does.
- **Editor:**
  - `EDITOR_STEPS` becomes the four steps above; the old step 3 is split into steps 3 and 4.
  - The store gains a create mode: no load, an empty draft value, the code field, and `save` and `publish` that
    create first.
  - `course-draft.ts`: a `toCreateCourseCommand(value, code, ownerOrgId)` beside `toSaveDraftCommand`, sharing
    the tree mapping.
  - The code field uses the existing limits (`COURSE_LIMITS.code`); the server still decides.
- **Removed:** `features/admin-content/course-new/` (component, store, specs). Its copy moves into the editor.
- **Design:** `docs/conventions/visual-design.md` over the mockup: no cover-icon picker, no preview card, no icon
  tiles, no eyebrow, card radius, one primary button.

## Testing

- **Backend:** integration tests for a create with a draft (the tree reads back), a create without one (unchanged),
  a `DUPLICATE` code, a draft validation error that leaves no course, and a caller without manage rights.
  `mvn -o clean test` green.
- **App:** specs for the store's create mode (no call before the save; the save sends one create with the tree; the
  navigation with `replaceUrl` on the same step; publish after create), the four steps, the code field and its
  `DUPLICATE` error, the guard, and the quiz picker before the first save. `npm run check` green.
- **Browser** on the local stack as `quantri`: create a course with two chapters and a lesson in one save, reload the
  edit URL and see the tree; 375, 768 and 1280 px, light and dark, keyboard only; beside the mockup on :4320.

## Boundaries

- **Always:** the server validates the draft; every response parsed by its schema; Vietnamese UI copy from the
  mockup; one commit per task; the local stack only.
- **Ask first:** any schema change; a new dependency; changing the `CreateCourse` response.
- **Never:** touch the shared server `103.121.90.119`; seed users or edit the DB directly; push, merge or open a PR
  without the user's request; add the cover-icon picker or the mockup's preview card.

## Success criteria

1. Opening `/admin/courses/new` makes no learning call (only programs and modules for the selects).
2. One "Lưu nháp" creates the course and its whole tree in one `POST /courses`; the URL becomes
   `/admin/courses/{id}/edit` without a history entry for `/new`.
3. A draft that fails validation leaves no course on the server.
4. Create and edit show the same four steps with the mockup's labels.
5. The old `POST /courses` body still creates an empty course (a test proves it).
6. `npm run check` and `mvn -o clean test` green; the visual-design checklist passes.

## Open questions

1. **Before the first save:** is it fine that a quiz lesson cannot pick its quiz until the course is saved, and
   that an interrupted upload cannot be resumed until then? The alternative is an automatic save when the admin
   first opens a quiz lesson or uploads a file, which breaks "nothing stored until Lưu nháp".
2. **Step 4 in this module** shows only the checklist and the summary. Assignment and sharing stay on their screens
   until `course-publish-targets`. Acceptable?
3. **Removing the course-new screen:** nothing else links to it except `/admin/courses/new`. Delete it, rather than
   keeping it as a fallback?

## Implementation notes (app)

Built on `feat/course-authoring` in tasks F1 to F5 (`tasks/todo.md`).

- **Contracts and mock.** `CreateCourseCommandSchema.draft` is `SaveDraftCommandSchema.omit({ expectedVersion })`,
  optional. `capturedCourseCreate` (`course.captured.ts`) is a create with a draft from the local backend
  (`WIZ-APP-01`, two chapters, revision version 1). The mock create and its `saveDraft` share `writeDraft`; a taken
  code is refused with `LEARNING-DUPLICATE`, which is now in `MESSAGE_CODE_KIND` as `refused` (the backend answers it
  with HTTP 200 and an `ERROR` envelope).
- **Draft mapping.** `CourseDraftValue` gains `code`: typed in create mode, read-only in edit mode, counted by the
  leave guard's fingerprint. `emptyDraftValue()`, `toSaveDraftCommand` and `toCreateCourseCommand(value, code,
ownerOrgId)` share one `toDraftContent`.
- **Steps.** `EDITOR_STEPS` has the four labels and subtitles of the table above. `course-finish` became
  `course-review` (step 4: the checklist and a summary of chapters, lessons, minutes and reward points) and
  `course-rules` (step 3: completion rules and reward points). `draftChecks` indexes did not change: its checks point
  at steps 1 and 2, which keep their places. The footer is "Hủy" (step 1) or "Quay lại", "Lưu nháp", and "Tiếp tục"
  or "Xuất bản khóa học", the last two being the only primary button.
- **Create mode.**
  - `Screen.mode` puts `{ mode: 'create' }` in the route data of `admin/courses/new`; `CourseEditorStore.isCreate$`
    reads it. The store reads no course, quiz list or kept upload without a course id.
  - "Lưu nháp" calls `createCourse`; on success `left` is set (the guard stops asking), and the page navigates to
    `/admin/courses/{id}/edit?step={n}` with `replaceUrl`. `?step=` is the 0-based index the stepper uses, read once
    when the editor opens.
  - Publish in create mode creates, then publishes with the returned revision id and `rowVersion`. If the publish is
    refused, the course already exists, so the page moves to its edit URL on the same step and a toast says
    "Đã lưu nháp, chưa xuất bản" with the server's reason.
  - A `LEARNING-DUPLICATE` answer stores the refused code (`takenCode$`) and returns to step 1. A validator on the
    code field shows "Mã khóa học đã tồn tại." while the field still holds that code; the alert does not repeat it.
  - A quiz lesson shows "Lưu nháp trước để chọn bài kiểm tra" and makes no call.
- **Removed.** `features/admin-content/course-new/`, deleted with the route change in F4.
- **Known gap.** The backend refuses to publish a course without a level, and `draftChecks` does not list the level
  yet; the refusal shows as the publish alert (edit) or toast (create).
- **Checked.** Specs for the contracts and the captured create, the mock (create, tree, title rule, duplicate), the
  draft mapping, the four steps and the footer, and the create flow above. `npm run check` is green. The browser pass
  of Checkpoint B (local stack, 375/768/1280 px, light and dark, keyboard, beside the mockup) is not done here.
