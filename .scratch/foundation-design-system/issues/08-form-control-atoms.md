# 08: Form control atoms

**What to build:** `uiInput`, `uiSelect`, `uiTextarea`, `uiCheckbox` and
`uiSwitch` as attribute directives on the native controls, so Signal Forms
binding, `required`, `disabled` and `aria-*` work untouched. Sizes, invalid
state (from `aria-invalid`) and disabled state match the mockup; checkbox
and switch keep native keyboard behaviour. The **Form & nhập liệu** section of
`/design-system` demos each control; demos that need `ui-field`, search,
dropzone or upload stay as placeholders. See the spec: `@lms/ui` atoms.

**Blocked by:** 02 — Migration checklist and progress board

**Status:** ready-for-agent

- [ ] Each directive applies the mockup's look from its own partial; `sm` size and invalid and disabled states match the mockup
- [ ] Controls keep native semantics; checkbox and switch are real checkboxes, the switch exposes switch semantics to assistive technology
- [ ] Specs cover classes per size and state, invalid styling driven by `aria-invalid`, and the switch role
- [ ] **Form & nhập liệu** section demos every control with the mockup's copy; molecule demos remain placeholders from the checklist
- [ ] Keyboard pass: Tab order, Space toggles checkbox and switch, focus ring visible
- [ ] Checklist entries `done` with owner, pull request and the checks performed
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [ ] `npm run check` green; merged through its own pull request
