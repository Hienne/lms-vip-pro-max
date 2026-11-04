# Spec: UX review, Wave 0

Plan: [docs/reviews/2026-11-04-ux-review/PLAN.md](docs/reviews/2026-11-04-ux-review/PLAN.md) §4 Wave 0. Review:
[README.md](docs/reviews/2026-11-04-ux-review/README.md). Status: **approved 2026-11-04; planned in `tasks/plan.md` (amendments there).**

Three small packages that need no product decision and no backend change. Each one is a section of this spec, gets
its own commit series and can ship alone. No capability map: none depends on another.

| Module id            | Review IDs            | Repo | Size |
| -------------------- | --------------------- | ---- | ---- |
| `pdf-worker-mime`    | P1 / B1               | app  | XS   |
| `unfinished-screens` | P4 / B3, U17          | app  | S    |
| `question-bank-gate` | P2 (interim)          | app  | S    |

Decisions (2026-11-04): bundle the pdf.js worker as `.js` instead of changing the server; the four unfinished screens
stay in the menu marked "Sắp ra mắt"; the question bank keeps its menu entry with the actions gated; `/design-system`
keeps its route, only its links are hidden.

---

## 1. `pdf-worker-mime`

### Objective

Every PDF lesson fails on production: `/pdfjs/pdf.worker.min.mjs` is served as `application/octet-stream`, and the
browser refuses a module worker without a JavaScript MIME type. The frontend nginx config lives on the server, not in a
repo. The app stops depending on how the server types `.mjs`.

### Requirements

- A worker entry `pdf.worker.ts` next to `pdf-engine.ts` that only imports `pdfjs-dist/build/pdf.worker.min.mjs`.
  The Angular build bundles it as a hashed `.js` chunk via the existing `webWorkerTsConfig`
  (`apps/lms/tsconfig.worker.json`), and nginx serves `.js` as JavaScript by default.
- `PdfEngine.open` uses `GlobalWorkerOptions.workerPort` with one module worker created on first use,
  `new Worker(new URL('./pdf.worker', import.meta.url), { type: 'module' })`, and reuses it for later documents.
  `workerSrc` and the `WORKER` constant go.
- The asset entry that copies `pdf.worker.min.mjs` to `pdfjs/` is removed from `apps/lms/project.json`.
- The bundle guard in `npm run check` still passes. The worker is a lazy chunk and not part of the initial bundle. If
  the guard counts it, raise the guard only for that chunk and record why.
- CI, after "Verify public frontend revision": open `index.html` from production, find the pdf worker chunk name,
  then check with `curl -sI` that it returns 200 with a `javascript` content type. If the chunk name cannot be found
  in `index.html`, the build writes it to a small manifest such as `version.txt` or a sibling file, and CI reads it
  from there.

### Success criteria

1. `/lesson/2/4` (as `hocvien`) and the QA-TEST-3010 PDF render pages on the deployed site.
2. No `.mjs` file is requested at runtime: the Network tab shows the worker as a `.js` chunk.
3. The CI step fails if the worker chunk is missing or not served as JavaScript.

### Testing

- `pdf-engine` spec, where jsdom can run it: `workerPort` is set once and reused across two `open` calls (stub `Worker`).
- Browser, local production build (`npx nx build lms -c production`, served statically): open a PDF lesson; check the
  worker request and its `Content-Type`; screenshot.

---

## 2. `unfinished-screens`

### Objective

Four menu entries (Quản lý bài giảng `admin/lessons`, Hệ thống & nhật ký `admin/system`, Kho tri thức `knowledge`,
Tra cứu sự cố `issues`) open a page that says the mockup screen "chưa được chuyển sang Angular". Production also shows
"Design System v2" in the sidebar and "Bản mockup v2 · dữ liệu giả lập" on the login page. Users should see that a
function is coming, in their own words, and nothing about how the app is built.

### Requirements

**Coming-soon entries**

- A screen without `load` is "upcoming". `MenuItem` gains `upcoming: boolean`, true when the entry screen of the
  function has no `load`. It is computed in `navFor` from `screens.ts`, so it updates when a screen is built.
