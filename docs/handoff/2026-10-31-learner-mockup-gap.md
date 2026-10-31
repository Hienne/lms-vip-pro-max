# Handoff 2026-10-31: learner mockup gap (FE `lms vip pro max` + BE `corebanking-academy`)

Written on 2026-10-31 by the main session, which runs Claude Opus 5.5. The work moves to another account because this
account hit its usage limit. The document is on branch `feat/learner-mockup-gap` and is the starting point for the
new main session.

The user writes in Vietnamese and wants replies in Vietnamese. Code, identifiers, commits and docs are English.

## 1. Goal

The learner screens should match the read-only mockup in `lms-mockup/` as closely as possible:

- learn page, catalog, course page, lesson player;
- quiz flow, progress, saved items and notes;
- certificates and the leaderboard.

**Rule of precedence.** The mockup decides WHAT a screen shows: data, actions, states and copy.
`docs/conventions/visual-design.md` decides HOW it looks.

**Missing backend parts** are built in `~/my-projects/corebanking-academy` (Spring Boot, Java 21, Maven, PostgreSQL 16
with pgvector). Every schema change ships as a `docs/sql/` script, a rollback script and the `psql` command that
applies it.

**Everything runs on this machine.** The shared backend `103.121.90.119` is never touched.

The user's original request listed:

- competency radar;
- catalog filters by field, module and programme;
- the "Được giao" tab;
- KPI cards for last score, best score and "đạt x/y bài";
- status filters Chưa đạt / Quá hạn / Được giao, the "Xóa n bộ lọc" button, and sort by progress or name;
- "Xem chứng nhận" and star rating;
- a course breadcrumb with programme, plus field · module;
- notes, PDF page bookmarks and video bookmarks;
- lesson rating, comments, "hỏi giảng viên" and content reports;
- focus mode, transcript and video chapters;
- leaderboard, certificates and the saved page.

## 2. Source of truth

| File                                                                                          | What it is                                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`SPEC.md`](../../SPEC.md)                                                                    | Capability map: 10 modules, build order, the backend's state, shared commands and boundaries, decisions |
| `SPEC-<module>.md`                                                                            | One approved spec per module, each with its open questions and their accepted defaults                  |
| [`tasks/plan.md`](../../tasks/plan.md), [`tasks/todo.md`](../../tasks/todo.md)                | Plan and checklist of the module in progress (`learner-quiz`)                                           |
| [`SPEC-org-tree.md`](../../SPEC-org-tree.md)                                                  | An older, finished initiative, moved aside                                                              |
| `AGENTS.md` (both repositories), `docs/conventions/*.md`, backend `DEVELOPMENT_GUIDELINES.md` | Project rules: read them before writing code                                                            |

**Workflow, kept the same for every module.** It follows the `agent-skills` spec, then plan, then build steps.

1. The main session writes the spec, and the user approves it.
2. The main session writes the plan (`tasks/plan.md` and `tasks/todo.md`). The user approves it, and the main session
   commits it.
3. A child session on Sonnet 5.5 builds the plan. It makes one commit per task and stops at the checkpoints the plan
   names, often to show the backend diff.
4. The main session reviews the diff itself and relays the user's approval to the child.
5. When a module is done, the old plan stays in git history and the next module's plan replaces `tasks/plan.md` and
   `tasks/todo.md`.

## 3. Repositories and branches

| Repository                                         | Branch                                               | Head                                       | State                                                                |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| FE `/Users/nguyenhien/my-projects/lms vip pro max` | `feat/learner-mockup-gap` (from `main` at `5bf8b43`) | this handoff commit (before it, `cd07167`) | not pushed                                                           |
| BE `~/my-projects/corebanking-academy`             | `feat/learner-mockup-gap` (from `main`)              | `bfae8d6`                                  | not pushed, working tree clean                                       |
| FE `claude/learning-ui-polish-e4f473`              | 7 commits on `main`                                  | `d2bcdda`                                  | separate UI polish branch, waiting for the user's review; not merged |

**Uncommitted files in the FE checkout.** The child session stopped in the middle of a fix.

