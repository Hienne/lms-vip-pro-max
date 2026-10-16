# Spec: Declarative drawer and editor seam

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

Four stores open drawers themselves: `UserEditorStore`, `RolesStore`,
`OrgStore` (unit and group) and `ShellStore` (mobile navigation). Each command
takes the body and footer `TemplateRef` from the view, calls `openDrawer` with
the CDK `Dialog`, keeps the returned handle in a private field, resets the
mutation, sets an `editing` state and subscribes to `closed` to clear it again.
The same nine lines are written five times. A store that takes `TemplateRef`
and holds an overlay handle cannot be reasoned about, or tested, without a DOM,
and the state (`editing`) and the drawer can in principle disagree.

Because the store needs the templates, the view has to forward them: `Roles`
and `Org` keep `viewChild` references to their templates only to pass them on,
and `UserEditor` exists mostly as a relay. Its public `open` and `toggleLock`
are called by the users and user-detail pages through
`viewChild(UserEditor)`.

The drawer footer (Hủy + Lưu bound to the form by `form="<id>"`, disabled while
saving) is written by hand four times. Each form gets its server errors through
`store.saveError$()?.details ?? {}`, five times.

While a save is in flight the user can still close the drawer with Esc, the
backdrop, the close button or Hủy. The request goes on, and the result lands on
a drawer that is no longer there.

## Solution

- **Drawer state lives in the store; the drawer is derived from it.** A store
  holds `editing…` state only. `edit…` sets it, `cancel…` clears it, and the
  save mutation clears it in `onSuccess`. Stores no longer take `TemplateRef`,
  no longer hold an overlay handle and inject `Dialog` only for `confirm()`.
- **`uiDrawer` directive in `@lms/ui`** on an `<ng-template>` opens the drawer
  while its condition is true and closes it when the condition turns false. It
  reports a dismissal by the user (`uiDrawerDismiss`), which the page maps to
  the store's cancel command. The footer is an optional template input; the
  drawer has no built-in actions.
- **Busy drawer.** While the page marks the drawer busy, an overlay with a
  spinner covers the body and footer, and every way the user can close it is
  blocked. The drawer closes when the save succeeds (state cleared) and stays
  open with the inline errors when it fails.
- **`ui-form-actions` molecule in `@lms/ui`**: the cancel and submit buttons of
  a form, bound by form id, with an extra-actions slot. Pages put it into the
  drawer footer.
- **`fieldErrors` on `serverMutation`** gives forms a ready
  `Record<string, string>`, so templates no longer unpack `AppError`.

## User Stories

1. As an administrator, I want the add and edit drawers for users, roles, units and groups to open and close as they do today, so that the refactor changes nothing I rely on.
2. As an administrator, I want the drawer to close by itself after a successful save, so that I return to the updated list.
3. As an administrator, I want the drawer to stay open with the server's field errors under the right fields when a save fails, so that I can correct and resubmit.
4. As an administrator, I want a visible "Đang lưu…" overlay while a save is in flight, so that I know the system is working.
5. As an administrator, I want Esc, the backdrop, the close button and Hủy to do nothing while a save is in flight, so that I cannot lose track of a save half way.
6. As an administrator, I want the drawer to accept closing again as soon as the save fails, so that I am not stuck.
7. As an administrator, I want the buttons of the page behind the drawer to be unreachable while the drawer is open, so that I cannot start a second action by accident.
8. As an administrator editing a user, I want "Đặt lại mật khẩu" to keep working while the form is open, without blocking the form, so that I can reset and keep editing.
9. As an administrator, I want a reopened drawer to show no error from the previous attempt, so that the form starts clean.
10. As an administrator, I want the unit drawer and the group drawer never to be confused with each other, so that I save the entity I opened.
11. As an administrator, I want the drawer title to name what I am editing ("Sửa vai trò …", "Thêm phòng/nhóm vào …"), as today, so that I know where I am.
12. As a keyboard user, I want focus trapped in the drawer and returned to the button that opened it, so that I keep my place.
13. As a screen-reader user, I want the busy state announced and the drawer marked busy, so that I know why nothing responds.
14. As a learner or administrator on a narrow screen, I want the navigation drawer to open from the menu button and close when I navigate, as today, so that mobile navigation is unchanged.
15. As a developer, I want a store with no `TemplateRef`, no overlay handle and no `Dialog` except for `confirm()`, so that the store reads as state and commands only.
16. As a developer, I want "is the drawer open" to be one store signal, so that the state and the screen cannot disagree.
17. As a developer, I want to open a drawer by setting state and to close it by clearing state, so that closing after a save is a state change in `onSuccess`, not an imperative call.
18. As a developer, I want the page to call store commands directly (`store.edit(user)`), so that no component exists only to relay templates.
19. As a developer, I want one declarative drawer API with the footer as an optional input, so that a drawer can host a form, a detail view or navigation.
20. As a developer, I want `ui-form-actions` with required labels, so that `@lms/ui` holds no screen copy and every screen still writes the mockup's words.
21. As a developer, I want `ui-form-actions` to take an extra-actions slot, so that "Đặt lại mật khẩu" fits without a second footer component.
22. As a developer, I want `serverMutation` to expose field errors as a plain record, so that templates bind `[serverErrors]` without unpacking `AppError`.
23. As a developer, I want `@lms/ui` to know nothing about stores, `AppError` or saving, only "open", "busy" and "dismissed", so that the library stays presentation-only.
24. As a developer, I want `openDrawer` to be internal to `@lms/ui`, so that there is exactly one way to show a drawer.
25. As a developer, I want the design-system page to demonstrate the directive, so that the reference shows the recommended usage.
26. As a developer, I want the conventions to state the new rule, so that the next screen (courses, exams, reports) follows it without reading this spec.
27. As a reviewer, I want the existing page specs to pass without changed assertions, so that I can trust the refactor kept behaviour.

