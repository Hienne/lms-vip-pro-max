# 03: Profile failures show a toast

**What to build:** When the backend refuses a profile save or a password change (for example a wrong current password), the learner sees a toast with the backend's title and message. Today these refusals only reach the form through field-level `details`. Once those are gone they would fail silently.

- `ProfileStore`'s two raw `rxResource` mutations (save profile, change password) move to `serverMutation` with `errors: 'toast'`. The success toasts, the session restore after a save and the password form reset after a change stay as they are.
- The password form loses its `serverErrors` input. The profile page stops merging `saveError$().details` into the name field's messages.
- The profile page spec moves to the envelope test provider and flushes envelopes.

See spec: `docs/specs/response-envelope.md`, Implementation Decisions → Error display policy, Forms.

**Blocked by:** 01

**Status:** done

- [x] Profile spec: a profile save answered with an `ERROR` envelope shows a toast with title and message, and the form keeps its values
- [x] Profile spec: a password change answered with an `ERROR` envelope shows a toast, and the password fields are not cleared
- [x] Profile spec: a successful save still restores the session and shows "Đã lưu hồ sơ"; a successful change still clears the password form and shows "Đã đổi mật khẩu"
- [x] `ProfileStore` has no raw `rxResource` mutation, and the password form has no `serverErrors` input
- [ ] Browser on the mock: save the profile and change the password, each with its success toast
  - Not checked in the browser; the profile spec drives both commands through the DOM.
- [x] `npm run check` green
