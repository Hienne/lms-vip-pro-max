# 09: Sortable list molecule

**What to build:** a sortable list on CDK drag-drop: list and item directives with a `.drag-handle` (grip icon), `is-dragging`/`is-over` styles, and move up/down icon buttons ("Chuyển lên"/"Chuyển xuống") disabled at the ends. Emits `moved` `{ from, to }`; never mutates its input. Adds a `sortable` entry to the checklist and moves `.sort-item` out of `feature-misc` in the inventory. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Inventory row and checklist updated: `.sort-item`, `.drag-handle` → `@lms/ui` molecule
- [x] Drag by handle and move buttons both emit `moved`; focus stays on the moved item's button
- [x] Move is announced through `LiveAnnouncer` ("Đã chuyển … lên vị trí n")
- [x] Spec covers move buttons, disabled ends, output and announcement; pointer drag checked in the browser and noted in the PR
- [x] Demo copies the lesson list sample; checklist entry done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
