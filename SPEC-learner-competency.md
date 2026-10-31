# Spec: `learner-competency`

Map: [SPEC.md](SPEC.md). Status: **draft, waiting for approval.** Depends on `learner-quiz`, which supplies the
graded attempts the radar is built from.

## Objective

The mockup's "Biểu đồ năng lực" card appears on the learn page (`learner.js` dashboard, link "Chi tiết" →
`progress`) and as "Năng lực theo nhóm kiến thức" on the progress page (`tools.js`). Both show one axis per
competency, at the caller's percent. `SPEC-learner-home.md` left the card out because the summary says
`competency: unavailable`. The backend has had `GET /api/v1/me/competency` all along. This module shows it.

## Backend

No change. `GET /api/v1/me/competency?courseId=` returns `MyCompetency[]`:

- `competencyId`, `code`, `name`
- `totalQuestions`, `correctCount`
- `maxScore`, `score`, `percent`

The numbers are computed by the server from graded attempts. `docs/api/ASSESSMENT.md` describes which attempt
counts. While building, the plan records whether that is the best attempt or every attempt. The answer only
changes the card's caption.

The progress summary keeps `competency: { availability }` as it is. `learner-scores` fills `assessment`, not
`competency`, because the radar has its own endpoint.

## App

- **Contract.** `learnerQuizEndpoints.myCompetency`, defined as
  `GET /api/v1/me/competency` with query `{ courseId?: number }`, returns `z.array(MyCompetencySchema)`. It goes in
  the `learner-quiz` contract file, beside the other `/me` assessment keys.
- **Radar mapping.** One `RadarDatum` per row: `{ name, value: percent }`. A competency with
  `totalQuestions = 0` is `value: null`, so the chart's data table shows it as no data rather than 0.
- **Learn page** (`features/learning/learn`). The card is titled "Biểu đồ năng lực" with a "Chi tiết" link to `/progress`.
  - It uses `ui-radar-chart`.
  - With fewer than three competencies that have data, it shows the empty state: "Chưa có dữ liệu năng lực", plus
    one line saying the chart fills in after a quiz.
  - The store loads it with `serverData`, alongside the summary.
- **Progress page** (`features/achievements/progress`). The card is titled "Năng lực theo nhóm kiến thức" and
  uses the same chart, larger.
  - A course select ("Tất cả khóa học" plus the caller's courses) sets `courseId`.
  - Under the chart, the data table gives each competency's correct answers out of total questions and its
    percent.
- **Mock.** `libs/mocks/src/lib/assessment` serves `/api/v1/me/competency` from its seed.

The radar uses chart tokens from the `ui` module only. No status colours.

## Testing

- **App:**
  - The store spec maps rows to `RadarDatum` with null for zero questions.
  - Component specs cover the empty state and the populated chart on both pages.
  - Changing the course select refetches with `courseId`.
- **Local, as `hocvien`:**
  - Before any graded attempt, the card shows the empty state.
  - After a graded demo quiz with two or more competencies, the radar matches the `curl` result of
    `/api/v1/me/competency`.

## Boundaries

- **Never:** compute percents in the app.
- **Never:** show a competency the server did not return.

## Success criteria

1. The learn page and the progress page each show the radar from `/api/v1/me/competency` on the local backend.
   The values match the API response.
2. The empty state shows when the caller has fewer than three competencies with data.
3. The course select on progress narrows the radar to one course.
4. `npm run check` green. The visual-design checklist passes for both cards.

## Open questions

1. **When to show the radar:** is three competencies with data the right minimum? The mockup shows the radar
   whenever any competency has data. Default: 3, because a radar with fewer axes does not read as a shape. Below
   that, the data table alone is shown.
