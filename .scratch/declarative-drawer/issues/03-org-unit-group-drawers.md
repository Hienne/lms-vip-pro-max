# 03: Org screen: unit and group drawers

**What to build:** The add/edit unit drawer and the add/rename group drawer open from state, show the busy overlay while saving and close on success, as roles do after 02. `OrgStore` replaces its shared `editing` with two independent state keys, `editingUnit` (`{ unit } | null`) and `editingGroup` (`{ unit, group } | null`), each with its own setter, `editUnit`/`cancelUnitEdit` and `editGroup`/`cancelGroupEdit`, a title selector and a field-error selector. The unit mutation clears only `editingUnit`, the group mutation only `editingGroup`; `saveGroup` reads the unit from `editingGroup`. No code keeps the two exclusive (the modal backdrop already does). The org page drops its `viewChild` templates and forwarding methods; both drawers use `uiDrawer` with busy and `ui-form-actions`. See spec: Implementation Decisions → Stores (`OrgStore`), Views.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `OrgStore` imports neither `TemplateRef` nor `openDrawer`; `Dialog` remains only for `confirm()`
- [ ] Org page spec passes without changed assertions
- [ ] Org page spec adds, for the unit drawer and the group drawer: while a save is pending, Esc does not close it, and it closes after the response
- [ ] `npm run check` green
