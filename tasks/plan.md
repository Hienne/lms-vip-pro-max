# Implementation Plan: `local-stack`

Spec: [SPEC-local-stack.md](../SPEC-local-stack.md), approved 2026-10-31. Map: [SPEC.md](../SPEC.md).
Tasks: [todo.md](todo.md).

This file replaces the plan for the org tree and import from file. That work is merged on `main`; its plan is in
git history at `d9fe5a3`. The plans for the later modules (`learner-quiz`, …) are written one at a time, after
this one is done and reviewed.

## Overview

Run the whole product on this machine: Postgres with pgvector and MinIO in Docker, the backend from
`~/my-projects/corebanking-academy` on `:8019`, and the app on `:4200` proxied to it. Load every baseline and
demo, add the two missing kinds of demo data (quizzes, READY PDF and video), and add a smoke script that proves
it. Most of the work is in the backend repository: config, SQL and scripts. In this repository there is one
docs section and one launch entry.

## What was checked while planning (2026-10-31)

- **Tools.** `docker`, `psql`, `mvn`, `java 21.0.1`, `ffprobe` and `ffmpeg` are installed. Docker Desktop is
  not running; it must be started before T1. `ffprobe` is needed for a video to become READY (`LEARNING.md`
  §upload).
- **Secrets and git.** The backend `.gitignore` ignores `.env.*` and keeps only `.env` tracked, so `.env.local`
  stays out of git. `.env.local.example` must be added with `!.env.local.example`.
- **Current `.env`.** It points at the shared DB and at AIStor on Ubuntu through an SSH tunnel. It is not changed.
- **No bucket at startup.** The backend never creates its bucket ("không tự tạo bucket/IAM khi khởi động",
  `DEPLOY_UBUNTU.md`), so the local stack creates it in an init container.
- **Seeded accounts.** `learning_hub_identity.sql` creates the schema and the demo accounts (`hocvien`,
  `giangvien`, `quantri`, `quantri.ban`, `hocvien.tichhop`, …) with `must_change_password=false`.
- **What the demo lacks.** `learning_hub_learning_demo.sql` has no quiz and no READY asset (only FAILED files in a
  draft). The quiz and media demo data are added in T3 and T5.
- **Run order from the SQL headers and the README.** Identity → Learning → media/progress → Assessment (needs
  Identity and Learning) → Knowledge (pgvector) → Community → community catalog → demos → verify. The README's
  order has no place for Assessment yet; T2 records it.
- **Sign-in.** `POST /api/v1/auth/login`. Health is `GET /actuator/health`.
- **Upload.** A single `POST /api/v1/learning-assets` call still works for small files, so the seed script does
  not need the multipart flow. Course setup follows `LEARNING_CURL.md` §10–13 and §19: create, save tree, publish,
  assign.

## Architecture decisions

- **MinIO image.** Local S3 is the community `minio/minio` image, pinned to a release tag. Production's AIStor
  needs a licence and is S3-compatible, and the backend uses the MinIO Java SDK either way.
- **Bucket creation.** A one-shot `minio/mc` service creates the bucket and a bucket-scoped access key. This
  mirrors production, where the backend does not use the root account.
- **Local environment.** `.env.local` is loaded into the shell (`set -a; . ./.env.local`). Environment variables
  win over the `optional:file:./.env` import in `application.yml`, so `.env` keeps working for anyone who uses the
  shared DB.
- **DB init script.** One script, `scripts/local-db-init.sh`, runs the SQL files in order with
  `ON_ERROR_STOP=1`. It refuses to run when `learning_hub.users` already exists, so it never touches a DB that
  has data.
- **Demo media.** The sample files are generated here: `ffmpeg` test pattern and tone, about 30 s, H.264 + AAC;
  a PDF of four text pages. They are committed under `docs/sql/demo-media/`, as the spec allows. No external
  file.
- **Seed script.** `scripts/local-seed-media.sh` drives the public API as `quantri`. It does not write SQL
  for assets, because a READY asset must have passed the real probe pipeline. It does nothing if its course code
  `DEMO-MEDIA` already exists.
- **Passwords.** Every script reads passwords from environment variables (`LOCAL_DEMO_PASSWORD`,
  `PGPASSWORD`) and never prints them.
- **Branches.** `feat/learner-mockup-gap` in both repositories, from `main`. Nothing is pushed.

## Task list

### Phase 1: Local services

- [ ] T1: Local Postgres + MinIO with a bucket (BE)
- [ ] T2: Empty-DB init script and run order (BE)

### Checkpoint A

- [ ] The backend starts on local DB and S3 with `ddl-auto=validate`. `/actuator/health` is UP.

### Phase 2: Demo data

- [ ] T3: Assessment demo SQL (BE)
- [ ] T4: Smoke script (BE)
- [ ] T5: Demo media and seed script (BE)

### Checkpoint B

- [ ] From an empty volume: init, then demos, then seed, then smoke, all green.

### Phase 3: App on the local stack

- [ ] T6: Docs and launch entry for a local backend (FE)
- [ ] T7: End-to-end check against the spec (FE + BE)

### Checkpoint C

- [ ] The spec's success criteria 1–6 are checked and reported.

## Risks and mitigations

| Risk                                                                                       | Impact | Mitigation                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A baseline fails on an empty DB (an undocumented order, or an extension needing superuser) | High   | T2 runs first on a fresh volume. Extensions are created by the `core_academy` owner in the pgvector image; any failure is fixed in the order, not in the SQL. |
| `ddl-auto=validate` fails because an entity is ahead of the SQL                            | High   | Seen at Checkpoint A. A real schema gap is reported to you; the entity is not edited to make startup pass.                                                    |
| The community catalog needs an actor with the right role (`quantri.ban`)                   | Med    | The Identity baseline already grants it. If not, stop and ask: no role grants by script.                                                                      |
| A generated MP4 fails the probe (codec or pixel format)                                    | Med    | Generate with `-c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart`. T5 checks for READY before going on.                                             |
| Knowledge or Community workers try to reach external AI or S3 at startup                   | Med    | Check the logs at Checkpoint A. Workers stay disabled through their existing properties in `.env.local`.                                                      |
| `.claude/launch.json` has your uncommitted changes                                         | Low    | T6 adds one entry with Edit and does not rewrite the file. Your changes are not committed with it.                                                            |

## Open questions

1. **Commits.** The backend's AGENTS.md says to commit only when asked. May each task be committed on
   `feat/learner-mockup-gap` in its repository, never pushed? Default: yes, once you approve this plan.
