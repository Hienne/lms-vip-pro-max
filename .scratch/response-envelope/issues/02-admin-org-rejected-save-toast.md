# 02: Admin-org rejected saves show a toast and keep the drawer open

**What to build:** When the backend refuses an admin-org save (duplicate email, unit code in use, role name taken), the administrator sees a toast with the backend's title and message. The drawer stays open with their input, so they can fix it and save again.

- The user editor, unit, group and role saves switch from `errors: 'inline'` to `errors: 'toast'`.
- The `serverErrors` input leaves the user, unit, group and role forms and their page bindings. Each form's error computeds keep only the touched validator messages until ticket 06.
- `serverMutation.fieldErrors` is removed.
- The user-detail page offers retry unless the error kind is `server`.
- The users, user-detail, org and roles page specs move to the envelope test provider and flush envelopes with the helpers from 01.

See spec: `docs/specs/response-envelope.md`, Implementation Decisions → Error display policy, Forms, `AppError` (retry rule).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Users page spec: a save answered with an `ERROR` envelope shows a toast with title and message, the drawer stays open, and the form keeps its values
- [ ] Org page spec: the same for unit save and group save; deleting a group refused by the backend shows its toast
- [ ] Roles page spec: the same for role save
- [ ] User-detail spec: a `server` error shows no retry button, an `unknown` error shows one
- [ ] No admin-org form has a `serverErrors` input, and `serverMutation` has no `fieldErrors`
- [ ] `serverMutation` spec drops its `fieldErrors` cases
- [ ] The four admin-org page specs flush envelopes only; assertions about field-level server messages are removed, and any other changed assertion is listed in the PR
- [ ] Browser on the mock: as admin, add a user, a unit, a group and a role, each closing with its success toast
- [ ] `npm run check` green
