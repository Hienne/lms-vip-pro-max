# 02: Units and groups screen on the primitives

**What to build:** The units and groups screen (`OrgStore`) runs on the primitives and behaves exactly as today: the org list reloads on the store's token and stays on screen while reloading; save unit and save group are inline (drawer closed from `onSuccess`, "Đã lưu"); change unit status ("Đã cập nhật") and delete group ("Đã xóa") are toast. Confirm dialogs and the `canManageUnits$` selector stay as they are. See spec: `docs/specs/admin-data-access.md`.

**Blocked by:** 01 (primitives through the roles screen)

**Status:** done

- [x] `OrgStore` uses only the primitives for API calls; `state` holds only screen state
- [x] Org page spec passes without edits
- [x] Smoke test against Prism: add and edit a unit and a group, pause/resume a unit, delete a group
- [x] `npm run check` green
