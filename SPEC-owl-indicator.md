# Spec: `owl-indicator` (frontend, Phase 4)

Map: [SPEC.md](SPEC.md). Driven by [SPEC-doc-tracker.md](SPEC-doc-tracker.md).

## Objective

A small owl in the bottom-right corner of every app-shell page tells the user, without blocking anything,
that their documents are being processed and when each one is done, and takes them to the assistant.

## Look (D4, `visual-design.md`)

- Monochrome line-art in the spirit of Notion's AI icon: round head, two big eyes, a small beak, two ear
  tufts; one stroke width; `ui.color(text)` strokes on a `ui.color(surface)` round button with a 1px
  `ui.color(border)` and `ui.shadow(sm)` (it floats). 48 px at ≥ 768 px, 40 px below; `ui.space(4)` from
  the edges. No colour fill, no gradient, no tinted tile.
- Inline SVG in the component template (not an icon from Lucide), `aria-hidden="true"` on the SVG.

## States (from `DocumentTrackerStore.owlState$`)

| State        | Owl                                                        | Bubble (notice left of the owl)                                            |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `idle`       | still, eyes open                                           | none                                                                       |
| `processing` | mouth open with a small book, jaw chews in a loop (~1.2 s) | none; the tooltip says **Đang xử lý N tài liệu**                           |
| `done`       | smiles once (mouth curve, eyes become arcs), stays smiling | **Đã xử lý xong tài liệu <tên tệp>**, closes after 6 s or on ✕             |
| `failed`     | neutral face, no animation, no red                         | **Không xử lý được tài liệu <tên tệp>.** + **Xem chi tiết**, stays until ✕ |

If more documents are still pending when one finishes, the owl keeps chewing and the bubble still shows.

## Behaviour and accessibility

- The owl is a `button[uiIconButton]`-like control with an `aria-label` per state
  (**Trợ lý AI**, **Trợ lý AI: đang xử lý N tài liệu**, …) and a tooltip; clicking it or the bubble
  navigates to `/assistant` and calls `dismiss()`.
- A visually hidden `aria-live="polite"` region announces state changes (start of processing once, each
  finish).
- The host is `position: fixed` with `pointer-events: none`; only the owl and the bubble take pointer
  events, so nothing underneath is blocked beyond their own boxes. Its z-index sits below dialogs,
  drawers and toasts (from the overlay layer tokens).
- `/assistant` reserves bottom space on narrow screens so the owl never covers the **Hỏi** button.
- Shown only when `chrome === 'app'` and a user is signed in (not on sign-in, focus or bare layouts).
- `prefers-reduced-motion: reduce`: no chewing loop and no smile transition; each state is a static pose,
  and the text (tooltip, bubble, live region) carries the meaning.
- Motion uses `ui.duration` tokens; keyframes are local to the component's SCSS. The bubble opens like an
  overlay: `fast`, at most 4 px of movement.

## Structure

`apps/lms/src/app/layout/owl/owl.ts|html|scss|spec.ts` (`app-owl`), placed once in `app-shell.html`. It
reads `DocumentTrackerStore` selectors and calls its commands; no state of its own.

## Deliberate exceptions to `visual-design.md` (listed in the PR)

- A looping animation (chewing) while processing: a state indicator, comparable to the allowed `spin` on
  spinners, and it stops when nothing is pending. Idle is still (no blink).
- A small illustration in the shell: it is the status surface for background work, not decoration.

## Testing

Component spec with a fake `DocumentTrackerStore`: each state renders its pose class, label and bubble;
the live region text changes; click navigates and dismisses; failed bubble does not auto-close; hidden
when signed out or on non-app layouts; reduced-motion class switches off the animation (asserted via the
`matchMedia` stub).

## Verify

Visual-design checklist at 375 and 1280, light and dark, every palette; keyboard: Tab reaches the owl,
Enter opens the assistant, Escape closes the bubble; the owl never blocks a click on content around it.

## Success criteria

During Phase 5's upload of three files the owl chews while the user browses, then shows the done bubble
for each, and clicking it opens the assistant.

## Implementation notes (as built)

- The notice sits left of the owl in one row of text + link ("Mở trợ lý" or "Xem chi tiết") + ✕. A `done` notice closes after
  6 s through the tracker (`dismiss()`); a `failed` one stays until ✕, the link or Escape.
- Toasts and the owl share the bottom-right corner, so `.toasts` gets a larger bottom margin (`_toast.scss`) and the stack
  starts above the owl and its notice. The dev toolbar sits in the same corner in development: `besideToolbar` moves the owl
  left of it (the shell sets it when the toolbar is loaded).
- Poses are one inline SVG; the state is exposed as `data-state` and as the button's `aria-label`. The live region is a
  visually hidden `aria-live="polite"` paragraph whose text names no count, so it speaks once per state.
- Reduced motion is the CSS media query on the chew loop and the notice; it is verified by reading the stylesheet, not by a
  `matchMedia` stub.
