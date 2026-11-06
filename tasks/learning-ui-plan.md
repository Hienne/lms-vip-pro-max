# Implementation Plan: Learning UI (direction B)

Spec: [SPEC-learning-ui.md](../SPEC-learning-ui.md) (approved 2026-11-06).
Tasks: [learning-ui-todo.md](learning-ui-todo.md).

## Overview

Four slices, each shippable and reviewable on its own:

1. **Covers end to end.** Backend, contract, mock, a shared cover cache, cards, and the course page.
2. **Lesson player basics.** A sticky step bar, completion hints, feedback collapsed by default, the
   reading measure, and outline states.
3. **Block navigation.** Blocks listed in the outline; a compact stepper below 1024 px.
4. **Learner home.** The resume card with its cover, a quieter KPI row, a 3-column grid, and
   programmes/competency removed.

## Architecture decisions

- **Covers resolve in stores, not in the card.** A new `CoverCache` in `shared/course/cover-cache.ts`
  holds one object URL per `assetId`. It is built on the fetch in `cover-image.ts`, provided per
  page store, and revokes every URL in `DestroyRef`. `learn.store` and `catalog.store` set `coverUrl`
  on each `CourseCardView` and ask the cache only for the items they currently show (the current tab
  or page). `CourseCard` stays a presenter.
- **The card knows whether a cover is coming.** `CourseCardView` gains `hasCover: boolean`, which is
  `coverAssetId != null`. While `hasCover` is true and `coverUrl` is still null, the card reserves the
  16:9 `surface-2` box, so the layout does not jump. A refused or missing cover sets
  `hasCover = false` and the card is text only.
- **Cover visibility is a server rule.** The backend lets a learner read a cover when the course's
  published revision is visible to them (catalog visibility or an own enrollment). The mock copies
  that rule. The app never decides it.
- **Completion copy is a display mapping** of `completionMode` and `completionThreshold` (spec
  Decisions §4). It lives in one pure function with a spec, next to the lesson store.
- **The block stepper reuses store commands.** `selectBlock`, `prevBlockId$` and `nextBlockId$`
  already exist. The outline and stepper only render them; no new state.
- **Removing programmes/competency from `/learn`** drops `learnerEndpoints.dashboardPrograms` from
  the `learn` screen's `requires` in `core/routing/screens.ts`, and drops the matching store data.
  `/progress` keeps its own.

## Dependency graph

```
T1 backend card + cover rule ─┐  (separate repo; can run in parallel with T2–T5)
T2 contract coverAssetId ─────┼─> T4 cover cache + cards ─> T5 course page cover
T3 mock bytes + rule ─────────┘                                     │
                                                                    v
T6 step bar + hints ─> T7 feedback collapsed      T11 resume card with cover
T8 reading measure                                 T12 KPI row + remove programmes
T9 outline states ─> T10 blocks in outline/stepper T13 grid, rail, tabs at 375
```

- T2 makes `coverAssetId` `nullish`, so the frontend works before the backend ships (no covers until
  then).
- Slices 2 and 3 do not depend on slice 1.
- T11 needs T4's cache.

## Parallel work

These can run in parallel:

- T1 (backend repo);
- T2–T5 (slice 1 frontend);
- T6–T10 (player).

They touch disjoint files. Slice 4 waits for T4.

## Risks and mitigations

| Risk                                                                   | Mitigation                                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| N cover requests per catalog page                                      | Only current-page items, cache per `assetId`, `loading="lazy"`; page size is already bounded                              |
| Object URL leaks                                                       | The cache revokes on `DestroyRef`; a spec asserts `URL.revokeObjectURL` calls                                             |
| Backend PR lands later than the frontend                               | `nullish` field; the card falls back to text only; tracked in T1                                                          |
| Sticky step bar covers content on short screens                        | Bottom padding on the main column equal to the bar height; checked at 375×667                                             |
| Collapsed feedback hides comments people relied on                     | The collapsed row shows the counts ("2 nhận xét · 1 câu hỏi") and opens with one click; a deep link to a comment opens it |
| Removing `dashboardPrograms` breaks the home's `requires` access check | Update `screens.ts` and its spec in the same task                                                                         |

## Checkpoints

After each slice:

1. `npx nx test lms` (plus `contracts` / `mocks` for slice 1), then `npm run check` in the
   background, following the AGENTS.md memory rules.
2. A browser check on a seeded run (`mockBackend: true`, never committed). Run the visual-design
   checklist at 1440 px and 375 px, light and dark, with screenshots.
3. Report what was verified, then stop for review before the next slice.
