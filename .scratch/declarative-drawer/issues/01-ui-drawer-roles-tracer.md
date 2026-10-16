# 01: Tracer bullet: the roles screen on `uiDrawer`

**What to build:** The add and edit role drawer opens and closes from `RolesStore` state alone. `@lms/ui` gets the `uiDrawer` directive on `<ng-template>` (open condition, required title, optional footer template, side, `uiDrawerDismiss` emitted only on a user close) and the `ui-form-actions` molecule (required `formId`, `submitLabel`, `cancelLabel`; `saving`; `cancel` output; extra-actions slot). `serverMutation` gains `fieldErrors`. `RolesStore` drops `TemplateRef` and the drawer handle: `edit(role)` resets the mutation and sets `editing`, `cancelEdit()` clears it, the save mutation clears it in `onSuccess`; it exposes `editorTitle$` and `saveFieldErrors$`. The roles page drops its `viewChild` templates and forwarding method, binds the drawer to `editing$`, maps dismiss to `cancelEdit()` and uses `ui-form-actions` in the footer. Busy is not part of this ticket (see 02). See spec: `docs/specs/declarative-drawer.md`, Implementation Decisions → `uiDrawer`, `ui-form-actions`, `serverMutation`, Stores.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `uiDrawer` spec through a host component: true opens with title, body and footer; false closes without dismiss; Esc, backdrop, close button and context `close()` each emit dismiss; a title change updates the open drawer; focus returns to the opener; destroying the host closes the dialog
- [ ] `ui-form-actions` spec: labels; submit has `type="submit"` and `form` = `formId`; `saving` disables it; cancel emits; projected extra actions render first
- [ ] `serverMutation` spec: `fieldErrors` is `{}` before a run and after success, holds `details` after an inline failure, `{}` after `reset()`
- [ ] `RolesStore` imports neither `TemplateRef` nor `openDrawer`; `Dialog` remains only for `confirm()`
- [ ] Roles page spec passes without changed assertions
- [ ] `npm run check` green
