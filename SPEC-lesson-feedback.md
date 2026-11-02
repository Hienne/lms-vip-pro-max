# Spec: `lesson-feedback`

Map: [SPEC.md](SPEC.md). Status: **approved 2026-11-02, amended by the plan (see "Amendments").** Depends on `catalog-discovery`: D3 / D4 carry
the course rating.

## Amendments

Written with [tasks/plan.md](tasks/plan.md) on 2026-11-02. Where they differ from the sections below, they win.

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

## Objective

Under the lesson content, the mockup (`lesson.js`, `api/learner.js` `feedback`) gives the learner four actions:

- **Đánh giá** – rate the lesson from 1 to 5 stars. One rating per learner per lesson, which they can change.
  The lesson shows the average and the number of ratings.
- **Nhận xét** – post a comment. Every learner who can open the lesson sees it, with author and time.
- **Hỏi giảng viên** – send a question. Only the sender sees it, with its status (Chờ phản hồi / Đã trả lời) and
  the reply when there is one.
- **Báo nội dung** – report a problem in the lesson. Only the sender sees it, with its status.

For questions and reports, the PDF page or video time can be attached as an anchor, as in `lesson-notes`. The
course page and course cards show the course's rating: the average over its lessons' ratings, and the count.

Out of scope (map decision 4): the instructor inbox (`instructor/inbox`), replying, and resolving. The backend
stores `status` and `reply`, so the inbox can be built later without a schema change.

## Backend (`corebanking-academy`, module `learning`)

### Endpoints (`LearningFeedbackController`, `/api/v1/me/learning`)

| #   | Endpoint                            | Body / query                                                                                | Response                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `GET /lessons/{lessonId}/feedback`  | —                                                                                           | `LessonFeedback { rating: { average, count } \| null, myStars, comments: Page<CommentView>, mine: List<FeedbackView> }`. `mine` holds the caller's questions and reports, newest first. |
| F2  | `PUT /lessons/{lessonId}/rating`    | `{ stars: 1..5 }`                                                                           | `{ average, count, myStars }`                                                                                                                                                           |
| F3  | `POST /lessons/{lessonId}/feedback` | `{ kind: comment\|question\|report, text, blockId?, anchorType?, pdfPage?, videoSeconds? }` | `FeedbackView`                                                                                                                                                                          |
| F4  | `GET /lessons/{lessonId}/comments`  | `page`, `size`                                                                              | `Page<CommentView>` (more comments)                                                                                                                                                     |
| F5  | `CourseCard`, `LearnerCourse`       | —                                                                                           | **changed, additive**: `rating: { average, count } \| null`                                                                                                                             |

- `CommentView` has: `id`, `authorName`, `text`, `createTime`, `mine`.
- `FeedbackView` has: `id`, `kind`, `text`, `anchor…`, `status` (`new` | `answered` | `resolved`), `reply`,
  `replyTime`, `createTime`.

**Rules (service):**

- **Access.** As for reading the lesson.
- **Text.** Trimmed, 5–1000 characters (mockup). Otherwise `LEARNING-FEEDBACK_INVALID`.
- **Stars.** An integer from 1 to 5. One rating per user per lesson; a second `PUT` replaces it. Uniqueness is
  checked under the user's advisory lock.
- **Rate limit.** At most 20 comments, questions and reports per user per lesson per day. Beyond that the
  response is `LEARNING-FEEDBACK_LIMIT`.
- **Visibility.** A comment's `authorName` is the user's `full_name`. Questions and reports are never returned to
  anyone but their author on these endpoints.
- **Course rating.** The average of all lesson ratings of the course's current revision, rounded to one decimal.
  It is computed in the card query with a lateral aggregate; if the query plan on demo data says so, the plan may
  switch to a summary column.