- `apps/lms/src/app/features/admin-content/course-editor/data-access/course-editor.store.ts` and `course-editor.spec.ts`:
  - **Bug:** after the server refused a publish, publishing again failed with "Xung đột dữ liệu", because the store
    sent the old `expectedVersion`.
  - **Fix:** it now uses the version the server holds. The course-editor spec is green (96 tests), but the full
    `npm run check` has not run since. Run it, then commit this as a separate `fix(course-editor): …` commit.
- `.claude/launch.json`:
  - Its `lms-local` entry (the app on :4200 → backend :8019) was added for this work and is deliberately left
    uncommitted.
  - It also holds the user's own changes, including `lms-main-review`.
  - **Never stage it.**
- `docs/reports/2026-10-30-qa-review.html`: the user's file. **Never stage it.**

## 4. Module status

Build order (from `SPEC.md`):

```text
local-stack → learner-quiz → catalog-discovery, learner-competency, learner-scores, learning-leaderboard
            → lesson-notes, lesson-feedback, certificates
lesson-player-modes: needs only local-stack, so it can go at any point
```

| #   | Module                 | Spec                                                               | Status                                                                                                                            |
| --- | ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `local-stack`          | [SPEC-local-stack.md](../../SPEC-local-stack.md)                   | **Built.** BE commits `c988133`…`bea51ed`; FE T1–T7 ticks and docs. T7 results are in git history at `55a756f` (`tasks/todo.md`). |
| 2   | `learner-quiz`         | [SPEC-learner-quiz.md](../../SPEC-learner-quiz.md) (+5 amendments) | **T1–T10 built.** T11 and Checkpoint C are left (section 5).                                                                      |
| 3   | `catalog-discovery`    | [SPEC-catalog-discovery.md](../../SPEC-catalog-discovery.md)       | spec approved, not planned. **Next.**                                                                                             |
| 4   | `learner-competency`   | [SPEC-learner-competency.md](../../SPEC-learner-competency.md)     | spec approved, not planned (FE only; `/me/competency` already exists)                                                             |
| 5   | `learner-scores`       | [SPEC-learner-scores.md](../../SPEC-learner-scores.md)             | spec approved, not planned                                                                                                        |
| 6   | `learning-leaderboard` | [SPEC-learning-leaderboard.md](../../SPEC-learning-leaderboard.md) | spec approved, not planned (table `learning_activity_days`)                                                                       |
| 7   | `lesson-notes`         | [SPEC-lesson-notes.md](../../SPEC-lesson-notes.md)                 | spec approved, not planned (tables `lesson_notes`, `lesson_bookmarks`)                                                            |
| 8   | `lesson-feedback`      | [SPEC-lesson-feedback.md](../../SPEC-lesson-feedback.md)           | spec approved, not planned (table `lesson_feedback`)                                                                              |
| 9   | `certificates`         | [SPEC-certificates.md](../../SPEC-certificates.md)                 | spec approved, not planned (no table; print or save as PDF from the browser)                                                      |
| 10  | `lesson-player-modes`  | [SPEC-lesson-player-modes.md](../../SPEC-lesson-player-modes.md)   | spec approved, not planned (2 jsonb columns on `lesson_blocks`)                                                                   |

The user approved every spec as written ("Duyệt"), so each spec's open questions are settled at their stated defaults.

### `learner-quiz` commits

**BE**

| Commit    | Change                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `920814c` | `course_lessons.quiz_id`, with upgrade and rollback scripts                                                                  |
| `e286ae3` | save and publish quiz lessons (port `LearningQuizDirectory`; codes `LEARNING-QUIZ_INVALID`, `LEARNING-QUIZ_LESSON_UNLINKED`) |
| `4e263f7` | passing a quiz completes its quiz lesson (hook in `AttemptGrader`, one-way)                                                  |
| `594a83c` | `GET /api/v1/me/courses/{courseId}/quizzes`                                                                                  |
| `bfae8d6` | demo quiz lessons and docs                                                                                                   |

The main session read the backend diff and found no blocking issue. The user approved it.

**FE**

| Commit              | Change                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `de3aeb7`…`399b663` | spec amendments and ticks                                            |
| `a042aa7`           | contracts and a stateful mock                                        |
| `d387b18`           | hub, intro and attempts                                              |
| `6516a18`           | take screen                                                          |
| `febc7c4`           | result screen; learner code removed from `AssessmentScreen`          |
| `26e246a`           | narrow-screen layout fix                                             |
| `570ad09`           | course page "Bài kiểm tra" section and the quiz lesson in the player |
| `cd07167`           | quiz picker in the course editor                                     |

