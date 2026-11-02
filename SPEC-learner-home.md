# Spec: `learner-home` (Phase 4)

Map: [SPEC.md](SPEC.md). Status: **built in Phase 4; refresh approved 2026-11-02, amended by `tasks/plan.md` (`learner-home-refresh`)**. Builds on [SPEC-lesson-player.md](SPEC-lesson-player.md),
[SPEC-learner-progress.md](SPEC-learner-progress.md) and [SPEC-learning-reminders.md](SPEC-learning-reminders.md).
Read `docs/conventions/angular.md`, `visual-design.md` and `docs/migration/mockup-to-angular.md` first.

## Objective

The learner's home page (`/learn`, the home path of every learner) answers "what do I do next": the lesson to
resume, where the learner stands, what is due soon, and their courses by state. It uses no new endpoint: only
`myCourses`, `enrollment`, `progressSummary` and `reminders`, each wired in an earlier phase.

Mockup: `learner.js` page `dashboard` (README row F.1). Route `learn` (menu group `COURSE_LEARNING`). Migration
entry: `route-learn`. Feature folder `features/learning/learn/`.

## What is built and what is not

| Mockup section                                     | Here                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Hero with date eyebrow, greeting and message       | Replaced (visual-design.md: no hero, no greeting): `ui-page-header` then the "Tiếp tục học" card            |
| Points and streak in the hero                      | Not built: the backend has no points or streak (`activity: unavailable`)                                    |
| KPI row (assigned, completion %, last score, best) | The summary counts row from `learner-progress`; scores are not built (`assessment: unavailable`)            |
| "Khóa học của tôi" with five tabs                  | Built with four server filters: Đang học, Chưa bắt đầu, Đã hoàn thành, Bắt buộc ("Được giao" has no filter) |
| Competency radar                                   | Not built (`competency: unavailable`); one muted line says so, shared with the progress page                |
| Programme journey                                  | Not built: no programme progress on the backend                                                             |
| "Hạn hoàn thành" list                              | Built from `myCourses` sorted by due date                                                                   |
| "Công cụ học nhanh"                                | Not built: the sidebar already lists those screens                                                          |
| (new) due reminders                                | The first three reminders, linking to `notifications`                                                       |

## Shared pieces promoted from earlier phases

The second user of each piece moves it to `shared/learning/` (angular.md §4), in its own commit with the earlier
screen's specs green before and after:

- `progress-counts/`: the KPI row of `learner-progress` (input: the summary `counts`).
- `unavailable-note/`: the muted line about hours, scores and competency (input: the summary).
- `reminder-item/`: one reminder's two lines and overdue state from `learning-reminders` (input: a reminder and
  `now`; outputs none; the read button stays on the notifications page).

## Screen (`learn`)

```text
apps/lms/src/app/features/learning/learn/
├── learn.ts|html|scss|spec.ts
├── data-access/learn.store.ts (+ spec)
└── components/continue-card/   lesson title, course, chapter, %, one button
```

Store (`LearnStore`), every read independent so one failing section does not blank the page:

- `summary = serverData(progressSummary)`.
- `resume = serverData(myCourses { learningStatus: 'in_progress', sort: 'lastAccessAt,desc', size: 1 })`, then
  `resumeDetail = serverData(enrollment)` keyed by that card's `enrollmentId` (for the lesson and chapter titles of
  `lastLessonId`).
- `courses = serverData(myCourses { size: 6, …tab filter })`; `state.tab`: `'in_progress' | 'not_started' |
'completed' | 'mandatory'` (`requirement: 'mandatory'` for the last), default `in_progress`.
- `due = serverData(myCourses { sort: 'dueAt,asc', size: 10 })`; the view keeps cards with a `dueAt` that are not
  completed, at most 5 (display filtering of one server page, no computation).
- `reminders = serverData(reminders)`, idle without `COURSE_LEARNING`, 403 read as empty (as on the notifications
  page); the view shows the first three.

View (main column and side column from `lg`, one column below; the first screenful is the continue card):

1. `ui-page-header`: h1 "Trang chủ học tập". No description, no action.
2. `app-continue-card` (`uiCard`, not interactive as a whole): line 1 the lesson title (semibold), line 2 muted
   "chapter · course"; `ui-progress` with the course's `progressPercent` and the % (`ui.num`); one primary link
   "Tiếp tục học" → `/lesson/:courseId/:lastLessonId` (`?block=:lastBlockId` when set). Without an in-progress
   course: "Bạn chưa có khóa học đang học." and the link "Khám phá khóa học" → `/catalog`.
3. `app-progress-counts`, then `app-unavailable-note`.
4. Main: "Khóa học của tôi" (h2) with "Xem tất cả" → `/catalog?scope=assigned`; `ui-tabs` for the four filters (the
   three status tabs show the summary's counts); a grid of `app-course-card`; per tab an inline empty line "Không có
   khóa học ở trạng thái này." with "Mở danh mục".
5. Side: "Hạn hoàn thành" (h2) as a list, each row the course title and `app-due-date` (the row's one coloured
   badge) linking to `/course/:courseId`; empty → "Không có khóa học sắp đến hạn." Then "Nhắc hạn" (h2), up to three
   `app-reminder-item` and "Xem tất cả" → `/notifications`; the section is absent when there are none.
6. Loading: a skeleton per section. Error: `ui-error-state` with retry per section.

## Mock

No new handler. The fixtures from Phases 1 to 3 give `hocvien` an in-progress course with `lastLessonId`, courses in
each state, due dates (one overdue) and reminders.

## Testing

- `learn.store.spec.ts`: the resume query and its detail; the tab filters including `mandatory`; the due list drops
  completed and undated cards and keeps five; reminders idle and 403 handling; one section's error leaves the others.
- `learn.spec.ts`: continue card with and without a course, the resume link with `block`, tabs and counts, side
  lists, empty and error states per section.
- `continue-card.spec.ts`: one link only, the % text.
- The promoted pieces keep their specs; the progress and notifications specs pass unchanged after the move.

## Boundaries

- Always: the first screenful is the continue card; every number is the server's; sections fail independently.
- Ask first: any section the backend has no data for (points, streak, scores, competency, journey).
- Never: a hero, greeting, date eyebrow or placeholder chart; computing a completion rate in the app.

## Success criteria

1. Local backend, as a demo learner with an in-progress course: the continue card names the lesson last opened in
   `lesson-player` and its link reopens that block.
2. The counts equal `/progress`; the tabs list the server's filtered courses; the due list matches the courses with
   the nearest due dates.
3. A learner with nothing in progress sees "Khám phá khóa học" first.
4. `npm run check` green; angular.md §14, the visual-design checklist and the migration verify step pass at 375,
   768 and 1280 px, light and dark, keyboard only; `route-learn` marked `done`.

## Open questions

None.

## Implementation notes (as built)

Built in T20–T21; verified on the local backend in Checkpoint 4 of `tasks/todo.md`.

- `progress-counts`, `unavailable-note` and `reminder-item` were promoted to `app/shared/learning/` (T20) so `learn`,
  `progress` and `notifications` share them.
- No radar, scores or streak: the backend returns `unavailable` for them and the page says so once.
- The empty state ("Khám phá khóa học") is covered by a spec with a stubbed empty `myCourses`; an administrator is
  redirected away from `/learn`, so it was not tried on the real backend.
- `route-learn` is owned by `longnvse` in `migration-entries.data.ts`; its entry was left alone.
- `app.spec.ts` and `app-shell.spec.ts` now answer the requests `/learn` makes (they hung 120 s per test before).
