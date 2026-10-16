# 04: User drawer on the users list and the user page

**What to build:** The add/edit user drawer opens from state on both the users list and the user page, shows the busy overlay while saving and closes on success. `UserEditorStore` replaces `edit(user, body, footer)` with `edit(user)` and `cancelEdit()`, drops the drawer handle, and exposes `editorTitle$` and `saveFieldErrors$`; `toggleLock` and `resetPassword` are unchanged. `UserEditor` becomes render-only with no public methods: it holds the drawer template and a footer of `ui-form-actions` with "Đặt lại mật khẩu" in the extra-actions slot. Busy is `isSaving$()` only; the reset button keeps its own `isResetting$()` disabled state and does not block the form. The users and user-detail pages call `store.edit(user)` and `store.toggleLock(user)` on the `UserEditorStore` they already provide, and drop `viewChild(UserEditor)`. See spec: Implementation Decisions → Stores (`UserEditorStore`), Views.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `UserEditorStore` imports neither `TemplateRef` nor `openDrawer`; `Dialog` remains only for `confirm()`
- [ ] Neither page uses `viewChild(UserEditor)`; `UserEditor` has no public methods
- [ ] Users and user-detail page specs pass without changed assertions
- [ ] Both specs add: while a save is pending, Esc does not close the drawer, and it closes after the response
- [ ] A pending password reset does not show the busy overlay
- [ ] `npm run check` green