**Checkpoints.** Checkpoint A (`mvn clean verify`, 310 tests) and Checkpoint B (`npm run check`, browser check on
`lms-local`, and the admin screens on `mockBackend: true`) are both ticked in `tasks/todo.md`.

## 5. What to do next, in order

1. **Finish `learner-quiz` (T11 and Checkpoint C).** This is a job for the child session:
   1. run `npm run check`, then commit the publish-retry fix from section 3;
   2. run `mvn clean verify` in the backend;
   3. as `quantri` in the browser:
      - add a quiz lesson to a draft and pick the final exam;
      - publish;
      - try publishing with a quiz from another course, and check that the server's error shows;
   4. as `hocvien`:
      - fail, then pass the quiz from the course page;
      - check that the lesson and the course become complete;
   5. write success criteria 1–5 into `tasks/todo.md`, with how each was checked. The child reported criteria 1–4
      already checked by hand and criterion 5 still open;
   6. tick T11 and Checkpoint C, and set the status in `SPEC-learner-quiz.md` to built;
   7. stop and report to the main session.
2. **Review with the user.** The main session reviews the FE diff for `learner-quiz` (`0569c38..HEAD`) against
   `docs/conventions/angular.md` §14 and the visual-design checklist, then reports to the user.
3. **Plan the next module.** The main session plans `catalog-discovery`: it reads the code, writes
   `tasks/plan.md` and `tasks/todo.md` (replacing the old ones, which stay in git history), gets the user's
   approval, commits, and hands the build to a Sonnet child. The same loop then repeats for
   `learner-competency`, `learner-scores`, `learning-leaderboard`, `lesson-notes`, `lesson-feedback`,
   `certificates` and `lesson-player-modes`.
4. **The UI polish branch** (`claude/learning-ui-polish-e4f473`).
   - **Background:** the user asked for it, a child session built it, and a before/after comparison is at
     <https://claude.ai/artifact/Mqt4NnyJiMgByqwCcNekf7>. The user said "Tôi xem trước đã" and has not decided.
   - **What it removed:** some things the mockup specifies:
     - the progress columns Bắt đầu and Truy cập gần nhất;
     - the "Bắt buộc" tab, which became a chip;
     - the "Bài trước" / "Bài tiếp theo" labels;
     - the result page's primary action "Về khóa học" with the review collapsed;
     - the question code on the take screen.
   - **What the modules already restore:** `learner-quiz` already brought back the result and take items on this
     branch, `learner-scores` brings back the progress columns, and `catalog-discovery` brings back the tabs.
   - **Still to check:**
     - whether the "Bài trước" / "Bài tiếp theo" labels are back;
     - the file `apps/lms/src/app/core/learning/resume-point.ts`, which computes the resume point in the app,
       against "business rules stay on the server".
   - **Rule:** do not merge or push without the user.

## 6. Running the local stack

Full steps are in FE `docs/conventions/workspace.md` → "Run against a local backend" and in BE
`docs/sql/README.md` → "Chạy local".

```bash
cd ~/my-projects/corebanking-academy
open -a Docker
docker compose -f compose.yaml -f compose.local.yaml --env-file .env.local up -d db s3 s3-init
set -a; . ./.env.local; set +a; mvn spring-boot:run
scripts/local-smoke.sh
```

Steps that are needed only on an empty volume: run `scripts/local-db-init.sh` before starting the backend (the
`mvn spring-boot:run` line), and `scripts/local-seed-media.sh` after it.

Then, in the FE repository:

```bash
nvm use
LMS_API_TARGET=http://localhost:8019 npm start
```

For the browser pane, use `preview_start` with the `lms-local` entry.

- **Local services:**
  - Postgres `127.0.0.1:5432` (`pgvector/pgvector:pg16`, DB `core_academy`);
  - S3 `127.0.0.1:9000` (`bitnamilegacy/minio:2025.7.23-debian-12-r5`; the official `minio/minio` and `minio/mc`
    images can no longer be pulled, and the user chose this one);
  - backend `127.0.0.1:8019`.
