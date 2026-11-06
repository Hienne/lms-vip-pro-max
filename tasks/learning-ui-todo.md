# Todo: Learning UI (direction B)

Spec: [SPEC-learning-ui.md](../SPEC-learning-ui.md) · Plan: [learning-ui-plan.md](learning-ui-plan.md)

Every task also clears the project Definition of Done (AGENTS.md "Done"):

- the focused specs are green;
- the angular.md §14 checklist passes;
- UI changes pass the visual-design checklist.

Paths are relative to `apps/lms/src/app/` unless they start with `libs/` or name the backend repo.

---

## Slice 1: Covers end to end

- [x] **T1. Backend: card cover and learner cover access** (repo `corebanking-academy`, own branch and PR)
  - Acceptance:
    - `CourseCard` carries `coverAssetId` from the card's revision.
    - `GET /learning-assets/{id}/content` without `blockId` lets a caller read an asset that is the
      cover of a published revision visible to them (catalog or own enrollment), and still refuses
      everyone else.
  - Verify: a new IT test (learner allowed, unrelated learner refused, card field set); `mvn -q test`.
  - Files: `learning/dto/LearningDetails.java`, the card search query, `learning/service/LearningAssetService.java`, a new IT test.

- [x] **T2. Contract: `coverAssetId` on `CourseCardSchema`**
  - Acceptance: the field is `z.number().int().nullish()`, and the captured card fixtures include it
    (one with a cover, one null).
  - Verify: `npx nx test contracts`.
  - Files: `libs/contracts/src/lib/course/course.schema.ts`, `course.captured.ts`, `learner/learner.captured.ts`.

- [x] **T3. Mock: real image bytes and the cover rule**
  - Acceptance:
    - uploaded image assets are served back with their bytes; seeded covers come back as a real
      image;
    - learner cards carry `coverAssetId`;
    - a learner reads a cover only under the T1 rule.
  - Verify: `npx nx test mocks`, with new specs in `asset.backend.spec.ts` and `learner.backend.spec.ts`.
  - Files: `libs/mocks/src/lib/learning/asset.backend.ts`, `learning.backend.ts`, their specs.

- [x] **T4. Cover cache and cards on `/learn` and `/catalog`**
  - Acceptance:
    - `CoverCache` fetches each `assetId` once, serves an object URL, maps a refusal to "no cover",
      and revokes every URL on destroy;
    - `CourseCardView` gains `hasCover`;
    - the card reserves a 16:9 `surface-2` box while loading, shows the image when ready, and shows
      text only when there is no cover;
    - cards of not-enrolled courses ("Chưa đăng ký") show no progress bar and no "0%".
  - Verify: specs for `cover-cache`, `course-card-view`, `course-card`, `learn.store` and
    `catalog.store`; browser check on `/learn` and `/catalog`.
  - Files: `shared/course/cover-cache.ts` (new) + spec, `course-card-view.ts`, `course-card.ts/.html/.scss`, `features/learning/learn/data-access/learn.store.ts`, `features/learning/catalog/data-access/catalog.store.ts`.

- [x] **T5. Course page cover**
  - Acceptance:
    - the cover sits at the top of the main column, full width at 16:9 and capped at about 320 px
      tall;
    - no box is shown when the cover state is `none` or `failed`;
    - the primary action stays in the page header (visual-design "Layout and density").
  - Verify: `course.spec.ts` covers none, failed and ready; browser check at 1440/375 in light and
    dark.
  - Files: `features/learning/course/course.html`, `course.scss`, `course.spec.ts`.

**Checkpoint 1:**

- `npm run check` is green.
- Screenshots of `/learn`, `/catalog` and `/course/:id` with covers.
- Stop for review.

## Slice 2: Lesson player basics

- [x] **T6. Sticky step bar with completion hint**
  - Acceptance:
    - the bar sits directly under the active block, above the feedback, and sticks to the bottom of
      the main column;
    - it holds "Khối/Bài trước", the completion line (spec Decisions §4) or "Đánh dấu hoàn thành",
      and the next step;
    - exactly one primary button: "Đánh dấu hoàn thành" while the block needs it, otherwise the next
      step;
    - the old `lesson__done` block and the bottom `nav` are removed.
  - Verify: `lesson.spec.ts` checks the order (block → bar → feedback), one primary, and the copy per
    mode; a spec for the copy function.
  - Files: `features/lesson/lesson/lesson.html`, `lesson.scss`, `lesson.spec.ts`, a new `data-access/completion-hint.ts` + spec.

