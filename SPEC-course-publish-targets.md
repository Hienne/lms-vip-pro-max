# Spec: `course-publish-targets`

Map: [SPEC-course-authoring.md](SPEC-course-authoring.md). Status: **approved 2026-11-03** (open questions answered in `tasks/plan.md` Decision 1).
Depends on `course-wizard-create` (built); built after `course-final-exam` (built) because both touch the editor.

## Objective

Step 4 "Đối tượng & xuất bản" of the course editor lets the admin assign the course and share it with other units
in the same click as "Xuất bản khóa học", as in the mockup's `courseWizard` step 4
(`lms-mockup/src/pages/admin-content.js`, `step4`). The backend applies the publish, the assignments and the shares
in one transaction.

**Decisions taken (2026-11-03, the user):**

1. **All or nothing.** If any assignment row or share is invalid, nothing is published, assigned or shared. Step 4
   shows which row failed.
2. **Target types.** Each row picks one target of the four types the backend and the "Giao học & hạn" screen know:
   person, team, unit (with or without its sub-units), and learning group. Each row has its own start and due date,
   as in the mockup.
3. **Sharing adds only.** Units already shared show as checked and locked. A newly checked unit is shared with the
   right to assign, including its sub-units. Revoking and fine-grained rights stay in the course list's "Chia sẻ"
   menu.

### Step 4 in the app

Two columns from `lg`: the left column has "Giao khóa học" then "Chia sẻ cho đơn vị khác"; the right column has the
existing "Kiểm tra trước khi xuất bản" and "Tóm tắt khóa học". Card radius, no icon tiles, one primary button
("Xuất bản khóa học" in the footer).

- **"Giao khóa học"**
  - A ghost button "Thêm đối tượng" adds a row.
  - Each row has:
    - "Loại": Cá nhân / Phòng / Đơn vị / Nhóm học;
    - "Đối tượng": the picker for that type, the same as the "Giao học & hạn" screen; for a unit, a "Gồm đơn vị
      con" checkbox, on by default;
    - "Bắt đầu" and "Hạn hoàn thành" (dates);
    - a delete button "Xóa dòng".
  - With no row: "Chưa thêm đối tượng. Có thể giao sau khi xuất bản."
  - When the course already has assignments: "Đã giao trước đó: {n} đợt — quản lý tại Giao học & hạn" (a link).
  - A switch "Tự động nhắc học viên trước hạn 3 ngày", on by default; it applies to every new row.
  - Each row's requirement is the course's "Loại khóa học" (bắt buộc / tự chọn) from step 1, and its enrollment mode is
    "continue".
  - Before sending, the app checks only what the form can know: a target is chosen, both dates are set, and the due
    date is not before the start ("Dòng {i}: chọn đối tượng.", "Dòng {i}: hạn phải sau ngày bắt đầu."). The server
    decides the rest.
- **"Chia sẻ cho đơn vị khác"**
  - The help text reads "Đơn vị được chia sẻ có thể giao khóa cho học viên của mình nhưng không sửa nội dung."
  - Below it, a checkbox list of the units.
    - The owner unit is checked, disabled, with "(đơn vị sở hữu)".
    - Units with an active share are checked, disabled, with "(đã chia sẻ)".
- **Publish**
  - "Xuất bản khóa học" keeps its confirmation dialog. The message adds the counts: "{n} đối tượng được giao, {m} đơn
    vị được chia sẻ."
  - On success, the toast says what happened, the rows and new checks are cleared, and the editor reloads.
  - On a refusal that names a row, step 4 stays open with that row marked and the server's message on it.
- **Create mode** works the same: the create call is followed by the publish call that carries the rows and shares.

## Backend (`corebanking-academy`, module `learning`)

`POST /courses/{courseId}/revisions/{revisionId}/publish` takes a new body:

```text
PublishRequest {
  expectedVersion*,                                   // as today
  assignments?: [ PublishAssignment ]  (max 20)
  shareOrgIds?: [ orgId ]              (max 50)
}
PublishAssignment {
  startAt*, dueAt?, reminderEnabled, reminderDaysBefore (0–365),
  target*: TargetInput                                // the existing type: user | team | org | learning_group
}
```

