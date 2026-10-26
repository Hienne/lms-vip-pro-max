# Spec: `course-sharing` (Phase 6)

Map: [SPEC.md](SPEC.md). Read `docs/conventions/angular.md`, `contracts-and-mocks.md` and `visual-design.md` first.

## Objective

An author or admin who manages a course lets other units use it: share it with a unit (optionally its sub-units),
choose whether that unit may assign it and whether its staff may self-enrol, change those rights, and revoke the
share. Sharing grants use, never editing; revoking does not remove assignments already made.

Screen: the course list (`admin/courses`, `features/admin-content/courses/`), where the mockup puts "Chia sẻ cho đơn
vị" in the row menu (`admin-content.js` `shareDialog`). Decision for the map's "course editor or course list": the
list, as the mockup, beside "Sao chép khóa học", which already opens a drawer there.

## Endpoints

| Key (registry)                   | Endpoint                                | Change                                                                         |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `courseEndpoints.shares`         | `GET /api/v1/courses/{courseId}/shares` | none; first caller                                                             |
| `courseEndpoints.share`          | `PUT /api/v1/courses/{courseId}/shares` | command fields become required booleans, as the backend's record (no defaults) |
| `organizationEndpoints.listOrgs` | `GET /api/v1/orgs`                      | none; used to pick a unit and to name shared units                             |
| `courseEndpoints.getCourse`      | `GET /api/v1/courses/{courseId}`        | none; gives `course.ownerOrgId`, which the share list must not offer           |

```ts
/** LearningRequests.ShareRequest: one upsert per org; `active: false` revokes. */
export const ShareCourseCommandSchema = z.object({
  orgId: z.number().int().positive(),
  includeDescendants: z.boolean(),
  canAssign: z.boolean(),
  canSelfEnroll: z.boolean(),
  active: z.boolean(),
});
```

`CourseShareSchema.status` becomes `z.enum(['active', 'revoked'])`.

## UI

```text
apps/lms/src/app/features/admin-content/courses/components/course-shares/
├── course-shares.ts|html|scss|spec.ts
└── data-access/course-shares.store.ts (+ spec)
```

- `CoursesStore.menuFor` gains `{ value: 'share', label: 'Chia sẻ cho đơn vị', icon: 'globe' }` after "Sao chép
  khóa học"; it sets `state.sharing` to the row, which opens a `ui-drawer` "Chia sẻ khóa học" holding
  `app-course-shares`, the way `copying` opens the copy drawer.
- `CourseSharesStore` (provided by `app-course-shares`; input `courseId`):
  - `shares = serverData(shares)`; `course = serverData(getCourse)` for the owner org; `orgNames = serverData`
    reading `listOrgs` pages (size 100, at most 5) to name each shared `orgId`, unknown ids shown as "Đơn vị #<id>".
  - `state.adding` (the add form open or not), `state.orgQuery` (debounced 300 ms) → `orgOptions =
serverData(listOrgs { q, status: 'active', size: 20 })`, without the owner org and orgs already actively
    shared.
  - `save = serverMutation(share, { errors: 'toast', success: 'Đã cập nhật chia sẻ', invalidates })` for add, change
    and revoke (revoke is the same row with `active: false`, after `ui-confirm-dialog` "Thu hồi chia sẻ với
    <unit>?" / "Đơn vị này không giao thêm được khóa học. Các lượt giao đã có vẫn giữ nguyên.").
- Drawer body, top to bottom:
  1. One muted line: "Đơn vị được chia sẻ có thể sử dụng khóa học nhưng không sửa được nội dung." (from the
     mockup).
  2. The owner unit as text: "Đơn vị sở hữu: <name>".
  3. Active shares as a list, one row each: unit name; under it, as text, the rights that are on ("Gồm đơn vị con ·
     Được giao học · Học viên tự đăng ký"); a row `ui-menu` with "Sửa quyền" (opens the same three switches inline
     with "Lưu" / "Hủy") and "Thu hồi" (danger). Revoked shares are listed below under "Đã thu hồi" (muted, with
     `revokedAt`) with "Chia sẻ lại" in their menu.
  4. "Thêm đơn vị" (secondary) opens the add form: a combobox searching units (`@angular/aria` combobox over
     `orgOptions`, label "Đơn vị"), three switches ("Gồm cả đơn vị con", "Được giao khóa học cho học viên",
     "Học viên được tự đăng ký"; defaults: off, on, off), "Chia sẻ" (primary) and "Hủy".
  5. Empty: inline "Khóa học chưa được chia sẻ với đơn vị nào." Error: `ui-error-state` with retry.
- No chips for rights, no coloured badge for each right (visual-design: attributes are text); one feedback per save
  (the toast; the list reloads).

## Mock

`LearningBackend` already answers `shares` and `share`; its `share` is checked against the required booleans,
upserts by `orgId`, sets `revokedAt` on `active: false`, and refuses the owner org with `INVALID_REFERENCE`. The
mock `listOrgs` serves the seeded orgs.

## Testing

- `course-shares.store.spec.ts`: names from `listOrgs` and the fallback; options exclude the owner and active
  shares; add, change and revoke send the full command; revoke needs the confirm; a refusal toasts and keeps the
  form.
- `course-shares.spec.ts`: active and revoked sections, rights as text, keyboard use of the combobox and the switches.
- `courses.store.spec.ts`: the menu entry opens the drawer for that row and closing clears it.

## Boundaries

- Always: the server decides who may share and with whom; the full command on every PUT.
- Ask first: sharing from the course editor as well; bulk sharing.
- Never: offer the owner org; hide a refusal; treat sharing as edit rights anywhere in the UI.

## Success criteria

1. Local backend, as the content admin: share a course with another unit with "Được giao khóa học cho học viên";
   the list shows it; change it to add "Học viên được tự đăng ký"; revoke it and see it under "Đã thu hồi".
2. A learner of that unit sees the course in `catalog` while the self-enrol share is active, and not after revoke
   (unless assigned).
3. `npm run check` green; angular.md §14 and the visual-design checklist pass for the drawer at 375 and 1280 px,
   light and dark, keyboard only.

## Open questions

1. **Which units can an author see?** `GET /orgs` lists only the caller's scope. An author scoped to one branch can
   then share only within it, and shared units outside the scope show as "Đơn vị #<id>". If authors must share
   across branches, the backend needs a unit lookup for sharing (id, name, active), or the share view should carry
   the unit name.
