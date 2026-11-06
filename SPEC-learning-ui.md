# Spec: Learning UI (course card covers, learner home, lesson player)

Status: approved 2026-11-06, direction B. See [Decisions](#decisions). Plan:
[tasks/learning-ui-plan.md](tasks/learning-ui-plan.md).

## Objective

Learners (bank staff taking assigned or self-enrolled courses) reported two problems:

1. **Course cards show no cover image.** Instructors upload a cover in step 1 of the course wizard,
   but the cards on "Trang chủ học tập" (`/learn`) and "Danh mục khóa học" (`/catalog`) never show it.
2. **The learning screens look plain and the layout is not well organised.** This covers the learner
   home (`/learn`), the course page (`/course/:id`) and the lesson player (`/lesson/:courseId/:lessonId`).
   Nothing stands out, the next action is not obvious, and the player buries navigation.

Success: a learner opening `/learn` sees what to continue and their courses with real cover images;
inside a lesson, the content is easy to read and moving to the next block or lesson takes one obvious
click at any width. All of this stays within `docs/conventions/visual-design.md`. Emphasis comes from
real images, type and layout, never from banned decoration.

## How this was reviewed

On 2026-11-05 the app ran with `mockBackend: true` (reverted afterwards). As "Quản trị gốc Demo" I
created course **NV-210 "Đối soát giao dịch cuối ngày"** with:

- a 1280×720 cover;
- chapter 1 "Tổng quan quy trình EOD": lesson "Khái niệm chốt ngày" (text, process and image blocks)
  and lesson "Màn hình vận hành EOD" (video, PDF and attachment blocks);
- chapter 2 "Xử lý ngoại lệ": lesson "Tình huống lệch quỹ" (text);
- a final exam (15 min, 4 questions, 70%) and 50 completion points.

I published it and assigned it to "Học viên tiền gửi Demo". As that learner I enrolled, opened every
block, and reviewed `/learn`, `/catalog`, `/course/5001` and the lesson player at 1440 px and 375 px,
in light and dark. The seeded course NV-101 was used for comparison (multi-chapter, quiz items in the
outline, comments).

Screenshots are outside the repo, in the session notes folder `learning-ui-review/` (01 to 11).

Not covered: a quiz _lesson_. The lesson dropdown offers only quizzes of this course, and the only one
was the final exam. Using it would block publishing because it was still a draft. The quiz entry in the
outline was checked on NV-101 instead.

## 1. Thumbnail root cause

The cover is lost at three layers. Fixing only the frontend changes nothing.

| Layer    | Finding                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | `LearningDetails.CourseCard` (`corebanking-academy`, `learning/dto/LearningDetails.java:44`) has no cover field. The revision stores `cover_asset_id`, but the card query never selects it.                                                                                                                                                                         |
| Backend  | `LearningAssetService.download` (`learning/service/LearningAssetService.java:102`) lets a caller read a cover only through `canManage` on the owning course. A learner without `blockId` and `enrollmentId` is always refused. So the cover on the learner course page (`course.store.ts:124`, `cover$`) also fails against the real backend, even after enrolling. |
| Contract | `CourseCardSchema` (`libs/contracts/src/lib/course/course.schema.ts`, about line 300 to 372) has no `coverAssetId`.                                                                                                                                                                                                                                                 |
| Frontend | `toCourseCardView` (`apps/lms/src/app/shared/course/course-card-view.ts`) never sets `coverUrl`. The card template already renders `coverUrl` at 16:9 (`course-card.html:2`), so the card is ready to show the image.                                                                                                                                               |
| Mock     | The asset backend returns a 1×1 grey PNG for every image (`libs/mocks/src/lib/learning/asset.backend.ts:26`). Even a correct wiring shows a flat grey block in a mock run. That block is what the learner course page shows today (screenshot 05).                                                                                                                  |

### Proposed fix

1. **Backend (server rule, needs its own PR in `hmhug19/corebanking-academy`):**
   - add `Long coverAssetId` to `CourseCard`, selected from the card's revision;
   - allow a cover to be read by anyone who may see the course. That means its published revision is
     visible to them in the catalog, or they hold an enrollment on it. This branch goes in
     `download(...)` next to `assetCovers(assetId)`. Visibility stays a server rule; the app infers
     nothing.
2. **Contract:** add `coverAssetId: z.number().int().nullish()` to `CourseCardSchema`. Update the
   captured fixtures in `course.captured.ts` and `learner.captured.ts`.
3. **Frontend:** the learn and catalog stores resolve each visible card's cover through the existing
   `coverPreview` helper and pass the object URL to the card's `coverUrl`. The card stays a pure
   presenter with no HTTP. Covers are cached per `assetId` in the store, so switching tabs does not
   fetch again. Object URLs are revoked when the store is destroyed.
4. **Card fallbacks:** while loading, the card shows a `surface-2` 16:9 block, the same as
   `course-card__cover`'s background. A course with no cover, or a refused one, shows no cover area
   (text-only card, as today). Never placeholder art.
5. **Course page:** when the cover is `none` or `failed`, the course page must not reserve the grey
   box. Today it shows an empty `surface-2` rectangle.
6. **Mock:** keep the uploaded bytes in memory for image assets (or serve a deterministic real image
   per asset) so the cover can be reviewed in a seeded run. Apply the same visibility rule as the
   server.

## 2. UI review findings

`[L]` = `/learn`, `[C]` = `/catalog`, `[P]` = course page, `[Les]` = lesson player.

### Learner home `/learn` (screenshots 02 to 04)

- The "Tiếp tục học" card is the most important thing on the page, but it looks like every other
  card. The title is large, then there is empty space, and the progress bar sits on its own row
  under the button and detached from it. There is no image, and at 0% it shows an empty track with
  "0%".
- The KPI row has four equal columns. "Điểm kiểm tra gần nhất" wraps to three lines of footnote
  ("Chưa đạt · Luyện tập: Tổng quan hệ thống Core Banking"). It competes with the resume card and
  the course list.
- "Khóa học của tôi" is a 2-column grid in the main column at 1440 px, with text-only cards of uneven
  height. Without covers, every card has the same weight and the page reads as a wall of boxes.
- The right rail ("Hạn hoàn thành", "Công cụ học nhanh", "Điểm thưởng và chuỗi học") is useful.
  "Công cụ học nhanh" is a link list dressed as a card.
- Below the fold: "Lộ trình theo chương trình" and the "Năng lực" radar. Radar labels break
  mid-phrase, and the text layer loses spaces ("tổngquan", "rủiro"). This duplicates `/progress`.
- At 375 px the tab strip is cut off ("Chưa bắt đầ…") and the KPI footnotes push the course list
  below the second screen.

### Catalog `/catalog` (screenshot 01)

- The card grid is fine structurally (3 columns at 1440 px). It suffers most from the missing cover:
  seven near-identical text boxes.
- The progress bar and "0%" appear on courses the learner never enrolled in ("Chưa đăng ký · 0%"),
  which is noise.

### Course page `/course/:id` (screenshot 05)

- The cover slot is an empty grey box in the right rail (see root cause). When the cover loads, a
  rail-sized 16:9 image is the weakest place for the one real image the course has.
- The header row is the title, the meta line, and "Tự chọn · 30 phút" as a badge plus text. The
  primary button "Bắt đầu học" is top right, far from the outline.
- Completion conditions list "Học đủ 3 bài bắt buộc", but the final exam created in step 3 is
  neither listed nor shown under "Bài kiểm tra" for NV-210, while NV-101 shows it. This needs a check
  and is listed under Open questions.

### Lesson player (screenshots 06 to 11)

- **Navigation is buried.** "Khối trước / Khối tiếp theo / Bài tiếp theo" sit under the whole
  "Đánh giá & trao đổi" panel, which has stars, three tabs, a textarea and the comment list. On a
  short block the learner scrolls past a feedback form to move on. At 375 px the buttons are about
  two screens down.
- **The block switcher is a row of bordered chips.** Each chip shows title, type and percent ("Theo
  dõi batch EOD Video 0%"). At 375 px they stack into three full-width rows (about 300 px) before any
  content. The chips repeat what the outline on the right could carry.
- **Reading width:** text blocks run the full main column (about 1000 px at 1440 px), well past a
  comfortable measure. Markdown `##` headings render at the same size as the block title.
- **Completion feedback is inconsistent in the UI:** text and process blocks stay "0%" after reading
  until "Đánh dấu hoàn thành". Image and attachment blocks show "✓ Đã hoàn thành · 05/11/2026" on
  view. The rule is the server's, but the player gives no hint of what completes a block. It also
  floats a bare "Đã xem 0% · cần 80%" line under the video.
- **Outline:** the current lesson and a completed lesson both use a teal dot, so done and current
  look the same. A check icon is used for done on NV-101 but not on NV-210.
- **Header bar:** at 375 px the breadcrumb collapses to "Đố…", which is useless. "Đã lưu tiến độ"
  takes the space instead.
- **Mock-only:** image, video and PDF blocks show "Không tải được …" in a mock run, because the mock
  serves no real bytes. This is not a product bug, but it blocks visual review of media blocks.
- Dark mode has no contrast or token problems on these screens.

## 3. Directions

All three keep the banned list: no hero, eyebrow, icon tile, gradient, stripe, badge soup or
decorative colour. Emphasis comes from the **cover image** (the only real art the product has),
**type scale**, **one primary button per view**, and **position**.

### A. Polish in place (small)

Fix the thumbnail chain and keep every layout as is, then make targeted fixes:

- move prev/next above the feedback panel;
- give text blocks a max measure;
- use a distinct done icon in the outline;
- use a horizontal-scroll block strip at 375 px;
- hide progress on "Chưa đăng ký" cards;
- fix the radar label text.

- Pros: low risk, about 1 to 2 days of FE after the backend change, small diff, easy review.
- Cons: the home and the player still feel flat. Every section keeps equal weight, and the "lacks
  emphasis" complaint is only partly answered.

### B. Learning-first hierarchy (recommended)

Restructure around "what do I do next". Components and data stay; only placement and weight change.

**`/learn`**

- **Resume card becomes the focal element:** the cover at 16:9 on the left (about 40%), and on the
  right the lesson title (h2), "course · chapter", a progress bar with "62% · Bài 2/4" on one line,
  and one primary "Tiếp tục học". Without a cover it falls back to the text-only layout. No greeting
  or hero: it is the first real content, as the visual-design doc prescribes.
- **KPIs shrink to one quiet row** (label over value, `ui.num`). Each footnote is cut to one line
  ("3 bắt buộc · 1 quá hạn"). The "Điểm kiểm tra gần nhất" detail moves into a `title` or to
  `/progress`.
- **"Khóa học của tôi"** cards get covers. The grid is 3 columns at ≥1280 px. That means either the
  right rail moves under the grid at <1440 px, or the rail narrows to 280 px. At 375 px the tabs
  become a horizontally scrollable strip, not a wrap.
- **Programmes and competency** leave the home (they already live on `/progress`). Only a
  "Tiến độ học tập" link stays in the KPI row. The home gets shorter, and the radar label bug moves to
  one place.
- The rail keeps "Hạn hoàn thành" (state: overdue in `danger`) and "Điểm thưởng và chuỗi học"
  (`accent` = achievement). "Công cụ học nhanh" becomes a plain link list without the card.

**Course page**

- The cover moves to the top of the main column as a full-width 16:9 image, capped at about 320 px
  tall with `object-fit: cover`, above the objectives and the outline. The primary button stays in
  the page header's actions (`visual-design.md`, "Layout and density"); an earlier draft moved it
  under the meta line, which that rule does not allow.
- Final exam and completion conditions stay in the rail.

**Lesson player**

- **Reading column:** content max-width about 72ch for text and process blocks. Media (video, PDF,
  image) may use the full column.
- **Block navigation lives in the outline:** under the current lesson, its blocks are listed as
  sub-rows with type and state. The chip strip above the content is removed at ≥1024 px. Below that
  width, a compact "Khối 2/3 · Tài liệu PDF" select or stepper replaces the strip, never stacked
  chips.
- **Sticky step bar** at the bottom of the main column: "← Khối trước", a state line ("Đã hoàn thành"
  or "Cần xem 80% video" from the server's numbers), and the one primary "Khối tiếp theo / Bài tiếp
  theo →". "Đánh dấu hoàn thành" joins this bar when the block needs it, so there is one primary
  button per view.
- **Feedback becomes secondary:** "Đánh giá & trao đổi" sits below the step bar, collapsed by default
  to one row (stars + "2 nhận xét · 1 câu hỏi"). It expands on click. This keeps comments and rating
  available without blocking navigation.
- **Outline states:** current = `primary-subtle` row (`nav-active-bg` is the dark sidebar's token and
  does not show on the light panel); done = check icon (`success`); not started =
  empty circle. Same icon set on every course.
- **375 px header:** show the lesson position ("Bài 2/4") instead of the truncated breadcrumb. Keep
  "Thoát" and "Mục lục".

- Pros: answers both complaints directly. The cover gives the home its visual anchor with real
  content, and the player gets one clear next step at any width. Uses existing components (`uiCard`,
  `ui-progress`, `ui-tabs`, outline).
- Cons: medium change, about 4 to 6 days of FE. It touches `learn`, `course` and `lesson` templates
  and SCSS, the outline component and specs. Moving programmes/competency off the home needs product
  agreement.

### C. Player-centric redesign (large)

The lesson becomes a full-bleed "stage" (media edge to edge, outline in a drawer, notes and feedback
in a side sheet). `/learn` becomes a dense list (cover thumbnail 96×54, title, progress, due date per
row) instead of cards.

- Pros: maximum focus inside a lesson, and very dense home for heavy learners.
- Cons: biggest change (2 weeks or more). Drawers hide the outline that learners use to orient. The
  list view loses the cover impact that motivated the request. It also departs most from the mockup's
  structure, so there are more deliberate differences to justify.

**Recommendation: B**, delivered in slices:

1. Covers end to end: backend → contract → stores → card, plus the course page fallback and the
   mock bytes.
2. Lesson player: sticky step bar, collapsed feedback, reading measure, outline states.
3. Block navigation in the outline and the 375 px stepper.
4. `/learn` resume card with cover, quiet KPI row, 3-column grid, programmes/competency moved.

Slice 1 is useful alone and unblocks the visual review of the others.

## Tech stack

Angular 22 (standalone, zoneless, signals) · Nx · zod contracts · SCSS through the `ui` module ·
`@angular/aria` + CDK · Vitest · in-app mock API. Backend: Spring (`corebanking-academy`).

## Commands

```
nvm use
npm start                         # app on :4200, proxy to the shared backend
npx nx test lms                   # learner screens, card, stores
npx nx test contracts             # CourseCardSchema
npx nx test mocks                 # asset/cover mock
npm run check                     # full gate, run in background, one at a time (see AGENTS.md)
cd ~/my-projects/corebanking-academy && mvn -q test   # backend slice only
```

## Project structure (touched areas)

```
apps/lms/src/app/shared/course/        course-card*, course-card-view.ts, cover-image.ts
apps/lms/src/app/features/learning/learn/     learn.html/.scss, continue-card, learn-kpis, learn.store
apps/lms/src/app/features/learning/catalog/   catalog.store (covers)
apps/lms/src/app/features/learning/course/    course.html/.scss, course.store (cover fallback)
apps/lms/src/app/features/lesson/lesson/      lesson.html/.scss, lesson-outline, block-list, lesson-feedback
libs/contracts/src/lib/course/course.schema.ts, *.captured.ts
libs/mocks/src/lib/learning/asset.backend.ts, learning.backend.ts
corebanking-academy: learning/dto/LearningDetails.java, learning/service/LearningAssetService.java, card query
```

## Code style

The store resolves covers; the card stays a presenter:

```ts
// learn.store.ts
readonly courses$ = computed(() =>
  (this.coursesData.value()?.items ?? []).map((card) => ({
    ...toCourseCardView(card),
    coverUrl: this.covers.src(card.coverAssetId), // cached object URL or null
  })),
);
```

SCSS uses tokens only (`ui.space`, `ui.color`, `ui.radius(card)`). Covers keep
`aspect-ratio: 16 / 9; object-fit: cover`. There are no new radii, shadows or motion.

## Testing strategy

- **contracts:** `CourseCardSchema` parses a card with and without `coverAssetId`.
- **shared/course:** `toCourseCardView` passes the cover through. The card renders `<img alt="">`
  only when `coverUrl` is set, and no cover box otherwise.
- **stores:** covers are fetched once per asset id, a refused cover yields `null`, and object URLs are
  revoked on destroy.
- **lesson:** the step bar renders above feedback, with exactly one primary button. Feedback is
  collapsed by default. The outline shows distinct current and done states.
- **mocks:** an uploaded image asset is served back with its bytes. A learner who cannot see the
  course is refused the cover.
- **backend:** an IT test checks that a learner can read the cover of a visible published course and
  is refused otherwise, and that the card carries `coverAssetId`.
- **Visual:** the visual-design checklist at 1280/1440 and 375 px, light and dark, with screenshots,
  plus the angular.md §14 checklist.

## Boundaries

- **Always:** use tokens only; keep business rules on the server (visibility, completion, %); one
  primary button per view; no placeholder art; Vietnamese copy from the mockup; check
  `mockBackend: false` before committing.
- **Ask first:**
  - the backend change (separate repo and PR);
  - removing programmes/competency from `/learn`;
  - changing what counts as block completion, or its copy;
  - adding a dependency (none planned).
- **Never:**
  - reproduce the mockup's pastel icon covers;
  - add a hero or greeting, gradients, eyebrows or badge soup;
  - let the app decide cover visibility;
  - commit `mockBackend: true`.

## Success criteria

1. With a cover uploaded and the course published, the learner sees the cover on `/learn`,
   `/catalog` and the course page, against the shared backend and in a mock run.
2. A course without a cover shows a text-only card and no grey box anywhere.
3. A learner without visibility gets 403 for the cover asset (backend test).
4. In the lesson player at 375 px and 1440 px, the next-step button is visible without scrolling past
   the feedback panel, and each view has exactly one primary button.
5. At 375 px no block switcher takes more than one row before the content.
6. Text blocks never exceed about 72ch line length at 1440 px.
7. Outline: current, done and not-started lessons are distinguishable without colour alone.
8. `/learn` first screenful at 1440 px shows the resume card with cover, the KPI row and the first
   row of course cards.
9. `npm run check` is green, and the visual-design checklist passes on every changed screen, light
   and dark.

## Decisions

Approved by the user on 2026-11-06.

1. **Direction B**, in the four slices above.
2. **Cover delivery:** authenticated fetch + object URL, through the existing `coverPreview` helper.
   There is no signed URL and no cookie change. Stores cache covers per `assetId` and load them only
   for the cards on screen.
3. **"Lộ trình theo chương trình" and "Năng lực" leave `/learn`.** Both stay on `/progress`, and the
   KPI row links there.
4. **The player states what completes each block**, mapped from the server's `completionMode` and
   `completionThreshold`. The app only words the rule; it never computes it.

   | `completionMode` | Copy before completion                           |
   | ---------------- | ------------------------------------------------ |
   | `manual`         | "Đọc xong, bấm Đánh dấu hoàn thành" + the button |
   | `video_coverage` | "Đã xem {percent}% · cần {threshold}%"           |
   | `pdf_end`        | "Xem đến trang cuối để hoàn thành"               |
   | `open`           | none (the block completes on open)               |

5. **Mock image bytes** are part of slice 1, needed to review covers. Two items are separate
   follow-ups and not in this spec:
   - the mock never turning publish-time assignments into enrollments;
   - the NV-210 final exam missing on the learner page after a republish.