- **Backward compatible.** `{expectedVersion}` alone behaves exactly as today.
- **One transaction.** The order is:
  1. the existing publish checks and the publish;
  2. each share;
  3. each assignment.
- **Shares.** Each `orgId` goes through the same rules as `PUT /courses/{id}/shares`: the unit is active and not the
  owner. It is saved as `includeDescendants` true, `canAssign` true, `canSelfEnroll` false, active. An org that already
  has an active share is left as it is.
- **Assignments.**
  - Each row becomes one assignment through the existing `LearningAssignmentService.assign` logic, which is called
    inside the same transaction. The row's values are completed from the publish:
    - `revisionId`: the revision just published;
    - `assigningOrgId`: the course's owner org;
    - `title`: null;
    - `requirement`: the revision's `defaultRequirement`;
    - `enrollmentMode`: `continue`;
    - `idempotencyKey`: `publish-{revisionId}-{index}`.
  - Every existing rule applies: the scope, an empty target, the 500-learner limit, a due date after the start.
- **Row errors.**
  - A failure in row `i` is returned as `CORE-VALIDATION_FAILED`. Its `errors` entry has the field `assignments[i]`,
    the original code (for example `LEARNING-EMPTY_TARGET`, `OUT_OF_RANGE`) and its message.
  - An access failure on a recipient becomes a refusal on that row, not a bare 403.
  - Share failures use the field `shareOrgIds[j]` in the same way.
- **Audit.** The existing events, in this order: the publish, `COURSE_SHARED` for each share, the assignment events.
- **Docs.** `docs/api/LEARNING.md` and `LEARNING_CURL.md`. Javadoc and comments in Vietnamese.
- **DB.** None.

## App

- **Contracts:**
  - The publish body schema becomes `PublishCourseCommand` (`expectedVersion`, optional `assignments`, optional
    `shareOrgIds`), reusing the assignment `TargetInput` schema.
  - Fixtures are captured from the local backend.
- **Mock:** the publish handler accepts and applies the rows and shares through the mock's existing assignment and
  share logic. It refuses an empty target with the row field.
- **Shared picker:**
  - The target picker of "Giao học & hạn" (`features/admin-org/assignments/components/target-picker`) and its data
    calls move to a shared place both screens can import, following the workspace's module boundaries
    (`docs/conventions/workspace.md`).
  - The assignments screen keeps working unchanged.
- **Editor:**
  - The store gains the step 4 state: the rows, the reminder switch and the new share ids. They are not part of the
    draft. They are not saved by "Lưu nháp" and are lost on leaving.
  - It also loads the course's shares, the org list and the assignment count, but not in create mode.
  - `publish` and `createAndPublish` send them.
  - `course-review` is split or extended into the step 4 layout above.
- **Design:** `docs/conventions/visual-design.md` over the mockup.

## Testing

- **Backend:** integration tests for:
  - publish with two rows (a person and a unit with sub-units) and one share: the enrollments, the recipients and the
    share all exist;
  - publish with no extras: unchanged;
  - an empty-target row: nothing is published (the revision stays a draft), and no assignment or share is left;
  - a share to the owner unit is refused with `shareOrgIds[0]`;
  - an already shared unit is left unchanged;
  - a due date before the start is refused on `assignments[0]`;
  - a retry of the same publish is refused by the version check, not duplicated.

  `mvn -o clean test` green.

- **App:**
  - specs for the rows (add, delete, type switch resets the target, the form checks);
  - the reminder switch;
  - the share list (owner and shared units locked);
  - the publish command, in edit and create mode;
  - a row error mapped back to its row;
  - the assignments screen still passes its specs after the picker moves.

  `npm run check` green.

- **Local stack:**
  1. As `quantri`, publish a draft with a row for `hocvien.tichhop` and a share. The learner sees the course in "Khóa
     học của tôi".
  2. A row that cannot resolve leaves the revision a draft.

  No direct DB edits.

## Boundaries

- **Always:** the scope, limits and rules are decided by the server; the app only checks what a form can know. Every
  response is parsed by its schema. Vietnamese copy from the mockup. One commit per task. The local stack only.
- **Ask first:** any schema change; a new dependency; changing an existing response in a way that is not additive.
- **Never:**
  - touch the shared server `103.121.90.119`;
  - edit enrollments or assignments directly in the DB;
  - revoke shares from step 4;
  - push, merge or open a PR without the user's request.

