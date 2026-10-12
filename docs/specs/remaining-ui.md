# Spec: Remaining UI pieces (molecules, organisms, domain UI, quiz parts)

Status: ready for implementation · Labels: `ready-for-agent`

## Problem Statement

The foundation and base-libraries work delivered the atoms, the core
molecules and the overlays, but twelve pieces the business screens need are
still "Chưa migrate" on `/design-system` and `todo` on the migration board:
search, tabs, rating, KPI, option card, dropzone, stepper, tree, sortable
list, the domain status badges, the course card family and the quiz parts.
Every learner, quiz and admin screen uses at least one of them; if screens
build them ad hoc, the team ends up with several tab bars and several upload
boxes, each with different keyboard behaviour.

## Solution

Build each piece once, at the level `docs/migration/mockup-to-angular.md`
assigns it, with its `/design-system` demo and its checklist entry:

- `@lms/ui` molecules: `ui-search`, `ui-tabs`, `ui-stars` + `ui-rating`,
  `ui-kpi`, `ui-option-card`, `[uiDropzone]` + `ui-upload-item`,
  `ui-timer`, sortable list.
- `@lms/ui` organisms: `ui-stepper`, `ui-tree`.
- Domain UI in `apps/lms/src/app/shared/`: the four status badges, the
  course card, journey, due date and required mark, and the quiz question
  grid with its legend.

## User Stories

1. As a learner, I want a search box with a search icon and a clear accessible name, so that I can filter catalogs and lists.
2. As a developer, I want `ui-search` to emit its value debounced through an output, so that stores receive one query per pause, not per keystroke.
3. As a keyboard user, I want tabs that move with arrow keys and activate the selected panel, so that tabbed pages follow the WAI-ARIA tabs pattern.
4. As a developer, I want tabs to show an optional icon and count, so that "Khóa học 6" looks like the mockup.
5. As a learner, I want a read-only star display with the score and review count, so that I can see a course rating.
6. As a learner, I want to rate a lesson from 1 to 5 stars with mouse or keyboard, so that I can give feedback.
7. As a screen-reader user, I want the rating exposed as a radio group with "n sao" names, so that I know what I am choosing.
8. As a manager, I want KPI tiles with icon, value, suffix, label, tone and optional delta and link, so that dashboards read at a glance.
9. As a learner, I want option cards that select a quiz answer (single or multiple), so that the whole card is the hit area.
10. As a learner, I want reviewed answers marked correct or wrong with icon and text, so that the result never relies on colour alone.
11. As an admin, I want a dropzone that accepts dropped files and also opens the file picker with keyboard, so that uploading works without a mouse.
12. As a developer, I want the dropzone to emit selected files and leave validation to the caller, so that size and type rules stay with the feature and the server.
13. As an admin, I want upload items showing name, size, progress and an error state, so that I can follow each upload.
14. As an admin, I want a stepper that shows done, current and upcoming steps, so that I know where I am in a wizard.
15. As a developer, I want the stepper built on CDK stepper with linear and free modes, so that wizards share step state handling.
16. As an admin, I want a tree of domains, programs and courses that expands, collapses and selects with the keyboard, so that I can navigate the catalog structure.
17. As a developer, I want the tree to take nodes as input and emit selection and expansion, so that the route store owns tree state.
18. As an admin, I want to reorder items by dragging a handle, so that I can arrange lessons quickly.
19. As a keyboard user, I want move up/down buttons on each sortable item, disabled at the ends, so that reordering never requires a mouse.
20. As a developer, I want the sortable list to emit `{ from, to }` and never mutate its input, so that the store applies the move.
21. As a learner, I want course, publish, account and role statuses shown with the mockup's labels, tones and dots, so that statuses look identical on every screen.
22. As a developer, I want each status badge to take the zod enum value as input, so that an unknown status fails type checking.
23. As a learner, I want course cards with cover, required/optional mark, status, meta, progress and due date, so that I can scan my courses.
24. As a learner, I want the due date phrased "Còn n ngày", "Quá hạn n ngày" or "Hạn dd/mm/yyyy" with warning and danger tones, so that deadlines stand out.
25. As a learner, I want the journey map showing each program stop with name and percentage, so that I see my path.
26. As a learner taking a quiz, I want a countdown timer that turns to the low state near the end, so that I manage my time.
27. As a learner taking a quiz, I want a question grid showing answered, unanswered, flagged and current questions with a legend, so that I can jump between questions.
28. As a screen-reader user, I want each question cell named "Câu n, đã trả lời, đã đánh dấu", so that state is not colour only.
29. As a judge, I want every piece demoed on `/design-system` in light and dark at 375/768/1280 px, so that I can compare it with the mockup.
30. As a tech lead, I want each piece's checklist entry updated in its own pull request, so that the board stays true.