## Implementation Decisions

### `uiDrawer` directive (`@lms/ui`, organisms/drawer)

- An attribute directive on `<ng-template>`; the template is the drawer body.
  It does not own DOM; the existing `Drawer` component, opened in a CDK
  dialog, still renders the panel.
- Inputs:
  - `uiDrawer: boolean`: open while true.
  - `uiDrawerTitle: string` (required): heading and accessible name.
  - `uiDrawerFooter?: TemplateRef<DrawerContext>`: optional actions under the
    body. No default footer.
  - `uiDrawerSide?: 'start' | 'end'` (default `end`).
  - `uiDrawerBusy?: boolean` (default `false`).
  - `uiDrawerBusyLabel?: string`: text of the busy overlay, read by screen
    readers. The library ships no default copy.
- Output `uiDrawerDismiss: void`: emitted only when the user closes the
  drawer (Esc, backdrop click, the close button, or `close()` from the
  template context). It is **not** emitted when the drawer closes because
  `uiDrawer` became false, nor when the directive is destroyed.
- `true → false` closes the dialog even while busy: busy blocks the user,
  never the state. This matters because `serverMutation` runs `onSuccess`
  before `isPending` turns false.
- Title, footer, busy and busy label are live: a change while open updates the
  open drawer.
- The directive is destroyed with its view and then closes its dialog.

### Busy behaviour (`Drawer` component)

- Busy sets `DialogRef.disableClose`, which blocks Esc and the backdrop.
  `disableClose` does not block `DialogRef.close()`, so the close button is
  disabled and the template context's `close()` is a no-op while busy.
- An overlay with a spinner covers the body and the footer; the header stays
  visible. The panel gets `aria-busy="true"` and the busy label is announced.
- Clicks outside the panel already land on the modal backdrop; focus is
  trapped; CDK sets `aria-hidden` on the overlay's siblings. Nothing extra is
  needed for the page behind.

### `openDrawer`

- Stays as the directive's implementation but is no longer exported from
  `@lms/ui`. `DrawerContext` stays exported (footer templates use
  `let-close="close"`).

### `ui-form-actions` molecule (`@lms/ui`)

- A component (it owns two buttons). Inputs: `formId` (required),
  `submitLabel` (required), `cancelLabel` (required), `saving` (disables the
  submit button). Output `cancel`.
- Content projection for extra actions, placed at the start of the row
  (user editor: "Đặt lại mật khẩu").
- It knows nothing about stores or errors. In a drawer footer:
  `(cancel)="close()"`, which reaches `uiDrawerDismiss`.

### `serverMutation` (app `core/data-access`)

- Adds `fieldErrors: Signal<Readonly<Record<string, string>>>`: the last
  error's `details`, or `{}`. No other change to the primitive.

### Stores

- **Shape.** Each drawer is one state key with its setter. Commands:
  `edit…(entity | null)` resets the mutation and sets the key;
  `cancel…()` clears it; the save mutation's `onSuccess` clears it.
  Selectors: the state key, a title selector (`…EditorTitle$`, built from the
  key, Vietnamese copy as today), `saveFieldErrors$` from `fieldErrors`, and
  `isSaving$` as today.
- **`RolesStore`**: `editing` → `edit(role)`, `cancelEdit()`,
  `editorTitle$`.
- **`OrgStore`**: two independent keys, `editingUnit: { unit } | null` and
  `editingGroup: { unit, group } | null`, each with its own setter, commands
  (`editUnit`/`cancelUnitEdit`, `editGroup`/`cancelGroupEdit`), title
  selector and field-error selector. The unit mutation clears only
  `editingUnit`; the group mutation clears only `editingGroup`. No code keeps
  them exclusive: the modal backdrop already prevents opening the second.
  `saveGroup` reads the unit from `editingGroup`.
- **`UserEditorStore`**: `edit(user)`, `cancelEdit()`, `editorTitle$`,
  `saveFieldErrors$`. `toggleLock` and `resetPassword` unchanged.
- **`ShellStore`**: `navOpen` stays the state; `openNav()` takes no argument;
  `closeNav()` clears it. Closing on navigation no longer calls a handle from
  an `effect`: `navOpen` resets when the current path changes (a
  `linkedSignal` over the path inside `state`).
