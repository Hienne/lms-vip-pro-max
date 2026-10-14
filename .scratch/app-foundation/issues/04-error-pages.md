# 04: 403 and 404 pages

**What to build:** in `features/errors`, the forbidden page (lock, "Bạn không có quyền truy cập trang này", the allowed roles from navigation state, "Về trang chủ của tôi" and "Quay lại") and the not-found page (path, "Mã lỗi 404", "Về trang chủ") on `ui-empty`; wildcard route. Checklist route entries for 403 and 404 updated. See spec.

**Blocked by:** 03 — Route table, guards, appCan and placeholders

**Status:** ready-for-agent

- [x] Copy matches `pages/auth.js`
- [x] Back action uses history; home goes to the role home
- [x] Specs cover both pages' copy and actions
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark, keyboard only
- [x] `npm run check` green; own pull request
