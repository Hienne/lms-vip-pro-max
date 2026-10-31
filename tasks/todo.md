# Tasks: `local-stack`

Spec: [SPEC-local-stack.md](../SPEC-local-stack.md) · Plan: [plan.md](plan.md).

**Repositories.**

- **BE:** `~/my-projects/corebanking-academy`.
- **FE:** this repository.
- **Branch:** `feat/learner-mockup-gap` in both, from `main`. Not pushed.

**Passwords.** Commands read them from `PGPASSWORD` and `LOCAL_DEMO_PASSWORD`. They are never typed into a
command line or a log.

## Phase 1: Local services

- [x] **T1: Local Postgres + MinIO with a bucket (BE)**
  - Acceptance:
    - `compose.local.yaml` adds three services, alongside `db` from `compose.yaml`:
      - `s3`: `bitnamilegacy/minio` pinned to a tag (the official `minio/*` images are no longer
        pullable), on `127.0.0.1:9000` and `:9001`, with volume
        `core_academy_s3` and a healthcheck.
      - `s3-init`: same image (it bundles `mc`), run once. It creates bucket `academy-media` and a user whose policy covers only
        that bucket.
    - `.env.local.example` lists every key the backend reads, with local values (`DB_URL` on `localhost:5432`,
      `S3_ENDPOINT=http://localhost:9000`, `S3_PATH_STYLE_ACCESS=true`) and `change-me` placeholders for secrets.
    - `.gitignore` gets `!.env.local.example`.
  - Verify:
    - `docker compose -f compose.yaml -f compose.local.yaml --env-file .env.local up -d db s3 s3-init` → `db`
      and `s3` are healthy and `s3-init` exits 0.
    - `docker compose … run --rm s3-init mc ls local/academy-media` → the bucket exists.
    - `git check-ignore .env.local` → ignored.
  - Files: `compose.local.yaml`, `.env.local.example`, `.gitignore`.
  - Size: S. Depends on: none (Docker Desktop running).

- [x] **T2: Empty-DB init script and run order (BE)**
  - Acceptance:
    - `scripts/local-db-init.sh` runs these files in order: Identity, Learning, media_progress, Assessment,
      Knowledge, Community, community catalog, then `learning_hub_learning_demo.sql`,
      `learning_hub_community_demo.sql` and `learning_hub_community_verify.sql`.
    - It uses `ON_ERROR_STOP=1` and refuses to run when `learning_hub.users` exists.
    - `docs/sql/README.md` gets a "Chạy local" section: this order, with Assessment in it, and the commands.
  - Verify:
    - On a fresh volume (`docker compose … down -v` first), the script exits 0 and the verify script reports no
      error.
    - A second run stops with the "DB đã có dữ liệu" message and changes nothing.
  - Files: `scripts/local-db-init.sh`, `docs/sql/README.md`.
  - Size: S. Depends on: T1.

### Checkpoint A

- [ ] With `set -a; . ./.env.local; set +a; mvn spring-boot:run`, the backend starts with no `validate` error
      (gaps are reported, not patched) and `curl -s localhost:8019/actuator/health` shows `UP`.
- [ ] The logs show no connection to `103.121.90.119` or `s3.chanacademy.io.vn`.
- [ ] `mvn clean test` green on the branch (a baseline before any code change).

## Phase 2: Demo data

- [ ] **T3: Assessment demo SQL (BE)**
  - Acceptance:
    - `docs/sql/learning_hub_assessment_demo.sql` is dev/test only. It has a header like the learning demo's, runs
      once (a second run errors and rolls back) and uses no hard-coded ids (`RETURNING`).
    - It creates at least 3 competencies and at least 12 active questions with options spread over them, on
      lessons of two published demo courses.
    - Per course: one published PRACTICE quiz and one published FINAL_EXAM quiz.
    - It is added to `local-db-init.sh` after the learning demo, and to the README table.
  - Verify:
    - On a fresh init, the script runs.
    - Signed in as `hocvien`, `curl` of `GET /api/v1/me/quizzes/{id}` returns `SUCCESS` with `canStart` (or a
      `blockReason` the demo explains).
    - Starting and submitting an attempt returns a result.
  - Files: `docs/sql/learning_hub_assessment_demo.sql`, `scripts/local-db-init.sh`, `docs/sql/README.md`.
  - Size: M. Depends on: T2.

