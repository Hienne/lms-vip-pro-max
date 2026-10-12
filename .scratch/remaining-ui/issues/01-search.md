# 01: Search molecule

**What to build:** `ui-search`: a search input atom inside `.input-icon` with the search icon, an accessible name input, a placeholder (default "Tìm kiếm…") and a width. Emits the value through a debounced output and an immediate one on Enter/clear. Replaces the search placeholder in **Form & nhập liệu**. See spec: `docs/specs/remaining-ui.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Native `input type="search"` with `aria-label`; icon decorative
- [x] Debounced output emits once per pause; Enter and clearing emit immediately
- [x] Spec covers ARIA, debounce (fake timers) and immediate emits
- [x] Demo matches the mockup copy; checklist entry `search` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green (format:check flags only the untracked `.claude/launch.json`); own pull request pending
