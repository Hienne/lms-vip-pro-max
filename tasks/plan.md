# Implementation Plan: `course-publish-targets`

Spec: [SPEC-course-publish-targets.md](../SPEC-course-publish-targets.md) (approved; amended below). Map:
[SPEC-course-authoring.md](../SPEC-course-authoring.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `course-final-exam`. That plan is done; it is in git history at `2c91339`.

## Overview

Step 4 of the course editor gets "Giao khóa học" (assignment rows) and "Chia sẻ cho đơn vị khác" (new shares). The
publish call carries both, and the backend applies the publish, the shares and the assignments in one transaction:
all or nothing, with a failing row named in the error. No DB change.

## What was checked while planning (2026-11-03)

**Backend (`feat/course-final-exam` at `61ff927`, not merged yet)**

- **Publish** is `POST /courses/{courseId}/revisions/{revisionId}/publish` with a `VersionRequest` body
  (`expectedVersion`).
- **`LearningAssignmentService.assign(courseId, AssignmentRequest)`** is `@Transactional`. In order it:
  `lock.acquire`, `requireAssignCourse`, the idempotency check, `dueAt` before `startAt` →
  `BusinessException.validation("dueAt", "OUT_OF_RANGE", …)`, `requirePublished`, `resolveTarget`. It throws
  `EMPTY_TARGET`, and `AccessDeniedException` for a recipient out of scope.
- `AssignmentRequest(revisionId, assigningOrgId, title, startAt, dueAt, requirement, enrollmentMode, reminderEnabled,
reminderDaysBefore, idempotencyKey, targets)`; `TargetInput(targetType, userId, teamId, orgId, groupId,
includeDescendants)`. `LearningLimits.MAX_ASSIGNMENT_TARGETS` 100, `MAX_LEARNERS_PER_ASSIGNMENT` 500.
- **`share(courseId, ShareRequest{orgId, includeDescendants, canAssign, canSelfEnroll, active})`** refuses the owner
  org with `INVALID_REFERENCE`.

**App (`feat/course-authoring` at `2c91339`)**

- `TargetPicker` (`features/admin-org/assignments/components/target-picker`) is an "add one target" picker: a
  segmented type, the selects for that type, "Gồm đơn vị con", and an add button that emits a `TargetPick`
  (`TargetInput` plus a label). It injects `AssignmentsStore` for `people$`, `orgs$`, `teams$` (by `pickTargetOrg`)
  and `groups$` (by the caller's org). Only `assign-form` uses it.
- Module boundaries (`docs/conventions/workspace.md`, angular.md §4): features never import each other's internals;
  `shared/` never imports `features/`. So the picker and its option data move to `shared/`.
- The course-shares store uses `courseEndpoints.shares` and `share`. The assign form's defaults are
  `REMIND_DAYS = 3` and `enrollmentMode 'continue'`.
- Mockup step 4: `lms-mockup/src/pages/admin-content.js`, about lines 230–250.

## Decisions (amendments to the spec)

1. **Open questions** (by approval, 2026-11-03): no per-row requirement override; the limits are 20 rows and 50
   shares per publish.
2. **Request shape.** `PublishRequest(@NotNull Long expectedVersion, @Size(max=20) @Valid List<PublishAssignment>
assignments, @Size(max=50) List<@NotNull @Positive Long> shareOrgIds)`, null lists read as empty.
   `PublishAssignment(@NotNull OffsetDateTime startAt, OffsetDateTime dueAt, boolean reminderEnabled,
@Min(0) @Max(365) int reminderDaysBefore, @NotNull @Valid TargetInput target)`. The publish endpoint takes it in
   place of `VersionRequest`; `{expectedVersion}` alone is unchanged.
3. **One transaction.** A new orchestrating method (for example `LearningPublishService.publish`, or the existing
   publish method extended) runs the publish, then the shares, then the assignments, all in the caller's
   transaction. `assign` and `share` join it (default propagation); nothing uses `REQUIRES_NEW`.
4. **Row errors.** Each share and each assignment call is wrapped. A `BusinessException` or an
   `AccessDeniedException` from row `i` is rethrown as `CORE-VALIDATION_FAILED` with one error, field
   `assignments[i]` (or `shareOrgIds[j]`), the original message code and its message. The rethrow marks the
   transaction for rollback, so the revision stays a draft. Bean-validation failures keep their usual field paths
   (`assignments[0].target`, …).
5. **Shares add only.** An org with an active share is skipped (no write, no event). Anything else goes through
   `share` with `includeDescendants` true, `canAssign` true, `canSelfEnroll` false, `active` true.
6. **Assignment values.** `revisionId` = the revision just published; `assigningOrgId` = the course's owner org;
   `title` null; `requirement` = the revision's `defaultRequirement`; `enrollmentMode` `continue`;
   `idempotencyKey` `publish-{revisionId}-{index}`; one target per assignment.
7. **Shared picker (app).** The picker moves to `shared/assignment-target/` with a component-provided
   `TargetOptionsStore` (people, orgs, teams by the picked org, learning groups by an owner org set by the host).
   `AssignmentsStore` stops loading those four lists for the picker and reads names from its own data as before, or
   from the new store where it only fed the picker. `assign-form` behaves the same.
8. **Rows are added by the picker (amends the spec's per-row "Loại").** Step 4 shows the shared picker; "Thêm đối
   tượng" adds the pick as a row. A row shows the target label, "Bắt đầu" (default today), "Hạn hoàn thành" (empty)
   and "Xóa dòng". The type switch and its reset stay in the picker, as on "Giao học & hạn". This keeps one picker,
   one behaviour, and fewer selects on the page.
9. **Editor state.** The store gains `publishRows`, `reminderEnabled` (true) and `newShareOrgIds`, outside the
   draft. In edit mode it loads the course's shares, the org list and the assignment count for "Đã giao trước đó".
   `publish()` and `createAndPublish()` send them; success clears them and reloads; a `CORE-VALIDATION_FAILED` with
   a field `assignments[i]` or `shareOrgIds[j]` marks that row or unit with the message.
10. **Branches.**
    - The backend builds on `course-final-exam`: branch `feat/course-publish-targets` from `feat/course-final-exam`
      (`61ff927`), in a new worktree `~/my-projects/corebanking-academy-publish-targets`. Its PR waits for the two
      earlier backend PRs.
    - The app stays on `feat/course-authoring`.
11. **Checkpoint data** goes through the API only. As `quantri`, on course 19 (`WIZ-FE-01`, which has an open draft
    revision): publish with a row for the learner `hocvien` (not yet enrolled in course 19) and a share to a unit
    other than org 1. Then a second draft with an empty-target row (an org with no active learner, or a learning
    group with no member) is refused on `assignments[0]` and stays a draft. `hocvien.tichhop` is already enrolled
    and is not used for the row.

## Phases

### Phase 1: Backend (child session, worktree `~/my-projects/corebanking-academy-publish-targets`) → Checkpoint A

- **B1. Request and shares.** `PublishRequest`, `PublishAssignment`, the endpoint body, the orchestration, the
  share step with the skip rule and the `shareOrgIds[j]` error.
- **B2. Assignments.** The assignment step with the values of Decision 6 and the `assignments[i]` error, including
  `AccessDeniedException`.
- **B3. Tests and docs.** The spec's integration tests (`CoursePublishTargetsIT`); `LEARNING.md` and
  `LEARNING_CURL.md`.
- **Checkpoint A (main session):**
  - review the diffs; restart :8019 from the new worktree;
  - run Decision 11 with `curl`: the enrollment, the assignment and the share exist after a good publish; the refused
    publish leaves a draft and no new assignment or share;
  - `{expectedVersion}` alone still publishes;
  - `mvn -o clean test` green, in a temporary worktree.

### Phase 2: App (child session, this checkout) → Checkpoint B

- **F1. Contracts and mock.** `PublishCourseCommandSchema`; the publish endpoint body; fixtures captured from the
  local backend; the mock publish applies rows and shares and refuses an empty target on `assignments[i]`.
- **F2. Shared picker.** The move of Decision 7; the assignments screen's specs pass unchanged in behaviour.
- **F3. Step 4.** The store state of Decision 9; the "Giao khóa học" and "Chia sẻ cho đơn vị khác" sections; the
  confirmation counts; the row error mapping; create mode.
- **F4. Docs.** The spec's implementation notes and the migration entry.
- **Checkpoint B (main session):**
  - review each diff, then `npm run check`;
  - in the browser as `quantri`: on a draft, add a row and a share, publish, see the toast and the reset; the learner
    sees the course in "Khóa học của tôi"; a refused row is marked;
  - "Giao học & hạn" still assigns with the moved picker;
  - 375, 768 and 1280 px, light and dark, keyboard.

## Before merging (the user)

- No SQL.
- Merge order:
  1. the `course-wizard-create` backend PR;
  2. the `course-final-exam` backend PR;
  3. this backend PR;
  4. wait for the deploy;
  5. the app PR.

## Risks

- **Long transaction.** A publish with 20 rows of 500 learners writes up to 10 000 enrollments in one transaction.
  The limits bound it; the IT measures nothing, but the checkpoint notes the time of one real publish.
- **Locks.** `assign` takes `lock.acquire` per course inside the publish transaction. The publish already holds the
  course row; the child checks that the same lock is re-entrant or taken once.
- **Idempotency keys.** `publish-{revisionId}-{index}` is unique per revision; a refused publish rolls the keys back
  with everything else, so a retry is clean.
- **Picker move.** It touches the assignments screen. Its specs are the guard; the checkpoint assigns once there.
