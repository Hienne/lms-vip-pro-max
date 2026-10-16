# 02: Busy drawer while a role is saving

**What to build:** While a role save is in flight, the drawer shows an overlay with a spinner and "Đang lưu…" over the body and footer, and the administrator cannot close it by Esc, the backdrop, the close button or Hủy. When the save fails the overlay goes and the drawer stays open with the inline errors; when it succeeds the drawer closes. `uiDrawer` gains `uiDrawerBusy` and `uiDrawerBusyLabel` (no default copy). Busy sets `disableClose` (Esc, backdrop) and also disables the close button and makes the context `close()` a no-op, because `disableClose` does not block `DialogRef.close()`. The panel gets `aria-busy` and the label is announced. Busy never blocks the state: the condition turning false closes the drawer even while busy. The roles page passes `isSaving$()` and "Đang lưu…". See spec: Implementation Decisions → Busy behaviour; Further Notes → Deviations from the mockup.

**Blocked by:** 01

**Status:** done

- [x] `uiDrawer` spec: while busy, Esc, backdrop, close button and context `close()` are all blocked; overlay, `aria-busy` and the label are present; false still closes while busy; a busy change updates the open drawer
- [x] Roles page spec adds: while a save is pending, Esc does not close the drawer, and the drawer closes after the response
- [x] Existing roles assertions unchanged (including the 422 case that keeps the drawer open)
- [x] `npm run check` green
