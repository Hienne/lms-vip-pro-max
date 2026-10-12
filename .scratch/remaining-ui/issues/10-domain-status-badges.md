# 10: Domain status badges

**What to build:** `CourseStatusSchema` in a new learning module of `@lms/contracts`, then `app-course-status` (with optional overdue badge), `app-publish-status`, `app-account-status` and `app-role-badge` (with "đơn vị" scoped suffix) in `apps/lms/src/app/shared/status/`, built on `uiBadge`. Replaces the domain badge placeholder in **Badge & trạng thái**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Label/tone/icon records are exhaustive over each zod enum (compile error on a missing value)
- [x] Labels, tones and dots copied from `components.js`
- [x] Specs cover every enum value per component and the contracts parse/reject cases
- [x] Demo shows every status; checklist entry `domain-status-badges` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
