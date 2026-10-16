# 06: `ui-field` shows validator errors itself

**What to build:** A form declares its model, schema, `[formField]` bindings and submit, and nothing else. `ui-field` reads the projected control's Signal Forms state and shows its validator and async-validator messages once the field is touched (including after `submit()`), with the existing label, `aria-describedby`, `aria-required` and `aria-invalid` wiring.

- `ui-field` reads the control's state through `contentChild(FormField)`. It shows `state().errors()` messages only while `state().touched()`, and filters out empty messages.
- The `errors` input is removed. No pending indicator yet.
- Every `xxxErrors` computed and `messages()` / `touchedMessages` helper is removed from the user, unit, group, role, password, profile and design-system forms.
- The design-system forms section feeds `ui-error-summary` from the form's `errorSummary()`.
- `@lms/ui` gains a runtime dependency on `@angular/forms/signals`. The `Field` docstring and ui-library.md say so, and angular.md §6's example no longer checks `touched()` in the template.

See spec: `docs/specs/response-envelope.md`, Implementation Decisions → `ui-field`, Forms, Docs.

**Blocked by:** 02, 03, 04

**Status:** done

- [x] Field spec (host with Signal Forms): no messages before the field is touched
- [x] Field spec: messages appear after blur and after `submit()` on an untouched form
- [x] Field spec: an async validator's error is shown and wired the same way as a synchronous one
- [x] Field spec: `aria-invalid` and `aria-describedby` follow the messages and keep foreign `aria-describedby` tokens
- [x] No form component computes error messages, and `ui-field` has no `errors` input
- [x] Design-system forms section: "validate" shows the summary from `errorSummary()`, and each link focuses its control
- [x] Existing page specs for users, org, roles and profile pass without changed validation assertions
- [x] Browser on the mock: in the add-user drawer, a blurred empty name shows its message; pressing Save on an empty form shows every required message
- [x] angular.md §6, ui-library.md and the `Field` docstring match the new behaviour
- [x] `npm run check` green

Notes: the add-user drawer was checked in the browser (blurred empty name shows its message; Save on the empty form shows the name, email and group messages; unit and role have defaults). Field spec covers the async-validator case with `validateAsync`.
