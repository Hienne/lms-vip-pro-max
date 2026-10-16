# 03: User editor and users list on the primitives

**What to build:** The users list and the user editor run on the primitives and behave exactly as today. `UserEditorStore` creates an invalidation token and exposes it read-only instead of `changes$`; save user is inline ("Đã thêm người dùng" / "Đã cập nhật người dùng", drawer closed from `onSuccess`); lock/unlock is toast ("Đã khóa tài khoản" / "Đã mở khóa tài khoản"); password reset is toast with the destination from the result ("Đã gửi liên kết đặt lại mật khẩu" + `sentTo`) and invalidates nothing; admin meta is a `serverData`. `UsersStore` reads the editor's token for its list; filters, sort and paging stay as screen state. See spec: `docs/specs/admin-data-access.md`.

**Blocked by:** 01 (primitives through the roles screen)

**Status:** done

- [x] `UserEditorStore` and `UsersStore` use only the primitives for API calls; no change counter or `linkedSignal` left
- [x] A mutation in the editor reloads the users list through the shared token
- [x] Users page spec passes without edits
- [x] Smoke test against Prism: add and edit a user, lock and unlock, reset a password
- [x] `npm run check` green