- Sidebar: an upcoming item keeps its icon and label and adds "Sắp ra mắt" after the label as muted text
  (`ui.text(xs, muted)`). No badge, no colour, no opacity on the whole row. In rail mode the tooltip reads
  "{label} · Sắp ra mắt". The link still works, and `aria-current` is unchanged.
- `homePathFor` skips upcoming functions, so no role lands on a coming-soon page after sign-in.
- The placeholder page (`features/errors/route-placeholder`) becomes the coming-soon page, left-aligned per
  visual-design.md:
  - Title: the screen's title from the route (for example "Kho tri thức").
  - Text: "Chức năng này đang được hoàn thiện và sẽ có trong bản cập nhật tới."
  - Action: "Về trang chủ" (secondary button), going to the user's `homePath`.
  - No icon tile, no illustration, and never "mockup", "Angular" or "migrate".
  - With `devTools`, the "Xem tiến độ migrate" link stays, below the action, as it is today.
- `Screen.mockupPage` stays for the dev migration board. The page no longer prints it.

**Dev-only links**

- Sidebar footer: the "Design System v2" link renders only when `APP_CONFIG.devTools` is true. The collapse button
  stays. If the footer is then empty, it renders nothing.
- Login: the `.login__note` paragraph ("Bản mockup v2 · dữ liệu giả lập · Xem Design System") renders only when
  `devTools` or `mockBackend` is true.
- The `/design-system` route is unchanged.

### Success criteria

1. With `devTools: false` (production config), the four entries show "Sắp ra mắt", and opening one shows the
   coming-soon page with the screen title and "Về trang chủ". No "mockup / Angular" text appears anywhere a signed-in
   user can reach from the menu.
2. No role's home is an upcoming screen.
3. With the production config, the sidebar has no "Design System v2" link and the login page has no mockup line. With
   the development config, both are still there.

### Testing

- `menu-catalog` spec: `upcoming` is true exactly for the four functions; `homePathFor` skips an upcoming first
  function.
- `sidebar` spec: the "Sắp ra mắt" text, the rail tooltip, and the design link present or absent per `devTools`.
- `route-placeholder` spec: title from route data, the copy, "Về trang chủ" target; the board link only with
  `devTools`.
- `login` spec: the note is hidden with `devTools: false, mockBackend: false`.
- Browser: 1280 and 375px, light and dark, sidebar expanded and rail, signed in as `super.admin` and `hocvien`.

---

## 3. `question-bank-gate`

### Objective

Until the program question bank is built (`question-bank`, D1), `/admin/questions` shows "Ngân hàng theo chương
trình đang chờ kết nối API" but still offers "Thêm câu hỏi". `/admin/quizzes` offers "Tạo bài kiểm tra", which leads
to a builder that cannot pick questions, and the picker shows "Trang 1 / 0". Users should not be offered actions that
cannot work, and the wording should be theirs.

### Requirements

All gating keys off the store's existing `integrationPending$`. It is true when the backend lacks the program bank
endpoints and `mockBackend` is off, so the mock backend keeps the full flow for development.

- `/admin/questions`: when pending, "Thêm câu hỏi" is not rendered. The empty state reads:
  - title "Ngân hàng câu hỏi theo chương trình chưa sẵn sàng";
  - description "Câu hỏi dùng chung trong chương trình sẽ quản lý được tại đây sau bản cập nhật tới. Bài kiểm tra
    hiện có vẫn dùng bộ câu hỏi đã gán."
- `/admin/quizzes`: when pending, "Tạo bài kiểm tra" is disabled with a tooltip and an `aria-describedby` text,
  "Cần ngân hàng câu hỏi theo chương trình để tạo bài kiểm tra mới." The existing quiz list still loads and opens.
- `/admin/quizzes/new` reached by URL while pending: the builder shows the same sentence in a `ui-alert` and keeps its
  save action disabled. It no longer says "khi hệ thống cập nhật hỗ trợ".
- The config screen's "Bộ câu hỏi" alert says "Bộ câu hỏi hiện tại được giữ nguyên. Chọn thêm câu hỏi từ chương trình
  sẽ có sau bản cập nhật tới." This is the same meaning without "hệ thống cập nhật hỗ trợ".