- **`.env.local` (BE):** git-ignored, already on this machine. It holds `LOCAL_DEMO_PASSWORD` and the DB and S3
  secrets. On another machine, copy it from `.env.local.example` and take the demo password from
  `docs/sql/README.md` → "Đăng nhập demo". Never print passwords or commit them.
- **Accounts:** `hocvien` (learner), `hocvien.tichhop` (second learner), `giangvien`, `quantri` (admin and editor),
  `quantri.ban`, `baocao`.
- **Demo data:**
  - courses `FE-DEMO-C1` and `FE-DEMO-C2`, each with a PRACTICE quiz, a FINAL_EXAM quiz and a required quiz lesson;
  - course `DEMO-MEDIA`, with a READY PDF (4 pages) and a READY video (30 s).

## 7. Rules that hold for every task

- **Git:**
  - Never push, open a PR or deploy without the user.
  - One commit per task, in each repository the task touched. Stage files by name, never `git add -A`.
  - End commit messages with a `Co-Authored-By` line for the model that wrote them.
- **Schema and SQL:**
  - Every schema change needs an upgrade script, a rollback script, the `psql` command and an entry in BE
    `docs/sql/README.md`.
  - No FK or `REFERENCES`, no business `UNIQUE`, every column commented.
  - Flyway stays off, and `ddl-auto=validate` stays.
- **Scope of changes:**
  - Business rules (scores, progress, points, permissions, scope) stay on the server. The app renders server
    results.
  - No new Maven or npm dependency without asking.
  - No user seeding, password reset or role grant.
  - Only local databases.
- **Tests:**
  - Backend tests for new code are DB-backed ITs in package `assessment`, extending `AssessmentIntegrationTest`.
    There is no `learning` test package. The user allowed tests for code this initiative adds.
  - Edits to existing tests are allowed only when needed, and must be reported.
- **Done means:**
  - `npm run check` (FE) and `mvn clean verify` (BE) are green;
  - angular.md §14 and the visual-design checklist pass;
  - the success criteria are checked in the browser on the local stack;
  - the report says how each item was verified.

## 8. Known facts and traps

- **Asset status.** It is lower case (`ready`), not `READY`.
- **Skipped tests.** `mvn clean verify` skips 42 `CommunityApiIT` tests. That is not caused by this work.
- **Test base class.** `AssessmentIntegrationTest` now also loads the Community baseline (commit `ca86712`).
  Without it, the context does not start whenever Docker is available.
- **Quiz countdown.** It is computed from the server's `deadlineAt` and `serverTime` plus the time elapsed on the
  client. The client clock is never compared with the server clock. Three test runs failed until this was right.
- **Slow commands.** `npm run check` and `mvn clean verify` take several minutes. Run them in the background and
  wait for completion, not by polling.
- **Pinned facts from the specs:**
  - `/api/v1/training-catalog/*` refuses learners, so `catalog-discovery` adds `/me/learning/facets`;
  - a certificate is a completed enrollment cycle, with no table;
  - the learning leaderboard is separate from the community board.
- **Quiz lesson completion is one-way.** A regrade from pass to fail does not lower `lesson_progress`. A pass in
  an older enrollment cycle does not complete the quiz lesson of a new cycle.

## 9. Sessions and models on the new account

| Role                | Model                                       | Where                                                                                                                                                                                                                                                        | Does                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Main session        | **Claude Opus 5.5** (`claude-opus-5-5`)     | FE repository, this checkout, branch `feat/learner-mockup-gap`                                                                                                                                                                                               | Talks to the user in Vietnamese. Writes specs and plans. Reviews diffs itself. Relays approvals. Never builds a whole module itself.                                                                                     |
| Child build session | **Claude Sonnet 5.5** (`claude-sonnet-5-5`) | Started by the main session with `start_session`. `initiation: user_asked`, `context: fresh`, `use_worktree: false` (it shares this checkout and the branch, and also edits the BE repo at `~/my-projects/corebanking-academy`), `model: claude-sonnet-5-5`. | Builds one module's `tasks/todo.md` in order, commits per task, and stops at each checkpoint. Follow-ups go to the same child with `SendMessage`. Start a new child for a new module once the old one's context is long. |

At most one child builds at a time, because both share the same files and branch. The main session does not edit
code while a child is building.

