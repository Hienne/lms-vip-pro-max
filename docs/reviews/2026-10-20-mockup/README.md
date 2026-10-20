# FE mockup review — 2026-10-20

This review covers the five requested feature groups. The reference is
`E:/final-mockup/lms-mockup/src/pages/` and its current API modules, not the
legacy HTML files at the root of `E:/final-mockup`.

The Angular app was run in the browser and its affected flows exercised. The
changes use the existing shell, UI directives, Signal Forms, token palette and
endpoint contracts. No Java implementation or endpoint promotion to `backend`
is included. Migration entries have updated evidence notes; their owner,
status and formal verification flags have not been marked complete.

## Changes

| Group                        | UI and behavior restored                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assessment                   | Question bank KPIs, filters, table, selection and question drawer; individual answer editors and preview; two-column quiz configuration; introduction, confirmation, focused test screen, timer, question navigator, result review and history. |
| Learner dashboard            | Greeting, continue-learning action, completion KPIs, course tabs/cards, competency radar, learning journey and deadlines.                                                                                                                       |
| Reports                      | Overview KPIs and charts, filters, course table, detail navigation, eight dimension-specific tables, sorting, pagination and CSV export.                                                                                                        |
| Saved items and certificates | Bookmark/note tabs, anchored navigation, note editor inside a lesson, certificate cards and paper preview, PDF download.                                                                                                                        |
| Motivation and reminders     | Course progress, competency chart, earned/locked badges and actual progress, notification tabs, individual/all read actions and unread counts.                                                                                                  |

Shared SVG radar, bar and donut charts render the response data, including
missing-data states and accessible text/table alternatives. Course cards omit
unavailable metadata instead of inventing a duration or level. Certificate
paper colors are semantic tokens so the document stays legible in either theme.

Forms preserve their values when requests fail and close only after a successful
save. Quiz answer autosaves are silent, pending saves are flushed before submit,
and failed saves retain the attempt and expose retry. The timer uses the server
deadline and does not submit a newly loading attempt at an initial zero value.
Resume sequencing respects the server revision. These are FE transport/lifecycle
changes; grading remains a server responsibility.

## Browser evidence

The following actions were exercised against the in-app mock API in a development
build. The seeded user accounts are `hocvien` and `super.admin`, password
`Demo@123`. These credentials are local demo fixtures.

| Screen / flow      | Observed result                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard          | Correct card/grid structure, tab switching and empty state; continue-learning navigation; light and dark themes.                                                                      |
| Question bank      | Filter by question type; create a disposable question with two options; save, bulk status change, edit explanation and delete that test question. Existing seeded questions retained. |
| Question drawer    | Individual answer fields, correct-answer selector, add/remove options and validation; mobile drawer in dark theme.                                                                    |
| Quiz configuration | Existing values, pool selection and dates rendered; too many questions for the pool blocked; valid save succeeded. Unsaved changes trigger the existing leave confirmation.           |
| Quiz attempt       | Start confirmation, keyboard answer/navigation, multiple answers, flagging, submit summary and confirmation, result and answer/explanation review.                                    |
| Reports            | Overview charts; 30-day selection; search and column sorting; empty filtered result; all eight report dimensions; CSV download and success feedback.                                  |
| Notes/bookmarks    | Required-note validation, save a note at PDF page 5, bookmark at page 5, saved-item tabs and video bookmark navigation at 04:10.                                                      |
| Progress           | Course table, competency radar and earned/locked badges with actual fixture progress.                                                                                                 |
| Notifications      | Open unread certificate notification, decrement count, mark all read and verify unread empty state.                                                                                   |
| Certificate        | Preview and download of the sample PDF. Print action is wired; an OS print dialog was not exercised.                                                                                  |

Affected screens were checked at viewport widths 375, 768 and 1280 pixels.
No whole-page horizontal overflow was observed. Wide tables and the report
navigation retain their own horizontal scroll. See
[responsive measurements](assets/responsive-checks.json). Browser error logs
on the stable review tab were empty at the end of report testing. This is
targeted manual QA, not a full end-to-end suite or pixel-identical certification.

