# Implementation Plan: `lesson-feedback`

Spec: [SPEC-lesson-feedback.md](../SPEC-lesson-feedback.md) (approved 2026-11-02, amended below).
Map: [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `lesson-notes`. That plan is done; its PRs are hmhug19/corebanking-academy#20 and
Hienne/lms-vip-pro-max#53 (with the follow-up Hienne/lms-vip-pro-max#54), and it is in git history at `0b964b9`.

## Overview

Under the lesson content, a learner can:

- rate the lesson from 1 to 5 stars;
- post a comment that every learner of the lesson sees;
- ask the instructor a question, which only they see, with its status;
- report a problem in the content, which only they see, with its status.

The course page shows the course's rating.

**Backend.** One new table, `lesson_feedback`, and four endpoints; the course card gains `rating`. This is a schema
change, so the upgrade runs on the shared DB before the backend PR is merged (see "Shared server").

## What was checked while planning (2026-11-02)

**Backend (`corebanking-academy`, `origin/main` at `a8b05ea`, with #20 merged)**

- **No feedback anywhere in `learning`.** The only "feedback" is Community's AI thumbs (`AiFeedback`), which is
  unrelated.
- **Error codes.** `LearningResponseCode` has `NOT_FOUND`, `INVALID_REFERENCE`, `CONFLICT` and `NOTE_LIMIT`. The
  spec's `LEARNING-FEEDBACK_INVALID` does not exist; bean validation answers `CORE-VALIDATION_FAILED`.
- **Lesson access and anchors.** Notes already have this:
  - `LessonAnchorRepository.lessonVisibleTo(userId, lessonId)`: the lesson is in the revision of one of the caller's
    enrollments, withdrawn excluded;
  - `block(lessonId, blockId)` returns the block's type and asset bounds.
- **Course card.** `CourseCard` is one record used by the catalogue, the learn lists and `LearnerCourse` (D4 wraps
  the card).
  - `LearningSearchService.withBestScores` already fills a per-page field (`bestScorePercent`) with one call for the
    page's course ids.
  - `rating` can be filled the same way, with no change to the card query.
- **Names.** `learning_hub.users.full_name` is the display name.
- **Learning day.** `LearningActivityService.ZONE` is `Asia/Ho_Chi_Minh`.

**App**

- `@lms/ui` already has the pieces this needs:
  - `ui-rating`: a radio group of five "n sao" radios with roving focus. Arrow keys move and choose.
  - `ui-segmented` and `ui-tabs`.
- Contracts and mocks have no lesson feedback. The shell schema mentions an instructor-inbox count, which stays on
  the mock.
- **The lesson page** shows one block at a time, then the quiz section and the previous / next navigation.
- **The course page** meta line (`course__meta`) has the required mark, the duration and the due date.

**Mockup** (`lesson.js` `interactions`, `api/learner.js` `feedback`, `learner.js` course hero)

- **Section and rating:**
  - The section is titled "Đánh giá & trao đổi". Its header shows the stars, the average and the count, or
    "Chưa có đánh giá".
  - The rating row reads "Bài học này hữu ích với bạn thế nào?", then the stars, then "Đã ghi nhận {n} sao".
- **Tabs:** "Nhận xét ({n})", "Hỏi giảng viên ({n})", "Báo nội dung không phù hợp". Each tab has its own:
  - label: "Nhận xét của bạn", "Câu hỏi cho giảng viên", "Mô tả vấn đề (sai thông tin, lỗi tệp, nội dung nhạy cảm…)";
  - help text, ending with "Tối đa 1000 ký tự.";
  - button: "Gửi nhận xét", "Gửi câu hỏi", "Gửi báo cáo".
- **Report:** asks "Gửi báo cáo nội dung?" / "Báo cáo sẽ được gửi tới giảng viên/quản trị nội dung để xem xét."
  before it sends.
- **Toasts:**
  - rating: "Cảm ơn bạn đã đánh giá" / "{n}/5 sao";
  - sending: "Đã gửi nhận xét", "Đã gửi câu hỏi" or "Đã gửi báo cáo".
- **Anchor:** the current position is sent with every kind. A comment shows "tại {anchor}".
- **Lists:**
  - Comments show "{name} · {relative time}[ · tại {anchor}]". When there are none: "Chưa có nhận xét — hãy là người
    đầu tiên."
  - Questions show "Chờ trả lời" / "Đã trả lời". When there are none: "Bạn chưa đặt câu hỏi nào ở bài này."
  - The report tab lists nothing.
- **Validation:** text from 5 to 1000 characters ("Nội dung cần tối thiểu 5 ký tự." / "Nội dung tối đa 1000 ký tự.").
  Stars from 1 to 5 ("Số sao phải từ 1 đến 5.").
- **Course page:** the hero shows "★ {average} ({count})". The course cards show no rating.

## Amendments to the spec

Written to the spec's "Amendments" section when the plan is approved.

1. **Errors use the existing codes:**
   - a lesson outside the caller's enrollments → `LEARNING-NOT_FOUND`;
   - a bad anchor → `LEARNING-INVALID_REFERENCE`;
   - stars outside 1–5, an unknown kind, or text that is blank, under 5 or over 1000 characters after trimming →
     `CORE-VALIDATION_FAILED`, with the mockup's field message.

   One new code: `LEARNING-FEEDBACK_LIMIT`, for more than 20 comments, questions and reports per user per lesson
   per learning day (`Asia/Ho_Chi_Minh`).

2. **Access** is the notes rule: the lesson is in the revision of one of the caller's enrollments, withdrawn
   excluded. A learner of the lesson sees its comments and rating, whatever revision they hold.
3. **Anchors are the notes anchor:**
   - `{ type: none } | { type: pdf, blockId, page } | { type: video, blockId, second }`, with whole seconds stored as
     `video_second integer`;
   - checked against the asset as for notes.

   As in the mockup, every kind is sent with the current position, so there is no "Đính kèm vị trí hiện tại" box. The
   form shows where it is sent from: "Gửi kèm vị trí: Trang 3" or "Video 0:12". Nothing is shown when the anchor is
   `none`.

4. **Table changes from the spec's DDL:**
   - `video_second integer` replaces `video_seconds numeric`.
   - `status` is null for `rating` and `comment`, and is `new | answered | resolved` for `question` and `report`,
     with a CHECK.
   - The anchor CHECK is the notes one. A rating has no anchor.
   - There is no FK and no UNIQUE. "One rating per user per lesson" is kept by the service under the advisory lock
     `lesson-rating:{userId}`.
   - The upgrade is dated `2026-11-04`.
5. **Course rating covers every revision.** It is the average of the live ratings with that `course_id`, over every
   revision, rounded to one decimal, with the count.
   - Ratings are not lost when a course gets a new revision.
   - It is filled per page beside `bestScorePercent`, with one grouped query for the page's course ids, in place of
     the spec's lateral join in the card query.
   - In `MANAGE` mode (the instructor list) it is filled too.
6. **Where the rating shows:**
   - on the course page meta line only, as "★ 4,3 (12)", with nothing when `rating` is null. The mockup puts no
     rating on cards.
   - the card DTO still carries `rating`, so cards can show it later without a backend change.
7. **What each learner sees:**
   - every live comment of the lesson, with `authorName` (`full_name`) and `mine`;
   - their own questions and their own reports, never anyone else's (spec "Never").

   The mockup also shows other learners' answered questions. That waits for the inbox, since nothing can be answered
   yet.

   The report tab lists the learner's own reports with "Chờ xử lý" / "Đã xử lý". When there are none: "Bạn chưa gửi
   báo cáo nào ở bài này." This copy is new; the mockup has no list.

8. **Copy without promises.**
   - The question toast drops the mockup's "Bạn sẽ nhận thông báo khi giảng viên trả lời.", because no notification
     is sent (open question 1).
   - The question help text "Chỉ bạn và giảng viên thấy câu hỏi cho tới khi được trả lời." becomes "Chỉ bạn và
     giảng viên thấy câu hỏi này."
9. **Comments page by 20.** F1 returns the first page and its total. "Xem thêm nhận xét" loads the next page from F4.

## Architecture decisions

**Backend (`learning` module)**

- **`LearningFeedbackService` and `LearningFeedbackController`** under `/api/v1/me/learning`, for learners only.
  - They reuse `LessonAnchorRepository` for access and anchors, and move its anchor check out of
    `LearningNotesService` into a shared `LessonAnchors` helper rather than copying it.
  - `course_id` is resolved from the lesson in the same query as the access check.
- **F2 rating** runs under the advisory lock `lesson-rating:{userId}`. It updates the live rating row if there is
  one (`row_version` and `updated_by`), and otherwise inserts one. It answers `{ average, count, myStars }` for the
  lesson.
- **F3** counts today's comments, questions and reports for the user and lesson under the advisory lock
  `lesson-feedback:{userId}` before it inserts, so the limit holds under concurrency.
- **F1:**
  - one query for the lesson's rating (`avg`, `count`) and the caller's stars;
  - one paged query for comments joined to `users.full_name`;
  - one query for the caller's questions and reports.
- **Course rating:** `LessonFeedbackRepository.courseRatings(courseIds)` (`GROUP BY course_id`) is called from
  `LearningSearchService` beside `withBestScores`, and `CourseCard.withRating(...)` sets it.

**App**

- **Contracts:** `learnerEndpoints` (or a new `feedbackEndpoints` beside the notes ones) gets `lessonFeedback`,
  `rateLesson`, `sendFeedback` and `lessonComments`. They reuse the notes `AnchorSchema`. `CourseCardSchema` gains
  `rating: { average, count } | null`.
- **`LessonStore`:**
  - `feedback = serverData(lessonFeedback)`, keyed by lesson;
  - commands `rate(stars)`, `sendFeedback(kind, text)` (with the current anchor) and `moreComments()`;
  - each mutation reloads `feedback`;
  - `rate` keeps the last choice only, so arrowing across the stars ends in one saved value.
- **`app-lesson-feedback`**, one component under `features/lesson/lesson/components`, placed after the block and
  before the quiz section:
  - the header average, then `ui-rating`, then `ui-tabs` with the form (Signal Forms with the server's limits) and
    the list for each tab;
  - it takes store selectors and emits commands.
- **The course page** renders `card.rating` in `course__meta`.

## Shared server

Merging the backend deploys it, and `ddl-auto=validate` refuses to start without `lesson_feedback`. The order:

1. the user runs `docs/sql/upgrade/2026-11-04-lesson-feedback.sql` on the shared DB;
2. merge the backend PR, and wait for the deploy;
3. merge the app PR.

The backend PR's first line says so.

## Task list

Detailed in [todo.md](todo.md).

**Phase 1 (backend)**

- **B1:** schema, entity and repository.
- **B2:** rating F2, and the course rating on the card (F5).
- **B3:** comments, questions and reports (F3), the lesson view (F1) and comments paging (F4).
- **B4:** docs.
- **Checkpoint A:** the main session applies the upgrade locally and checks with `curl`.

**Phase 2 (app)**

- **F1:** contracts, captured responses, mock.
- **F2:** the store and the "Đánh giá & trao đổi" section.
- **F3:** the course page rating.
- **F4:** end-to-end check.
- **Checkpoint B:** the main session checks in the browser.

## Risks and mitigations

| Risk                                                                                       | Mitigation                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The backend deploys before the upgrade and fails to start (as #15 and #18 did).            | The upgrade runs on the shared DB first; the PR says so on its first line, and the main session reminds the user before any merge.                |
| Arrow keys on `ui-rating` choose on every step, so one keyboard pass sends several `PUT`s. | The store keeps the latest only, so the earlier requests are cancelled or ignored. The `PUT` is idempotent (it replaces), so any order converges. |
| Two tabs rate at once and leave two live ratings.                                          | The advisory lock on `lesson-rating:{userId}`, and an IT with concurrent `PUT`s.                                                                  |
| A long comment list slows the lesson load.                                                 | Comments are paged by 20 behind an index on `(lesson_id, kind, create_time DESC)`.                                                                |
| The course rating adds a query to every catalogue page.                                    | One grouped query per page on `idx_lesson_feedback_course_rating`. Checkpoint A runs `EXPLAIN` on the demo DB.                                    |
| A comment reveals a learner's name to other learners.                                      | Comments are public by design (mockup help: "Nhận xét hiển thị công khai cho học viên khác.") and the help text says so.                          |

## Open questions (defaults apply unless the user says otherwise)

1. **Notifying instructors:** no notification for questions and reports until the inbox is specified (spec
   question 1).
2. **Deleting a comment:** a learner cannot delete their own comment; moderation comes with the inbox (spec
   question 2).
3. **Ratings on course cards:** not shown, as in the mockup (amendment 6). Say so if the catalogue cards should show
   them.
4. **Feedback as learning activity:** rating or commenting does not count as a learning day for the streak.

## Verification

- **Backend:** `mvn clean test`, then Checkpoint A on the local stack (`curl` for each rule and visibility across
  `hocvien` and `hocvien.tichhop` on a lesson both are enrolled in).
- **App:** `npm run check`, then Checkpoint B in the browser:
  - 1280 px light and 375 px dark;
  - as `hocvien`, rate a lesson 4 and then 5 by keyboard, comment on PDF page 3, ask a question at video 0:12, and
    report (after the confirm);
  - reload: the same state;
  - as `hocvien.tichhop`, the comment and the average show, and the question and report do not;
  - the course page shows the rating, and it matches `curl` of the card.