### DB upgrade `docs/sql/upgrade/2026-11-xx-lesson-feedback.sql`

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS learning_hub.lesson_feedback (
    feedback_id    bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id        varchar(20)   NOT NULL,
    lesson_id      bigint        NOT NULL,
    course_id      bigint        NOT NULL,
    kind           varchar(10)   NOT NULL,          -- rating | comment | question | report
    stars          smallint,
    body           text,
    block_id       bigint,
    anchor_type    varchar(10),
    pdf_page       integer,
    video_seconds  numeric(12,3),
    status         varchar(10)   NOT NULL,          -- new | answered | resolved
    reply          text,
    replied_by     varchar(20),
    reply_time     timestamptz,
    is_deleted     boolean       NOT NULL DEFAULT false,
    created_by     varchar(20)   NOT NULL,
    updated_by     varchar(20)   NOT NULL,
    row_version    bigint        NOT NULL DEFAULT 0,
    create_time    timestamptz   NOT NULL DEFAULT now(),
    update_time    timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_lesson_feedback_kind CHECK (
        (kind = 'rating' AND stars BETWEEN 1 AND 5 AND body IS NULL) OR
        (kind <> 'rating' AND stars IS NULL AND body IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_lesson_feedback_lesson_kind
    ON learning_hub.lesson_feedback (lesson_id, kind, create_time DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_lesson_feedback_course_rating
    ON learning_hub.lesson_feedback (course_id) WHERE kind = 'rating' AND NOT is_deleted;
-- COMMENT ON TABLE / COLUMN for every column, in Vietnamese.
COMMIT;
```

- **Table design.** One table, because the mockup's feedback is one record with a `kind`. `course_id` is
  denormalised so the course rating needs no join through chapters.
- **Rollback.** `DROP TABLE IF EXISTS`, after printing the row count.
- **Baseline.** The table is also added to the learning baseline.

Docs: a "Phản hồi bài học" section in `docs/api/LEARNING.md`.

## App

### Contracts (`libs/contracts/src/lib/learner`)

- `lessonFeedback`, `rateLesson`, `sendFeedback`, `lessonComments`.
- The `rating` field on the card and the course.

### Screens

| Where                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/lesson/lesson` | A "Phản hồi" section after the blocks, with three parts:<br>• Star rating: a radio group of five stars with `aria-label` "{n} sao", plus the average and count.<br>• A segmented control: Nhận xét / Hỏi giảng viên / Báo nội dung. It has one textarea with a counter (5–1000), and "Đính kèm vị trí hiện tại" for questions and reports.<br>• Below: the comment list (author, time, text, "Xem thêm") and "Câu hỏi và báo cáo của bạn" with their status labels.<br>The success toast follows the mockup copy. |
| course page, course card | "{average} ★ ({count})" in the meta line; nothing when `rating` is null.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `lesson.store.ts`        | `feedback = serverData(lessonFeedback)`. `rate` and `send` are `serverMutation`s that reload `feedback`. Form state uses Signal Forms with the server's limits.                                                                                                                                                                                                                                                                                                                                                   |

### Mock

`libs/mocks/src/lib/learning` serves F1–F4 from a feedback seed.

## Testing

- **Backend:**
  - Validation of stars and text length.
  - The second rating replaces the first.
  - A question is not visible to another learner.
  - The rate limit.
  - Course average across lessons.
  - Access outside the enrollment.
- **App:**
  - The star radio group is keyboard accessible: arrow keys move, and a selected star calls `rate`.
  - The form shows the server's validation message.
  - The lists render, and status labels map.
  - The card rating shows and hides.
- **Local:**
  - As `hocvien`, rate a lesson 4, change it to 5, comment, ask a question and report.
  - As `hocvien.tichhop`, see the comment and the average, but not the question or the report.
  - The course page shows the course average.

## Boundaries

- **Always:** text limits and visibility enforced on the server.
- **Ask first:** sending notifications to instructors. That needs an instructor audience rule; it is out of scope
  by default.
- **Never:** show another user's question or report.

## Success criteria

1. Rating, comment, question and report all work on the local backend. A reload shows the same state.
2. Visibility holds across two learner accounts, as in the local test above.
3. The course page and catalog cards show the course rating, which matches a `curl` of the card.
4. The upgrade script and its rollback apply cleanly. `mvn clean test` and `npm run check` green. The
   visual-design checklist passes for the "Phản hồi" section.

## Open questions

1. **Notifying instructors:** should a question or report notify instructors now, through the Community
   notifications? Who counts as an instructor of a course? Default: no notification until the inbox is specified.
2. **Deleting a comment:** may a learner delete their own comment? Default: no; moderation comes with the inbox.
