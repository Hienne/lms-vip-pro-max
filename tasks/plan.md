# Implementation Plan: `learner-competency`

Spec: [SPEC-learner-competency.md](../SPEC-learner-competency.md) (approved 2026-11-01 with this plan, amended
below). Map: [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

This plan replaces the one for `catalog-discovery`. That plan is done and merged (Hienne/lms-vip-pro-max#48,
hmhug19/corebanking-academy#16), and it is in git history at `2a298e0`.

## Overview

The learner sees their competency radar: "Biểu đồ năng lực" on the learn page, with a "Chi tiết" link to
`/progress`, and "Năng lực theo nhóm kiến thức" on the progress page. Both read `GET /api/v1/me/competency`, which
the backend already serves.

No backend change, no schema change.

## What was checked while planning (2026-11-01)

**Backend**

- `LearnerQuizController` serves `GET /api/v1/me/competency?courseId=`, and `AssessmentReportService.myCompetency`
  returns `MyCompetency(competencyId, code, name, totalQuestions, correctCount, maxScore, score, percent)`.
- **Which attempts count:** every graded attempt of the caller, not the best one. The endpoint's description and
  `docs/api/ASSESSMENT.md` both say "mọi lượt đã chấm".
- `percent` is `score × 100 / maxScore`, rounded to 2 decimals, and is **`null` when `maxScore` is 0**.
- On the local stack, `hocvien` gets three rows: 14.29, 11.11 and 33.33. `?courseId=1` also returns three rows.
- The progress summary still says `competency: unavailable`, and the spec keeps it that way.

**App**

- The contract exists already: `learnerQuizEndpoints.myCompetency` and `MyCompetencySchema` in
  `libs/contracts/src/lib/assessment/learner-quiz.*`, added by `learner-quiz`. **`percent` is `z.number()`**, so a
  row with `percent: null` would fail to parse.
- The mock already answers it (`libs/mocks/src/lib/assessment/learner-quiz.mock.ts`, `COMPETENCIES`).
- `ui-radar-chart` (`libs/ui/src/lib/organisms/charts`) takes `RadarDatum { name, value: number | null }`. It has a
  "Xem dạng bảng" data table. Its default series label is "Của bạn (lần thi tốt nhất)", which is wrong for this
  endpoint. It prints `value + '%'`, so 14.29 shows as "14.29%", not the app's "14,29%" (`fmtPct`).
  The admin report screen is its only user today.
- The learn page and the progress page show `app-unavailable-note`: "Giờ học, điểm kiểm tra và năng lực sẽ hiển
  thị khi hệ thống có dữ liệu." It counts `competency: unavailable`, so it would keep promising competency next to
  a radar that shows it.
- **Mockup:**
  - The learn page (`learner.js`) shows the radar when any competency has an answer, otherwise an empty state.
    The card sits in the main column, under "Khóa học của tôi".
  - The progress page (`tools.js`) shows "Năng lực theo nhóm kiến thức" as a radar card, size 320, with **no
    course select**.

## Spec amendments (written into the spec with this plan)

1. **`percent` can be null.** `MyCompetencySchema.percent` becomes nullable. A row with `percent: null` is
   `value: null` on the radar, so the data table shows it as no data. This replaces the spec's
   "`totalQuestions = 0` → null" rule: the server decides, through `percent`, when there is no data.
2. **The caption says every attempt.** The radar's series label is "Tỷ lệ đúng trên mọi lượt thi đã chấm". That is
   the server's rule, not "lần thi tốt nhất".
3. **Three ways to show it.**
   - Three or more rows with a non-null `percent`: the radar.
   - One or two such rows: no radar, because fewer than three axes do not read as a shape. The card shows the
     same rows as a short list (name, "x/y câu đúng", percent).
   - None: an inline empty state, "Chưa có dữ liệu năng lực", with one line saying the chart fills in after a
     quiz.

   This settles the spec's open question, and resolves its two conflicting lines (empty state vs. data table
   alone).

4. **No course select on progress** (default, following the mockup). The spec added one, but the mockup has none,
   and visual-design.md asks for no control the mockup does not need. The radar shows every course. If the user
   wants the select, it is one more task (T4b) and its success criterion comes back.
5. **The unavailable note stops speaking for competency.** `app-unavailable-note` ignores `competency` and its
   sentence drops "năng lực": "Giờ học và điểm kiểm tra sẽ hiển thị khi hệ thống có dữ liệu." The summary field
   stays as it is on the server.
6. **Percents in the app's format.** The radar's labels and data table use `fmtPct`. The number is the server's;
   only its display changes, from "14.29%" to "14,29%".

## Architecture decisions

- **One shared piece.** `shared/learning/competency/` holds:
  - a pure mapping `toRadarData(rows)`, with its spec;
  - `app-competency-view`, a component that owns the radar, the short list and the empty state.

  Both pages use it, so the rule of three lives in one place. Its inputs are `rows` and `size` (`compact` on the
  learn page, `large` on progress). It renders; it never fetches.

- **Each page's store loads the data.** `LearnStore` and `ProgressStore` each add one `serverData` read of
  `myCompetency`, with its own `competency$`, `competencyError$` and loading state. A failed read shows
  `ui-error-state` inside the card, with retry, and never hides the rest of the page.
- **`ui-radar-chart`.** `seriesLabel` is already an input. `fmtPct` replaces the raw `value + '%'` in its template
  and data table. The admin report screen gets the same formatting, which is a display change only.
- **Commits.**
  - One commit per task, on `feat/learner-mockup-gap` (fast-forwarded to `main` at `ab6f40a`).
  - Nothing is pushed.
  - The user's uncommitted `.claude/launch.json` and `docs/reports/…html` are never staged.

## Task list

### Phase 1: Contract and the shared piece

- [x] T1: `percent` nullable, with a fixture captured from the local backend
- [ ] T2: `toRadarData`, `app-competency-view`, and `fmtPct` in `ui-radar-chart`

### Checkpoint A

- [ ] `npm run check` green.
- [ ] Main session reviews the diff.

### Phase 2: The two pages

- [ ] T3: "Biểu đồ năng lực" card on the learn page
- [ ] T4: "Năng lực theo nhóm kiến thức" card on the progress page
- [ ] T5: The unavailable note drops competency
- [ ] T6: End-to-end check against the spec

### Checkpoint B

- [ ] Success criteria recorded, with how each was checked.
- [ ] Spec status set to built.
- [ ] Review with the user, then plan the next module (`learner-scores`).

## Risks and mitigations

| Risk                                                                     | Impact | Mitigation                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No local learner without graded attempts, so the empty state is not seen | Low    | T6 first checks for one with `curl`. If there is none, the empty state and the short list are covered by specs and by `mockBackend: true`, and T6 says which.       |
| The radar labels overlap on a 375 px card                                | Med    | The radar's SVG scales with its `viewBox`. T6 checks 375 px. If labels collide, the learn card shows the short list below 480 px instead (one CSS container query). |
| `fmtPct` in `ui-radar-chart` changes the admin report screen             | Low    | Display only. T2 runs the report screen specs, and T6 opens the report screen once.                                                                                 |
| The learn page gets slower                                               | Low    | One small extra GET, in parallel with the summary. It has its own loading state, so the rest of the page does not wait.                                             |

## Open questions

None of them blocks the plan. Amendment 4 (no course select) is the default; the user can ask for the select.
