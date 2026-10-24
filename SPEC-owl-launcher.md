# Spec: `owl-launcher` (frontend, Phase 4)

Map: [SPEC.md](SPEC.md). Changes the shipped owl of [SPEC-owl-indicator.md](SPEC-owl-indicator.md) so it opens and
closes the panel of [SPEC-chat-widget.md](SPEC-chat-widget.md).

## Objective

One anchor in the corner. A click on the owl opens or closes "Trợ lý nhanh"; the owl keeps every processing state
it has today (chewing, smiling once, the failed face, the bubble), so document progress and the chatbot share one
place without overlapping.

## Behaviour

| Situation                                | Owl button click                   | Bubble ("Đã xử lý xong tài liệu …")                                                                 |
| ---------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| widget available, panel closed           | `AgentChatStore.open()`            | shown as today; its link "Mở trợ lý" still goes to `/assistant`                                     |
| widget available, panel open             | `AgentChatStore.close()`           | hidden while the panel is open (it would sit under it); the screen-reader announcement still speaks |
| widget not available (no `AI_ASSISTANT`) | as today: navigate to `/assistant` | as today                                                                                            |
| on `/assistant` (`quiet`)                | not rendered, as today             | not rendered, as today                                                                              |

- The click no longer dismisses the finished-document notice; only the bubble's close button, `Escape` on the bubble
  and the bubble's link do, as specified in `owl-indicator`.
- Button accessibility: `aria-expanded` bound to `isOpen$`, `aria-controls` the panel's id (only while it is
  rendered), `aria-label` "Mở Trợ lý nhanh" / "Đóng Trợ lý nhanh", followed by ", đang xử lý N tài liệu" while
  processing. The tooltip shows the same words and is suppressed while the panel is open.
- The owl stays above the panel in stacking order and keeps its place; the panel is anchored to it (gutter and
  owl height from the same tokens), so the dev-toolbar offset (`besideToolbar`) moves both.
- No new motion: the open or closed state is carried by `aria-expanded` and a 1px `border` in `primary` on the
  button while open, not by an animation.

## Project structure

```text
apps/lms/src/app/layout/owl/          owl.ts, owl.html, owl.scss, owl.spec.ts (changed)
apps/lms/src/app/layout/shell/        app-shell.html, app-shell.scss (renders <app-chat-widget> beside <app-owl>)
```

## Testing

- `owl.spec.ts`: click toggles the store when available and navigates to `/assistant` when not; `aria-expanded`
  and the labels follow the state, including the processing count; the bubble hides while open and returns on close;
  a click does not dismiss the finished notice; the existing state specs (chewing, smile, failed) pass unchanged.
- `app-shell.spec.ts`: the widget renders beside the owl and not on `/assistant`; with the dev toolbar both move.

## Boundaries

- Always: the owl keeps no state of its own (the tracker and the chat store own it); the `owl-indicator` motion rules
  (D4 of the previous map) stand.
- Ask first: a second floating button; moving the owl out of the corner.
- Never: an unread dot, a badge count or a pulse on the owl for chat messages.

## Success criteria

`npm run check` green; angular.md §14 and the visual-design checklist pass; in the browser: upload a file, open the
panel while the owl chews, ask a question, close the panel and see the smile and bubble when processing ends; keyboard
only: Tab to the owl, Enter opens with focus in the composer, Escape closes with focus back on the owl.

## Implementation notes (as built)

- Without the assistant function the owl keeps its old click (go to `/assistant` and clear the finished notice), so its
  existing specs run unchanged; the new behaviour is a second `describe` that turns the assistant on.
- Labels: "Mở Trợ lý nhanh" / "Đóng Trợ lý nhanh", plus ", đang xử lý N tài liệu"; the tooltip repeats the words and is
  empty while the panel is open.
- Checked live: the owl chews and names the count while the panel is open. The smile and bubble after processing, and the
  bubble hiding while the panel is open, are covered by specs only: the ready notice dismisses itself after a few seconds, too
  short to catch in the browser with a small document.
