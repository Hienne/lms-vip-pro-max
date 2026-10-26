# Spec: `learning-reminders` (Phase 3)

Map: [SPEC.md](SPEC.md). Read `docs/conventions/angular.md`, `contracts-and-mocks.md`, `visual-design.md` and
`docs/migration/mockup-to-angular.md` first.

## Objective

A learner sees the deadline reminders the server has due for them on the "Thông báo" page, dismisses each one once
read, and sees how many are waiting on the header bell, on the real backend as well as on the mock.

Mockup: `auth.js` page `notifications` (README row E.3). Route `notifications` (an open route for any signed-in
user, not in the sidebar). Migration entry: `route-notifications`. Feature folder `features/account/notifications/`.

## What the backend offers (and does not)

- `GET /me/learning/reminders` returns only reminders that are **pending and due** (`scheduledAt` passed), on an
  active assignment whose enrollment is not completed. `POST …/reminders/{id}/read` sets the reminder to `sent`, so
  it leaves the list. There is no read history and no other notification kind (exam results, instructor replies):
  the mockup's "Tất cả / Chưa đọc" tabs have nothing to show and are not built.
- A reminder (`LearningReminderView`) has `recipientId`, `scheduledAt` and `dueAtSnapshot`, but **no course id,
  title or enrollment**. The app cannot name the course or link to it (Open question 1).
- Both endpoints require the learner role with `OWN` scope; anyone else gets 403.

## Endpoints

| Key (registry)                      | Endpoint                                               | Change             |
| ----------------------------------- | ------------------------------------------------------ | ------------------ |
| `learnerEndpoints.reminders`        | `GET /api/v1/me/learning/reminders`                    | none; first caller |
| `learnerEndpoints.markReminderRead` | `POST /api/v1/me/learning/reminders/{reminderId}/read` | none; first caller |

`LearningReminderSchema.status` becomes `z.enum(['pending', 'sent', 'cancelled'])`.

## Screen (`notifications`)

```text
apps/lms/src/app/features/account/notifications/
├── notifications.ts|html|scss|spec.ts
└── data-access/notifications.store.ts (+ spec)
```

Store (`NotificationsStore`):

- `reminders = serverData(reminders)`, idle (`params` returns `undefined`) when the signed-in user has no
  `COURSE_LEARNING` function; a 403 is read as an empty list, not an error.
- `markRead = serverMutation(markReminderRead, { errors: 'toast', invalidates })`; `markAllRead()` runs it for each
  shown reminder one after another (the backend has no bulk call), stops at the first refusal, and reloads once.
  Both bump the shared `remindersChanged` token (below) so the bell updates.
- Selectors: `items$` sorted by `dueAtSnapshot` ascending, each with `isOverdue` (due date before now, from the
  shared `now` clock in `shared/course/now.ts`), `count$`.

View (narrow page, as the mockup):

1. `ui-page-header`: h1 "Thông báo", description "Nhắc hạn các khóa học được giao.", action "Đánh dấu đã đọc tất cả"
   (secondary, only when there is more than one item). The mockup's eyebrow "Hộp thư" and its list of notification
   kinds the backend does not have are dropped.
2. `ul[uiList]`, one item per reminder, no icon tile and no tinted unread background:
   - Line 1 (medium weight): "Khóa học được giao sắp đến hạn" or, when overdue, "Khóa học được giao đã quá hạn".
   - Line 2 (muted, `sm`): "Hạn hoàn thành dd/MM/yyyy · nhắc lúc <relative time of `scheduledAt`>"; the date in the
     danger text token when overdue (state, not decoration).
   - Actions on the right: link "Xem khóa học của tôi" → `/progress?sort=dueAt,asc` (with `overdue=true` when
     overdue), and the icon button "Đánh dấu đã đọc" (`check`, tooltip) → `markRead`. Only the link is shown in the
     row at narrow widths; the button stays reachable by keyboard.
3. Empty: inline muted "Không có nhắc hạn nào." Loading: skeleton rows. Error: `ui-error-state` with retry.

## The bell count

`ShellStore` asks `navCounts` only while it is served (the mock). On the real backend the bell shows nothing today.
Change: while `navCounts` is not served, `ShellStore` reads `learnerEndpoints.reminders` for a user with
`COURSE_LEARNING` and uses its length as `unread$`; on the same triggers as today (sign-in and navigation) and on the
`remindersChanged` token. The token is an `invalidation()` owned by a small root service
`core/learning/reminders-changed.ts` (it holds a change counter, not data, so it is not a store), which
`NotificationsStore` bumps after a read. A 403 or any error reads as 0 and logs nothing to the user. The mock keeps
answering `navCounts`, and its `notifications` count becomes the number of the caller's due reminders so the two
modes agree.

## Mock

- Fixtures: three due reminders for `hocvien` (one overdue, two upcoming), one not yet scheduled (never listed),
  none for the admin accounts.
- `LearningBackend` answers `reminders` (pending and due, for the caller's own recipients) and `markReminderRead`
  (sets `sent`; another user's reminder answers 403 as the backend does).

## Testing

- `notifications.store.spec.ts`: idle for a user without `COURSE_LEARNING`; 403 reads as empty; mark one removes it
  after the reload; mark all calls once per item in order and stops at a refusal; both bump `remindersChanged`.
- `notifications.spec.ts`: sorted items, overdue wording and colour, the progress link with its query, empty, error
  with retry, keyboard reach of the read button.
- `shell.store.spec.ts`: the bell uses the reminders count when `navCounts` is not served, refreshes on the token,
  shows 0 on 403.

## Boundaries

- Always: the server decides which reminders are due; one feedback per action (the item leaving the list, no extra
  toast on success).
- Ask first: inventing a link to a specific course from other data (Open question 1); polling for new reminders.
- Never: show a reminder count the server did not return; a tinted background or icon tile for unread items.

## Success criteria

1. Local backend, as a demo learner with a due reminder: the bell shows the count; `notifications` lists it with
   the due date; "Đánh dấu đã đọc" removes it and the bell drops by one without a reload.
2. As an admin without the learner role: the page shows "Không có nhắc hạn nào." and no error, and the bell shows
   nothing.
3. Mock: the same flow with the three seeded reminders.
4. `npm run check` green; angular.md §14, the visual-design checklist and the migration verify step pass at 375,
   768 and 1280 px, light and dark, keyboard only; `route-notifications` marked `done`.

## Open questions

1. **Course on a reminder.** Ask the backend to add `courseId`, `courseTitle` and `enrollmentId` to
   `LearningReminderView`. With them each item names its course and links to `/course/:courseId`; until then the
   item links to the learner's progress table sorted by due date.