- `confirm()` stays in commands, unchanged ("Confirm dialogs live in
  commands").

### Views

- **Roles, Org**: drop the `viewChild` templates and the forwarding methods.
  The body template carries `[uiDrawer]`, title, busy (`isSaving$`), busy
  label "Đang lưu…", the footer template with `ui-form-actions`, and
  `(uiDrawerDismiss)` → the store's cancel command. Forms bind
  `[serverErrors]` to the store's field-error selector.
- **`UserEditor`**: a render-only component holding the drawer template and
  the footer with the reset button in the extra-actions slot. No public
  methods. Busy is `isSaving$()` only; the reset button keeps its own
  `isResetting$()` disabled state.
- **Users, UserDetail**: inject `UserEditorStore` (already provided by the
  page) and call `store.edit(user)` / `store.toggleLock(user)` directly; the
  `viewChild(UserEditor)` goes away.
- **App shell**: the navigation template carries `[uiDrawer]="navOpen$()"`,
  `uiDrawerSide="start"`, title "Điều hướng chính", no footer, dismiss →
  `closeNav()`.
- **Design system**: the drawer demo uses the directive; its catalogue entry
  for the drawer is updated.

### Docs

- `angular.md` §5: "Close a drawer … from `onSuccess`" becomes "close a drawer
  by clearing its state in `onSuccess`". New rule: a store never takes a
  `TemplateRef` and never holds an overlay handle; it injects `Dialog` only for
  `confirm()`. The drawer is opened by state through `uiDrawer`.
- `ui-library.md`, overlays table: drawer → `uiDrawer` directive (CDK
  `Dialog`, busy, dismiss); add `ui-form-actions` to the molecules.
  `mockup-to-angular.md` already points its drawer rows at that table, so it
  needs no edit.

## Testing Decisions

Tests assert external behaviour through public interfaces: what the user sees
and does in the DOM, and what a store or primitive exposes. No test reads a
private field or a `DialogRef`.

1. **`uiDrawer` spec (new, `@lms/ui`).** A host component toggles the
   condition. Covers: true opens with title, body and footer; false closes
   and emits no dismiss; Esc, backdrop click, the close button and context
   `close()` each emit dismiss; while busy, all four are blocked, the overlay
   and `aria-busy` are present and the busy label is rendered; while busy,
   false still closes; title and busy changes update an open drawer; focus
   returns to the opener; destroying the host closes the dialog.
2. **`ui-form-actions` spec (new).** Labels rendered; the submit button has
   `type="submit"` and `form` set to `formId`; `saving` disables it; cancel
   emits; projected extra actions render first.
3. **`serverMutation` spec (extended).** `fieldErrors` is `{}` before a run
   and after success, holds `details` after an inline failure, and returns to
   `{}` after `reset()`.
4. **Page specs (existing: users, user-detail, org, roles, app shell).** They
   already drive real stores against `HttpTestingController` and open, save
   and close drawers through the DOM. They must pass without changed
   assertions; any changed assertion means behaviour changed and is listed in
   the PR. Each admin-org page adds one case: while a save is pending, Esc
   does not close the drawer, and the drawer closes after the response.
5. No new per-store specs; stores stay covered through their pages, as the
   convention does today.

Prior art: `drawer.spec.ts`, `confirm-dialog` spec, `server-mutation.spec.ts`,
`roles.spec.ts`, `org.spec.ts`, `app-shell.spec.ts`.

## Out of Scope

- `confirm()` dialogs: they stay inside store commands.
- Blocking route changes while a save is pending (a `canDeactivate` guard).
  With the browser's Back button, CDK disposes the overlay on navigation
  regardless of `disableClose`; the page and its store are destroyed and the
  request is cancelled client-side, with no toast. Accepted; returning to the
  page reloads the server's truth. A guard, if wanted, is a separate change
  for every form.
- Blocking the form during "Đặt lại mật khẩu".
- Field error display inside `Field` (architecture review candidate 05).
- Modal dialogs other than drawers.

## Further Notes

- Origin: architecture review of 15/10/2026, candidate 03 ("the drawer editor
  seam: the store holds a TemplateRef"), grilled on 16/10/2026. By then
  candidates 01 and 02 had landed (`serverData`, `serverMutation`,
  `invalidation`, `EndpointClient`), so closing, toasting and reloading after
  a save were already one place and are not part of this change.
- Decided in that session: state-derived drawer (not a store-side port, not a
  component-side imperative open); `@lms/ui` handles only UI concerns (open,
  busy, dismissed), never errors or saving; footer is an input, never a
  built-in Hủy/Lưu; two independent state keys in `OrgStore`; `openDrawer`
  made internal; everything shipped as one pull request.
- **Deviations from the mockup.** The mockup's drawer has no busy state and
  can always be closed. The busy overlay and the blocked close while saving
  are new, on purpose; the verify step in `mockup-to-angular.md` should not
  flag them.
- Done means: `npm run check` is green, the angular.md §14 checklist passes,
  the specs above exist, and a smoke test in the browser covers add and edit
  on users, user detail, roles, units and groups (including a failed save with
  inline errors and Esc blocked during a save) and the mobile navigation
  drawer, with screenshots.