## Implementation Decisions

- **Placement follows the inventory** in `docs/migration/mockup-to-angular.md`, with three corrections recorded there in the first ticket that touches them:
  - `.sort-item`, `.drag-handle` move from feature level to an `@lms/ui` molecule: a sortable list makes sense in any product.
  - `.timer` becomes the `@lms/ui` molecule `ui-timer`: it renders remaining seconds and knows nothing about quizzes.
  - `.q-grid`, `.q-cell`, `.q-legend` move to `apps/lms/src/app/shared/quiz/`: they use quiz words but hold no state, and `/design-system` cannot import a feature's internals.
- **Composite widgets wrap the installed packages** per `ui-library.md` → Composite widgets: tabs and tree on `@angular/aria` (`tabs`, `tree` entry points of 22.2), stepper on CDK stepper, sortable list on CDK drag-drop. Exact APIs are read from `node_modules` types first.
- **Rating** is a radio group (`role="radiogroup"` with `role="radio"` buttons and roving focus, as in the mockup's lesson page) emitting the chosen value; `ui-stars` is display only with an `sr-only` sentence "x trên 5 sao".
- **Option card** is a `label` wrapping a native radio or checkbox atom, so selection, form binding and keyboard are native; `tone` `correct | wrong` with matching icon and text covers the `.answer` review rows.
- **Dropzone** is the `[uiDropzone]` behaviour directive on a `label` containing a hidden file input: drag-over state, drop and picker all emit `File[]`; `accept` and `multiple` pass through. `ui-upload-item` takes name, size, progress and `state` (`uploading | done | error`) with an error message slot.
- **Stateless pieces.** Tabs, tree, stepper, sortable list, rating and question grid take their state as inputs and report changes through outputs; route stores own the state (AGENTS.md: Store owns state).
- **Timer** takes remaining seconds and a low threshold, renders `mm:ss` with `role="timer"` and `aria-live="off"`; the countdown clock lives in the quiz store.
- **Domain UI** (`shared/status/`, `shared/course/`, `shared/quiz/`) composes `@lms/ui` atoms and takes types from `@lms/contracts`. Labels and tones are a typed record per enum, exhaustive over the zod enum.
- **Course status** (`not_started | in_progress | completed | failed`) is added to `@lms/contracts` as `CourseStatusSchema` in a learning domain module. The course card's input is a presentational view type in `shared/course/`; the learner feature maps its API result to it later.
- **Due date** compares against an injected clock (a `NOW` token defaulting to `Date.now`) so specs are deterministic; the phrasing and thresholds (≤ 3 days warning, past due danger) are copied from `UI.Due`.
- **Covers** use the six cover tints as theme tokens, never literal hex.
- **Copy** is Vietnamese from the mockup; `@lms/ui` pieces take text through inputs and hold no domain words.
- Each ticket replaces its "Chưa migrate" placeholders, sets its checklist entries `done` with owner and pull request, and lands as its own pull request.

## Testing Decisions

Tests assert external behaviour only: rendered DOM, ARIA, keyboard, focus and emitted outputs. Seams, highest first:

1. **`@lms/ui` public API**: one spec per piece through a host component, as in `segmented.spec.ts` and `menu` specs: ARIA roles and states, arrow-key navigation, outputs (`valueChange`, `selected`, `moved`, `files`), disabled ends of the move buttons, timer formatting and low state.
2. **Domain UI**: one spec per shared component: label and tone for every enum value, due-date phrasing at fixed clock values, course card content per status, question-cell accessible names.
3. **Contracts**: `CourseStatusSchema` parse and reject cases.
4. **`/design-system` route spec**: each completed piece replaces its placeholder.

Drag-and-drop pointer gestures are checked in the browser and recorded in the pull request; specs cover the keyboard path and the `moved` output.

## Out of Scope

- Pagination, data table, charts and `app-markdown` (not requested; stay `todo`).
- Feature-level pieces: viewers, assistant, certificate, flashcard, comment threads.
- The quiz screens themselves, the timer's countdown logic and answer saving.
- Upload transport (progress events, retries): the feature's API service.
- Learning domain schemas beyond `CourseStatusSchema`.

## Further Notes

- Tickets have one edge: the course card family uses the course status badge. Everything else can run in parallel.
- When the learner dashboard and catalog start, they use the course card, KPI, search and tabs from here unchanged.