- [ ] **T4: Smoke script (BE)**
  - Acceptance:
    - `scripts/local-smoke.sh` checks that health is UP.
    - It logs in as `hocvien` with `LOCAL_DEMO_PASSWORD` and keeps the cookie or token in a temp file it deletes
      on exit.
    - It checks that `GET /api/v1/me/learning/catalog`, `GET /api/v1/me/quiz-attempts` and
      `GET /api/v1/me/learning/progress/summary` each return `status: SUCCESS`.
    - It prints one line per check and exits non-zero on the first failure. It never echoes the password.
  - Verify:
    - Run it → exit 0.
    - With the backend stopped → non-zero with a clear message.
    - With a wrong password → non-zero, and the password does not appear in the output.
  - Files: `scripts/local-smoke.sh`.
  - Size: S. Depends on: T3.

- [ ] **T5: Demo media and seed script (BE)**
  - Acceptance:
    - `docs/sql/demo-media/` holds two files generated here, each under 2 MB:
      - `demo-core-banking.pdf`: 4 pages;
      - `demo-core-banking.mp4`: about 30 s, H.264/yuv420p and AAC, faststart.
      - A `README.md` says how they were made.
    - `scripts/local-seed-media.sh`, signed in as `quantri`:
      - uploads both files (`POST /api/v1/learning-assets`) and waits until each is READY;
      - creates course `DEMO-MEDIA` in a demo field, programme and module;
      - saves a tree with one lesson holding a PDF block and one holding a video block;
      - publishes it and assigns it to `hocvien`, following `LEARNING_CURL.md` §10–13 and §19.
    - When `DEMO-MEDIA` already exists, it skips.
  - Verify:
    - After the run, `GET /api/v1/learning-assets?status=READY` lists both assets.
    - As `hocvien`, `GET /api/v1/me/learning/courses` includes `DEMO-MEDIA`.
    - A second run prints "đã có, bỏ qua".
  - Files: `docs/sql/demo-media/*` (3), `scripts/local-seed-media.sh`.
  - Size: M. Depends on: T4.

### Checkpoint B

- [ ] Starting from `docker compose … down -v`, run `up`, `local-db-init.sh`, the backend, `local-seed-media.sh`
      and then `local-smoke.sh`, all green, in one pass, with the commands exactly as in the README.
- [ ] `mvn clean test` green. Review the backend diff with you before Phase 3.

## Phase 3: App on the local stack

- [ ] **T6: Docs and launch entry for a local backend (FE)**
  - Acceptance:
    - `docs/conventions/workspace.md` → Commands gets "Chạy với backend local". It gives
      `LMS_API_TARGET=http://localhost:8019 npm start`, a pointer to the backend's "Chạy local" section, and the
      seeded accounts (by name, no password).
    - `.claude/launch.json` gets an `lms-local` entry with `LMS_API_TARGET`, added with Edit; your existing
      changes are left as they are.
  - Verify:
    - `preview_start lms-local` opens the app.
    - The dev-server proxy log shows `/api` going to `localhost:8019`.
    - `npx prettier --check docs/conventions/workspace.md`.
  - Files: `docs/conventions/workspace.md`, `.claude/launch.json`.
  - Size: XS. Depends on: Checkpoint B.

- [ ] **T7: End-to-end check against the spec (FE + BE)**
  - Acceptance: all six success criteria of `SPEC-local-stack.md` are checked in the browser pane, and the result
    of each is written here with how it was checked:
    1. empty-volume bring-up;
    2. smoke;
    3. sign-in as `hocvien` and the catalog listing;
    4. READY PDF and video;
    5. a quiz with ≥ 2 competencies;
    6. no outside request.
  - Verify:
    - Sign in as `hocvien`; open the catalog, `DEMO-MEDIA`, the PDF lesson and the video lesson, and a demo
      quiz.
    - The network panel shows only `localhost`.
    - `lsof -nP -iTCP -sTCP:ESTABLISHED | grep -E '103\.121\.90\.119|chanacademy'` is empty.
    - `npm run check` green (nothing in the app changed except docs and launch).
  - Files: `tasks/todo.md` (results).
  - Size: S. Depends on: T6.

### Checkpoint C

- [ ] The spec's success criteria 1–6 are recorded above.
- [ ] `npm run check` and `mvn clean test` green.
- [ ] `SPEC-local-stack.md` status set to built.
- [ ] Review with you, then plan `learner-quiz`.