The prompts the user pastes into the new account are in [handoff-prompts](#10-prompts-for-the-new-account) below.

## 10. Prompts for the new account

### 10.1 Main session (Opus 5.5)

Open a session in the FE folder `/Users/nguyenhien/my-projects/lms vip pro max` on branch `feat/learner-mockup-gap`,
select model Opus 5.5, and paste:

```text
Bạn là main session (Opus 5.5) tiếp quản công việc từ một account khác đã hết limit.
Trả lời tôi bằng tiếng Việt; code, commit, docs bằng tiếng Anh.

Đọc trước, theo thứ tự:
1. docs/handoff/2026-10-31-learner-mockup-gap.md (toàn bộ trạng thái, quy tắc, bước tiếp theo)
2. SPEC.md, rồi SPEC-learner-quiz.md, tasks/plan.md, tasks/todo.md
3. AGENTS.md và docs/conventions/*.md ở repo này; AGENTS.md và DEVELOPMENT_GUIDELINES.md ở ~/my-projects/corebanking-academy

Sau đó:
- Kiểm tra lại trạng thái thật: git log/status ở cả hai repo (branch feat/learner-mockup-gap),
  stack local (docker compose ps, curl localhost:8019/actuator/health) và báo tôi những gì khác với tài liệu.
- Mở một session con bằng start_session: initiation user_asked, context fresh, use_worktree false,
  model claude-sonnet-5-5, để làm mục 5.1 trong tài liệu handoff (hoàn thành T11 và Checkpoint C của learner-quiz,
  gồm commit bản sửa publish-retry của course editor sau khi npm run check xanh). Brief cho session con phải gồm
  các quy tắc ở mục 7 và 3 (không stage .claude/launch.json và docs/reports/2026-10-30-qa-review.html, không push).
- Khi session con báo xong: tự review diff FE của learner-quiz (0569c38..HEAD) theo angular.md §14 và checklist
  visual-design, báo tôi kết quả, rồi lập plan cho catalog-discovery theo quy trình ở mục 2 và chờ tôi duyệt.

Không push, không merge, không mở PR khi tôi chưa yêu cầu.
```

### 10.2 Child build session (Sonnet 5.5)

The main session normally starts this child itself, with the brief from 10.1. Use this prompt only to open the child
by hand, in the same folder, with model Sonnet 5.5:

```text
Bạn là session con build (Sonnet 5.5) cho initiative learner mockup gap. Làm việc trong checkout này
(/Users/nguyenhien/my-projects/lms vip pro max, branch feat/learner-mockup-gap) và repo backend
~/my-projects/corebanking-academy (branch feat/learner-mockup-gap). Trả lời bằng tiếng Việt; code/commit/docs tiếng Anh.

Đọc: docs/handoff/2026-10-31-learner-mockup-gap.md (mục 3, 5.1, 6, 7, 8), SPEC-learner-quiz.md, tasks/plan.md,
tasks/todo.md, AGENTS.md của cả hai repo.

Việc: hoàn thành T11 và Checkpoint C của learner-quiz đúng như mục 5.1:
1. npm run check (chạy nền, chờ xong); xanh thì commit riêng bản sửa publish-retry đang chưa commit
   (course-editor.store.ts, course-editor.spec.ts) với message fix(course-editor): …
2. mvn clean verify ở backend.
3. Kiểm end-to-end trên stack local bằng browser pane (preview_start lms-local): quantri thêm bài quiz vào bản nháp,
   chọn đề cuối khóa, xuất bản, thử đề của khóa khác (phải hiện lỗi server); hocvien trượt rồi đạt bài từ trang khóa,
   bài học và khóa hoàn thành.
4. Ghi tiêu chí 1–5 vào tasks/todo.md (kèm cách kiểm), tick T11 và Checkpoint C, đặt status SPEC-learner-quiz.md là built,
   commit.
5. Dừng và báo: commit (hash, subject) từng repo, đã kiểm gì và bằng cách nào, việc bỏ qua hoặc cần lưu ý.

Quy tắc: mỗi task một commit, stage từng file, commit kết thúc bằng
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"; không stage .claude/launch.json và
docs/reports/2026-10-30-qa-review.html; không push; chỉ chạy local; mật khẩu chỉ lấy từ biến môi trường, không in ra;
không thêm dependency, không seed user. Gặp test không xanh được, lệch schema, hay việc cần quyết định ngoài spec
thì dừng và hỏi.
```