### Screenshots

- [Learner dashboard](assets/dashboard-1280.jpg)
- [Dashboard in dark theme](assets/dashboard-dark-1280.jpg)
- [Question bank](assets/questions-1280.jpg)
- [Mobile question drawer](assets/question-drawer-dark-375.jpg)
- [Quiz configuration](assets/quiz-config-1280.jpg)
- [Test attempt](assets/quiz-take-1280.jpg)
- [Result and answer review](assets/quiz-result-1280.jpg)
- [Reports overview](assets/reports-1280.jpg)
- [Report detail](assets/reports-detail-1280.jpg)
- [Progress and badges](assets/progress-1280.jpg)
- [Certificate preview](assets/certificate-1280.jpg)

## Automated verification

- 133 related tests passed: assessment lifecycle and mutation handling (16),
  fixtures/mock backend and charts (68), styling/migration guards (38), and
  shared course cards (11).
- Nx `lint`, `typecheck`, `build` and `check-bundle` passed for the four projects
  (10 tasks). Production contains no mock fixtures, dev toolbar or migration
  board; staging contains no mock fixtures.
- Production initial bundle is 854.29 kB: above the existing 500 kB warning
  threshold and below the hard limit. No affected component stylesheet budget
  warning remains. Existing lint warnings remain outside this change.
- Full `npm run check` stopped at the repository-wide formatting gate, reporting
  553 files. The repository was not bulk-formatted. Only changed/new source files
  were formatted for this review. Full-check completion is therefore pending.

## Integration limits and required data

All new/proposed feature endpoints remain on their existing mock contracts.
Request/response DTO fields stay camelCase (for example `correctCount`). These
UI checks do not establish that the SQL schema and live Java API are integrated.
Confirm the actual wire contract before switching any registry entry to
`backend`.

| Area             | Integration still required                                                                                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question bank    | Real server-side filters, complete pagination and aggregate counts. Current FE filters operate on the loaded question collection; bulk actions use the existing per-question operations. Confirm atomic bulk semantics if required.                            |
| Quiz list        | DTO currently lacks several mockup columns, including duration/pool and scheduling details. Supply the agreed list summary rather than guessing from question count. Configuration detail already carries its own fields.                                      |
| Attempts/results | Persisted autosave, deadlines, grading, attempt limits, review permissions and history from the real API. The mock grading response is fixed (50% in the reviewed attempt) and does not calculate the selected answers.                                        |
| Dashboard cards  | Optional cover, modules, duration, level and best score where required by the full mockup. Missing values are omitted.                                                                                                                                         |
| Lesson content   | A real lesson/content endpoint and authorized file/media URLs, PDF page count, video duration and progress/anchor contract. This change implements notes/bookmark tools around the available lesson context; it does not implement a real PDF or video viewer. |
| Progress         | Learning-hours/weekly activity/aggregate attempt data for additional mockup statistics. Current progress uses achievements plus the existing dashboard competency response.                                                                                    |
| Certificates     | Authorized real PDF bytes and verification data. The downloaded file is the sample fixture PDF.                                                                                                                                                                |
| Notifications    | Actual server events and deadline reminders. The FE displays API data and does not generate reminder events itself.                                                                                                                                            |
| Reports          | Real scoped datasets and CSV responses respecting the same filter/sort inputs. Fixed fixtures cannot prove production permissions, aggregation or large-result behavior.                                                                                       |

## Local preview

The stable review build is in `dist/visual-review/browser` and is served at
`http://127.0.0.1:4301`. It was built with the mock backend enabled for isolated
UI testing. This is development output, not a deployment artifact.

The source `environment.ts` retains `mockBackend: false`, so the normal app
continues to use the configured backend where applicable. The preview server
uses SPA fallback for direct links. The mockup reference was served at port 4300. A hard reload may require signing in again because demo authentication
is ephemeral.
