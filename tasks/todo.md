# Tasks: UX review Wave 0

Spec: [SPEC-ux-wave0.md](../SPEC-ux-wave0.md) · Plan: [plan.md](plan.md).
The previous `ui-polish` checklist is in git history (merged in PR #60).

Run `nvm use` first. Focused tests: `npx nx test lms`. Whole gate: `npm run check`. Commit per task, message naming
the module and review ID, ending with the attribution line.

## T1: Bundle the pdf.js worker and pass it as `workerPort` (P1)

**Acceptance criteria:**

- [x] `pdf-block/pdf.worker.ts` only imports `pdfjs-dist/build/pdf.worker.min.mjs`. `PdfEngine.open` creates one
      module worker from it on first use, sets `GlobalWorkerOptions.workerPort`, and reuses it. `WORKER` and
      `workerSrc` are gone.
- [x] The `pdf.worker.min.mjs` asset entry is removed from `apps/lms/project.json`.
- [x] The production build has a `worker-*.js` holding pdf.js (`WorkerMessageHandler`) and no `.mjs` file.

**Verification:** `npx nx test lms` (spec: one `Worker` for two `open` calls, `Worker` stubbed);
`npx nx build lms -c production` then `ls dist/apps/lms/browser`.

**Dependencies:** none · **Files:** `pdf-engine.ts`, `pdf.worker.ts` (new), `pdf-engine.spec.ts` (new or existing),
`apps/lms/project.json` · **Size:** S

## T2: Build manifest of workers, with a post-deploy MIME check in CI (P1)

**Acceptance criteria:**

- [x] The Dockerfile build stage fails if `dist/apps/lms/browser` holds any `.mjs`. It writes `workers.txt` listing
      every `worker-*.js` (at least one line).
- [x] In `ci.yml`, "Verify public frontend revision" reads `workers.txt?commit=$GITHUB_SHA` and, for each line, checks
      that `curl -sI` returns 200 with `content-type` containing `javascript`. The step fails otherwise.

**Verification:** `docker build --build-arg APP_REVISION=local .` succeeds, and `workers.txt` is in `/artifact`
(`docker create` + `docker cp`). If Docker is not available here, say so. Read through the CI shell with
`set -euo pipefail`.

**Dependencies:** T1 · **Files:** `Dockerfile`, `.github/workflows/ci.yml` · **Size:** XS

## Checkpoint A

- [ ] `npx nx test lms` green; the production build checked as in T1
- [ ] Browser (`lms-local-backend`, a PDF lesson): pages render; Network shows the worker as `worker-*.js`; screenshot

## T3: `MenuItem.upcoming` and `homePathFor` skipping upcoming functions (P4)

**Acceptance criteria:**

- [x] `MenuItem.upcoming` is true exactly when the function's entry screen has no `load`. Today that is
      `LESSON_MANAGEMENT`, `SYSTEM_AUDIT`, `KNOWLEDGE_HUB` and `ISSUE_HUB`.
- [x] `homePathFor` returns the first non-PROFILE function that is not upcoming, and `/profile` if there is none.
- [x] `allSections()` items carry `upcoming` too, since they share the type.

**Verification:** `npx nx test lms` (`menu-catalog.spec.ts`)

**Dependencies:** none · **Files:** `core/menu/menu-catalog.ts`, its spec, and any fixture or test building a
`MenuItem` literal · **Size:** S

## T4: Sidebar shows "Sắp ra mắt"; "Design System v2" only with dev tools (P4, U17)

**Acceptance criteria:**

- [ ] An upcoming item shows "Sắp ra mắt" after its label in `ui.text(xs, muted)` (wrapping under it when long). No
      badge, colour or row opacity. In the rail, the tooltip is "{label} · Sắp ra mắt".
- [ ] The design link renders only when `APP_CONFIG.devTools` is on. The footer keeps the collapse button.

**Verification:** `npx nx test lms` (`sidebar.spec.ts`: label, rail tooltip, link per flag)

**Dependencies:** T3 · **Files:** `layout/sidebar/sidebar.{html,scss,ts,spec.ts}` · **Size:** S

## T5: Coming-soon page replaces the migration placeholder (P4)

**Acceptance criteria:**

- [ ] The page is left-aligned with no icon. Its h2 is the route's title. Text: "Chức năng này đang được hoàn thiện và
      sẽ có trong bản cập nhật tới." It has a secondary "Về trang chủ" button to the session's `homePath`.
- [ ] No "mockup", "Angular" or "migrate" copy. The "Xem tiến độ migrate" link stays with `devTools` only.

**Verification:** `npx nx test lms` (`route-placeholder.spec.ts`, new or extended)

**Dependencies:** none (T3 makes `homePath` skip upcoming) · **Files:**
`features/errors/route-placeholder/route-placeholder.{html,scss,ts,spec.ts}` · **Size:** S

## T6: Login mockup note only with dev tools or the mock backend (U17)

**Acceptance criteria:**

- [ ] `.login__note` renders only when `devTools || mockBackend`.

**Verification:** `npx nx test lms` (`login.spec.ts`: hidden with both flags off, shown with either on)

**Dependencies:** none · **Files:** `features/auth/login/login.{html,ts,spec.ts}` · **Size:** XS

## Checkpoint B

- [ ] `npx nx test lms` green
- [ ] Browser, dev config: the sidebar marks the four entries; the coming-soon page; 1280/375, light/dark, rail
- [ ] Production flags: specs cover them. If the dev server can run with `devTools: false`, also screenshot the
      sidebar and the login page without the dev links

## T7: Gate "Thêm câu hỏi" / "Tạo bài kiểm tra" and rewrite the pending copy (P2 interim)

**Acceptance criteria:**

- [ ] With `integrationPending$`, "Thêm câu hỏi" is not rendered. The empty state reads "Ngân hàng câu hỏi theo
      chương trình chưa sẵn sàng" / "Câu hỏi dùng chung trong chương trình sẽ quản lý được tại đây sau bản cập nhật
      tới. Bài kiểm tra hiện có vẫn dùng bộ câu hỏi đã gán."
- [ ] With `integrationPending$`, "Tạo bài kiểm tra" is disabled. Its tooltip and `aria-describedby` text is "Cần ngân
      hàng câu hỏi theo chương trình để tạo bài kiểm tra mới." On `/admin/quizzes/new` the same sentence shows in a
      `ui-alert`, and saving is disabled. The config alert reads "Bộ câu hỏi hiện tại được giữ nguyên. Chọn thêm câu
      hỏi từ chương trình sẽ có sau bản cập nhật tới."
- [ ] With `mockBackend`, everything is as before.

**Verification:** `npx nx test lms` (`assessment-screen.spec.ts`: both CTAs pending vs mock, the new copy, and the old
"đang chờ kết nối API" assertion replaced)

**Dependencies:** none · **Files:** `features/quiz/assessment-screen/assessment-screen.{html,spec.ts}`, and the store
only if a selector is needed · **Size:** S

## T8: Pagination rows render only when there is more than one page (P2 interim)

**Acceptance criteria:**

- [ ] Every "Trang x / y" row in the assessment screens renders only when `totalPages > 1`. "Trang 1 / 0" can no
      longer appear.

**Verification:** `npx nx test lms` (0, 1 and 2 pages)

**Dependencies:** T7 (same files) · **Files:** `assessment-screen.{html,spec.ts}` · **Size:** XS

## Checkpoint C (complete)

- [ ] `npm run check` green
- [ ] Browser (`lms-local-backend`): `/admin/questions`, `/admin/quizzes`, `/admin/quizzes/new?courseId=3` at
      1280/375, light/dark; screenshots
- [ ] angular.md §14 and visual-design.md checklists reported
- [ ] P1, P4 and the interim P2 re-tested as the review reproduced them
- [ ] `SPEC-ux-wave0.md` status "built"; PLAN.md Wave 0 marked done
