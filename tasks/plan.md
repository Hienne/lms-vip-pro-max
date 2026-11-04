# Implementation Plan: UX review Wave 0

Spec: [SPEC-ux-wave0.md](../SPEC-ux-wave0.md) (approved 2026-11-04; amended below). Tasks: [todo.md](todo.md).
Review plan: [PLAN.md](../docs/reviews/2026-11-04-ux-review/PLAN.md). The previous `ui-polish` plan is in git history
(merged in PR #60).

## Overview

Three app-only modules: the pdf.js worker bundled as a script chunk (`pdf-worker-mime`), the four unbuilt screens marked
"Sắp ra mắt" with a proper coming-soon page and the dev-only links hidden (`unfinished-screens`), and the question bank
actions gated while the program bank is missing (`question-bank-gate`).

## Findings from the codebase

- `apps/lms/project.json` already sets `webWorkerTsConfig`, and `sha256-hasher.ts` uses the
  `new Worker(new URL('./sha256.worker', import.meta.url), { type: 'module' })` pattern. Angular emits it as
  `worker-<hash>.js`. The pdf worker follows the same pattern. pdf.js 6.4 (`pdfjs-dist@6.4.299`) accepts
  `GlobalWorkerOptions.workerPort`.
- The worker is about 1.2 MB. Budgets only cover `initial` and component styles, so a lazy worker does not trip them.
  `tools/check-production-bundle.mjs` is a marker check (dev-only strings), not a size check. No guard change is
  needed.
- **CI check method (the spec's open question):** the worker is loaded lazily, so its name is not in `index.html`.
  The Dockerfile build stage writes `workers.txt`, one `worker-*.js` name per line, next to `version.txt`. It also
  fails the image build if any `.mjs` file is left in the output. The deploy job's verify step reads
  `workers.txt?commit=$GITHUB_SHA` and runs `curl -sI` on each name, asserting 200 and a `javascript` content type.
  This covers the sha256 worker too.
- The menu is built in `core/menu/menu-catalog.ts` (`navFor`, `homePathFor`), called once in
  `core/session/to-profile.ts`. Exactly four screens have no `load`: `admin/lessons`, `admin/system`, `knowledge`,
  `issues`.
- `RoutePlaceholder` already injects `APP_CONFIG` and reads `data.mockupPage`. The route `title` is available from
  the route.
- `assessment-screen.store.ts` already exposes `integrationPending$` (false with `mockBackend`). The CTAs are in
  `assessment-screen.html` lines ~6–24, the pending empty state at ~122, the config alert at ~555 and the picker
  pagination at ~598.

## Architecture decisions

1. **The worker is a bundled module worker created once.** A module-level `let port: Worker | undefined`, set on the
   first `open`, is passed through `workerPort`. pdf.js does not terminate a port it was given, so it is reused
   across documents.
2. **`upcoming` is derived, not configured.** `MenuItem.upcoming = !menuGroup(code).screens[0].load`. Building a
   screen clears the label with no other edit.
3. **The coming-soon page reads the home path from the session.** It uses the session store's `homePath`, the same
   value the router uses after sign-in. There is no hard-coded `/`.
4. **Amendment to the spec's Boundaries:** one commit per task (the `/build` loop), each naming its module and review
   ID, instead of one commit per module.

## Dependency graph

```text
T1 pdf worker bundle ── T2 Dockerfile workers.txt + CI verify
T3 menu upcoming ── T4 sidebar label + dev-only link
T5 coming-soon page          (independent)
T6 login dev-only note       (independent)
T7 question bank gate + copy ── T8 pagination only when > 1 page
```

The three chains touch different files and could run in parallel. The default is sequential, T1 → T8.

## Task list

### Phase 1: `pdf-worker-mime`

- [ ] T1: Bundle the pdf.js worker and pass it as `workerPort`
- [ ] T2: Build manifest of workers, with a post-deploy MIME check in CI

### Checkpoint A

- [ ] `npx nx test lms` green; `npx nx build lms -c production` has a pdf `worker-*.js` and no `.mjs`
- [ ] Browser (`lms-local-backend`): a PDF lesson renders; the worker request is a `.js` chunk

### Phase 2: `unfinished-screens`

- [ ] T3: `MenuItem.upcoming` and `homePathFor` skipping upcoming functions
- [ ] T4: Sidebar shows "Sắp ra mắt"; "Design System v2" only with dev tools
- [ ] T5: Coming-soon page replaces the migration placeholder
- [ ] T6: Login mockup note only with dev tools or the mock backend

### Checkpoint B

- [ ] `npx nx test lms` green
- [ ] Browser: production-config flags (`devTools: false`) and dev config, 1280/375, light/dark, rail

### Phase 3: `question-bank-gate`

- [ ] T7: Gate "Thêm câu hỏi" / "Tạo bài kiểm tra" and rewrite the pending copy
- [ ] T8: Pagination rows render only when there is more than one page

### Checkpoint C (complete)

- [ ] `npm run check` green
- [ ] angular.md §14 and visual-design.md checklists; screenshots
- [ ] P1, P4 and the interim P2 re-tested as the review reproduced them; spec marked built

## Risks and mitigations

| Risk                                                                                                  | Impact | Mitigation                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pdf.js fails to start from a bundled worker (for example `import.meta` or top-level code differences) | High   | T1 is first. The browser check at Checkpoint A comes before anything else. Fallback: build a Blob URL from the fetched `.mjs` and record it in the plan |
| Vitest/jsdom has no `Worker`                                                                          | Low    | Stub `globalThis.Worker` in the spec, as the sha256 hasher spec does (or skip if that spec uses another seam)                                           |
| The CI verify step cannot be run from this machine                                                    | Med    | Verify the Dockerfile part locally with `docker build`. The verify step is shell only and reviewed. The first `main` deploy proves it                   |
| Production config cannot sign in locally for the browser check                                        | Med    | Override `APP_CONFIG.devTools` in a browser check (dev server with a temporary env), or rely on specs for the flag and screenshot the dev config        |
| "Sắp ra mắt" squeezes long labels in the 240px sidebar                                                | Low    | The label wraps under the name (block, `xs`). Check at 1280 with the longest label "Hệ thống & nhật ký"                                                 |

## Open questions

None.