- [x] **T7. Feedback collapsed by default**
  - Acceptance:
    - "Đánh giá & trao đổi" renders as one row: stars summary plus "{n} nhận xét · {m} câu hỏi";
    - it expands on click (`aria-expanded`);
    - a feedback deep link or a sent message keeps it open.
  - Verify: `lesson-feedback` spec (collapsed, expand, open on spot).
  - Files: `features/lesson/lesson/components/lesson-feedback/*`.

- [x] **T8. Reading measure**
  - Acceptance:
    - text and process blocks are capped at about 72ch;
    - video, PDF and image blocks use the full column;
    - markdown `##` renders smaller than the block title (h2 → h3 scale).
  - Verify: a computed-width check in the browser at 1440 px; visual checklist.
  - Files: `components/text-block/*`, `components/process-block/*`, `lesson.scss`.

- [x] **T9. Outline states**
  - Acceptance:
    - current = `primary-subtle` row (`nav-active-bg` only shows on the dark sidebar);
    - done = `check` icon;
    - not started = empty circle;
    - quiz items keep their icon;
    - states are distinguishable without colour.
  - Verify: `lesson-outline.spec.ts`.
  - Files: `components/lesson-outline/*`.

**Checkpoint 2:**

- `npm run check` is green.
- Screenshots of the player (text, video, attachment) at 1440/375, light and dark.
- Stop for review.

## Slice 3: Block navigation

- [x] **T10. Blocks in the outline, a stepper on small screens, and the 375 px header**
  - Acceptance:
    - at ≥1024 px the current lesson's blocks are listed as sub-rows in the outline (title, type,
      state), and selecting one calls `store.selectBlock`; the chip strip is hidden;
    - below 1024 px a single-row "Khối 2/3 · Tài liệu PDF" stepper replaces the strip;
    - at 375 px the bar shows "Bài 2/4" instead of the truncated breadcrumb; there a saved state is a
      check (its words for screen readers only) so the position is not cut.
  - Verify: specs for `lesson-outline` and `block-list`; browser check at 1440, 768 and 375.
  - Files: `components/lesson-outline/*`, `components/block-list/*`, `lesson.html`, `lesson.scss`.

**Checkpoint 3:**

- `npm run check` is green.
- Screenshots.
- Stop for review.

## Slice 4: Learner home

- [x] **T11. Resume card with cover**
  - Acceptance:
    - the cover is 16:9 on the left (about 40%);
    - on the right: the lesson title (h2), "course · chapter", the progress bar with "62% · Bài 2/4"
      on one line, and one primary "Tiếp tục học";
    - without a cover the card is text only;
    - the empty state is unchanged.
  - Verify: `continue-card.spec.ts`; browser check.
  - Files: `features/learning/learn/components/continue-card/*`, `learn.store.ts` (cover for the resume card).

- [x] **T12. Quieter KPI row; programmes and competency removed**
  - Acceptance:
    - KPIs are label over value with a one-line footnote;
    - the last-score detail moves into a `title`;
    - a "Tiến độ học tập" link goes to `/progress`;
    - "Lộ trình theo chương trình" and "Năng lực" are gone from `/learn`, and their store data and
      the `dashboardPrograms` requirement are removed.
  - Verify: `learn.spec.ts`, `screens` / `app-shell` specs; `/progress` still shows both.
  - Files: `components/learn-kpis/*`, `learn.html`, `learn.scss`, `learn.store.ts`, `core/routing/screens.ts` + affected specs.

- [x] **T13. Grid, rail and tabs**
  - Acceptance:
    - "Khóa học của tôi" is 3 columns at ≥1280 px (the rail narrows to 280 px, or moves under the
      grid below 1440 px, whichever passes the squint test);
    - the tabs scroll horizontally at 375 px instead of clipping;
    - "Công cụ học nhanh" is a plain link list without a card.
  - Verify: `learn.spec.ts`; browser check at 1280, 1440 and 375, light and dark.
  - Files: `learn.html`, `learn.scss`.

**Checkpoint 4:**

- `npm run check` is green.
- The full visual-design checklist runs on `/learn`, `/catalog`, `/course/:id` and the player.
- Report.

## Follow-ups (not in this spec)

- The mock does not turn publish-time assignments into learner enrollments.
- The NV-210 final exam is missing on the learner course page after a republish.
- Competency radar labels lose spaces and break mid-phrase on `/progress`.
- With `mockBackend: true`, image, PDF and video blocks fail to load ("Không tải được …"): they read the
  content URL natively (`<img src>`, PDF engine, `<video src>`), which the in-app mock interceptor never
  sees.
- `target-picker.spec.ts` fails 4 tests on a clean `main` HEAD (743198b), unrelated to this work.
- `prettier --check` flags 4 files untouched here (`progress.html`, `org.html/.scss`,
  `points-figure.html`), so `npm run check` stops at `format:check` until they are formatted.