- Picker pagination: the "Trang trước / Trang x / y / Trang sau" row renders only when `totalPages > 1`. "Trang 1 /
  0" never shows. Any other "Trang x / y" in the assessment screen follows the same rule.
- Nothing changes when `integrationPending$` is false. The `question-bank` package removes this gate.

### Success criteria

1. With the production config against the real backend, `/admin/questions` shows no "Thêm câu hỏi" and no "API" in
   its copy, and `/admin/quizzes` shows "Tạo bài kiểm tra" disabled with the reason.
2. No "Trang 1 / 0" anywhere in the assessment screens.
3. With `mockBackend: true`, both actions work as today.

### Testing

- `assessment-screen.spec.ts`: pending vs mock for both CTAs, the new copy (the existing "đang chờ kết nối API"
  assertion is updated), pagination hidden at 0 and 1 pages and shown at 2.
- Browser: `/admin/questions`, `/admin/quizzes`, `/admin/quizzes/new?courseId=3` against the local backend
  (`lms-local-backend`), at 1280 and 375px.

---

## Commands

```bash
nvm use
```

```bash
npx nx test lms
```

```bash
npm run check
```

```bash
npx nx build lms -c production
```

Browser: `preview_start` with `lms-local-backend` (backend on :8019, branch `feat/course-publish-targets`), or `lms`
with `mockBackend` for the mock path.

## Project structure (files expected to change)

```text
apps/lms/src/app/features/lesson/lesson/components/pdf-block/pdf-engine.ts      workerPort
apps/lms/src/app/features/lesson/lesson/components/pdf-block/pdf.worker.ts      new worker entry
apps/lms/project.json                                                           drop the .mjs asset
.github/workflows/ci.yml                                                        post-deploy worker check
apps/lms/src/app/core/menu/menu-catalog.ts (+ spec)                             upcoming, homePathFor
apps/lms/src/app/layout/sidebar/sidebar.{html,scss,ts,spec.ts}                  "Sắp ra mắt", dev-only link
apps/lms/src/app/features/errors/route-placeholder/*                           coming-soon page
apps/lms/src/app/features/auth/login/login.{html,ts,spec.ts}                    dev-only note
apps/lms/src/app/features/quiz/assessment-screen/assessment-screen.{html,spec.ts} gate, copy, pagination
apps/lms/src/app/features/quiz/assessment-screen/data-access/assessment-screen.store.ts  only if a selector is needed
```

## Code style

Follow the surrounding code: signals and store selectors, `APP_CONFIG` for flags, tokens through the `ui` module,
English identifiers and comments, Vietnamese UI copy.

```ts
export interface MenuItem {
  readonly code: FunctionCode;
  readonly href: string;
  readonly icon: IconName;
  readonly label: string;
  readonly section: string;
  /** The function's entry screen is not built yet: the sidebar marks it "Sắp ra mắt". */
  readonly upcoming: boolean;
}
```

## Boundaries

- **Always:** test first; `npm run check` green; angular.md §14 and the visual-design.md checklist at 1280 and 375px,
  light and dark; one commit per task (plan amendment). Commit messages name the review IDs (for example `fix(lesson): bundle the
  pdf.js worker as a script chunk (P1)`).
- **Ask first:** changing the bundle guard beyond the worker chunk; hiding a menu entry instead of marking it;
  touching the backend repo; any new dependency.
- **Never:** "mockup", "Angular", "API" or "migrate" in copy a production user can reach; a badge or a status colour
  for "Sắp ra mắt"; removing the mock path that `integrationPending$` keeps working.

## Success criteria (whole wave)

1. Each module's criteria above pass, checked in the browser and recorded with screenshots.
2. `npm run check` is green.
3. The review items P1, P4 and the interim part of P2 are re-tested the way the README reproduced them, and they
   now pass.

## Open questions

None blocking. The CI check of the worker chunk depends on how the chunk name can be read from the deployed build.
The plan step picks the method (scan `index.html` or emit a manifest).
