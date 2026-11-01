# Spec: `learner-scores`

Map: [SPEC.md](SPEC.md). Status: **draft, amended by the plan (see "Amendments"), waiting for approval.** Depends on
`learner-quiz`.

## Amendments

Written with [tasks/plan.md](tasks/plan.md) on 2026-11-01. Where they differ from the sections below, they win.

1. **A course's score is its final exam.** `CourseCard.bestScorePercent` is the best graded score on the course's
   published final exam, else null, as the mockup's course card reads it. `finalExamPassed` is dropped: `failed`
   already says it.
2. **Overview figures** come from the same per-quiz summary as `AttemptSummary`, over the published quizzes of the
   caller's current courses (the `MINE` search's ids):
   - best is the highest `bestScore`;
   - passed counts the quizzes whose `passed` is true;
   - `quizCount` includes practice quizzes;
   - `last` carries that attempt's own `passed`;
   - average is the mean of `finalScore` per quiz (open question 1's default).
3. **The CSV column goes last**, after "Trạng thái hạn", so no existing column moves.
4. **"Lịch sử thi" as in the mockup:** the 6 latest graded attempts, linking to their result, with no paging and no
   CSV. The backend adds **S4**, `graded=true` on `/me/quiz-attempts` and its export.
5. **The course card** shows "· Điểm cao nhất {x}%" on its status line.
6. **Mockup labels:** "Điểm thi trung bình" and "Lịch sử thi". Percents use `fmtPct` with two digits.
7. **Bắt đầu and Truy cập gần nhất** are already in the progress table.
8. **"Điểm cao nhất" is not sortable** (open question 2's default).

## Objective

The mockup's score figures:

- **Learn page KPIs** (`learner.js` dashboard):
  - "Điểm kiểm tra gần nhất", with the quiz name and whether it passed.
  - "Điểm cao nhất", with the line "Đạt {passed}/{total} bài kiểm tra".
- **Progress page** (`tools.js`):
  - A column "Điểm cao nhất" per course.
  - An average-score KPI.
  - The list of attempts.

Today the summary returns `assessment: { availability: "unavailable" }`, so the app shows none of these. The
numbers are server rules: which attempt counts, and what counts as passed. So the server computes them.

## Backend (`corebanking-academy`)

| #   | Endpoint                                   | Change                                                                                                                                                                              |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `GET /api/v1/me/learning/progress/summary` | **changed**: `assessment` becomes an `AssessmentOverview` when the caller has a quiz in any of their current courses. It stays `{ availability: "unavailable" }` otherwise.         |
| S2  | `CourseCard` (catalog, courses, export)    | **changed, additive**: `bestScorePercent` (BigDecimal, null when no graded attempt on the course's quizzes) and `finalExamPassed` (Boolean, null when the course has no final exam) |
| S3  | `/progress/export`                         | **changed**: a CSV column "Điểm cao nhất" after "Hoàn thành"                                                                                                                        |

```java
public record AssessmentOverview(String availability,           // "available"
                                 LastScore last,                // null when no graded attempt
                                 BigDecimal bestScorePercent,   // max finalScore over the caller's quizzes
                                 BigDecimal averageScorePercent,// mean of finalScore per quiz with a graded attempt
                                 int passedQuizCount,           // quizzes with passed = true (scoreMethod rule)
                                 int quizCount) {               // published quizzes of the caller's current courses
    public record LastScore(Long quizId, String quizTitle, Long courseId, Long attemptId,
                            BigDecimal scorePercent, Boolean passed, Instant submittedAt) {}
}
```

The figures come from the same code path as `AttemptSummary` (`finalScore`, `passed`), through the assessment
adapter, so the summary and the quiz intro can never disagree.

- `quizCount` counts published, not-deleted quizzes whose `course_id` is one of the caller's current
  enrollments or assignments.
- `averageScorePercent` is rounded as the attempt score is: two decimals, half up.

No schema change.

Docs: `docs/api/LEARNING.md` → "Summary, CSV và thông tin gửi FE" describes `AssessmentOverview` and the new CSV
column.

## App

### Contracts

- `LearningProgressOverviewSchema.assessment` becomes `z.union([AvailabilitySchema, AssessmentOverviewSchema])`,
  discriminated on `availability`.
- `CourseCardSchema` gains `bestScorePercent` and `finalExamPassed`.

### Screens

| Where         | Change                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| learn page    | Two KPIs after the counts. "Điểm kiểm tra gần nhất" shows `{last.scorePercent}%` with the quiz title, and "Chưa đạt" is the only coloured label, used when `passed` is false. "Điểm cao nhất" shows `{best}%` with "Đạt {passedQuizCount}/{quizCount} bài kiểm tra". Each links to `/progress`. With `unavailable`, both KPIs are left out; they are not shown as "—". |
| progress page | KPI "Điểm trung bình" next to the existing counts. Table column "Điểm cao nhất" (sortable only if the backend sort map gains `bestScorePercent`; otherwise not sortable). The attempt list "Lịch sử làm bài" comes from `learnerQuizEndpoints.myAttempts`, paged, with a CSV from `exportAttempts`.                                                                    |

While here, the columns the mockup lists and the UI polish branch dropped come back: Bắt đầu, Truy cập gần nhất
(`startedAt`, `lastAccessAt`). The backend already returns them.

### Mock

The seed's summary and cards carry the new fields.

## Testing

- **Backend:**
  - `LearningProgressReportServiceTest`: no quiz → `unavailable`; one failed and one passed quiz → right best,
    average, passed/total and last.
  - The figures equal the matching `AttemptSummary`.
  - CSV header and row.
- **App:**
  - Schema spec parses both union branches.
  - Learn KPIs render, and are absent when `unavailable`.
  - Progress column and attempt list.
- **Local, as `hocvien`:** after the attempts made in `learner-quiz`, the learn KPIs and the progress column match
  the quiz intro's `AttemptSummary` and `/me/quiz-attempts`.

## Boundaries

- **Never:**
  - compute best, average or passed in the app;
  - show a score for a quiz the server did not return.

## Success criteria

1. On the local stack, `hocvien` sees "Điểm kiểm tra gần nhất" and "Điểm cao nhất · Đạt x/y bài kiểm tra" on the
   learn page. The values equal the backend response.
2. Progress shows "Điểm trung bình", the "Điểm cao nhất" column, Bắt đầu, Truy cập gần nhất and the attempt list.
   The CSV has the new column.
3. A learner with no quiz sees no score KPIs and no error.
4. `mvn clean test` and `npm run check` green.

## Open questions

1. **Average score:** is the average taken per quiz over its final scores (default), or over every graded attempt?
2. **Sorting by best score:** should "Điểm cao nhất" be sortable? That needs `bestScorePercent` in the backend sort
   map, which means a join on attempts. Default: not sortable.