## Success criteria

1. Step 4 shows the assignment rows, the reminder switch and the share list with the mockup's copy, and "Xuất bản
   khóa học" sends them with the publish.
2. A valid publish creates the assignments and shares in the same call. The learners get enrollments on the new
   revision.
3. Any invalid row or share leaves nothing published, assigned or shared. The editor marks that row.
4. `{expectedVersion}` alone publishes as before, and the "Giao học & hạn" screen works as before.
5. No DB change. `mvn -o clean test` and `npm run check` green.

## Open questions

1. **Row requirement.** This spec uses the course's "Loại khóa học" for every row; the mockup has no per-row
   requirement. Should a row be able to override it (bắt buộc / tự chọn)? The default here is no.
2. **Limits.** 20 rows and 50 shares per publish are new limits, chosen to keep one transaction short. Are they
   acceptable?

## Implementation notes (app)

Built on `feat/course-authoring` in tasks F1 to F4 (`tasks/todo.md`). Differences from the text above are listed last.

- **Contracts and mock.**
  - `PublishCourseCommandSchema` (`course-publish.schema.ts`, beside `course.schema.ts` because the assignment schemas
    import that file) is the publish body: `expectedVersion`, up to 20 `assignments`, up to 50 `shareOrgIds`
    (`PUBLISH_LIMITS`). `publishRowOf(field)` reads `assignments[i]` / `shareOrgIds[j]`.
  - The envelope's `errors[]` is now read (`FieldError`; `ApiError.fieldErrors`, `AppError.fieldErrors`), because the
    row mapping needs the field. Screens that do not use it are unchanged.
  - `capturedPublishTargets` (`course.captured.ts`) holds a body and the three refusals seen on the local backend.
  - The mock publish checks, then publishes, shares and assigns through its own `share` and `assignCourse`, and puts
    everything back on a refusal. It refuses an empty target, a due date before the start, the owner unit and an
    unknown unit with `CORE-VALIDATION_FAILED` and the row field.
- **Shared picker.** `shared/assignment-target/`: `TargetPicker` and its own `TargetOptionsStore` (people, orgs, teams of
  the picked org, learning groups). The owner org of the groups comes from the optional `TARGET_OWNER_ORG` token (the
  caller's org without it); step 4 provides the course's owner. `TargetPick`, `sameTarget` and `TARGET_TYPE_LABEL` moved
  there. `AssignmentsStore` lost its org and team lists. The picker takes an `addLabel`.
- **Editor store.** `publishRows`, `reminderEnabled` and `newShareOrgIds` are state outside the draft. In edit mode it
  loads the shares and the count of the owner unit's assignments. `publish()` and `createAndPublish()` check the rows
  (`rowIssue`: "Dòng {i}: chọn đối tượng." / "chọn ngày bắt đầu." / "hạn phải sau ngày bắt đầu."), ask with the counts
  added when there are any, and send `toPublishCommand`; with nothing to add the body is `{ expectedVersion }` alone.
  Success clears the state and goes to the list; a refusal marks the row or the unit by id and hides the generic alert.
  After a create, a refusal moves to the edit screen and the toast carries the row line, because the rows are not kept.
- **Step 4.** `course-review` has two columns from `lg`: `assign-rows` ("Giao khóa học") and `share-units` ("Chia sẻ cho
  đơn vị khác") on the left, the checks and the summary on the right. Rows show the label, the type as text, "Bắt đầu",
  "Hạn hoàn thành" and "Xóa dòng". The only primary button is the footer's.
- **Differences.**
  - Rows are added by the picker (plan Decision 8), so there is no per-row type select.
  - "Hạn hoàn thành" is optional, as on the server; a row without one sends no reminder.
  - The org list is also read in create mode, where the share list needs it; shares and the count are not.
  - The picker's add button is the secondary variant, not ghost.
  - Rows are lost when a refused create moves to the edit screen.
- **Checked.** Specs for the schema and the captured refusals, the envelope's field errors, the mock (rows, shares,
  rollback, each refusal), the helpers, the rows, the switch, the share list, the publish in edit and create mode and a
  refusal mapped back; the assignments specs pass. `npm run check` is green. The browser pass of Checkpoint B is not done
  here.
