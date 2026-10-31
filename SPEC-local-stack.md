# Spec: `local-stack`

Map: [SPEC.md](SPEC.md). Status: **draft, waiting for approval.**

## Objective

Every later module is built and checked on this machine. Today that is not possible.
`corebanking-academy/.env` points the backend at the shared database (`103.121.90.119:5432/appdb`) and at a
remote S3 (`s3.chanacademy.io.vn`). Docker is not running and nothing listens on `:5432`.

This module gives one repeatable way to run the app on local services only, and a smoke check that proves it:

- a local Postgres with pgvector;
- a local S3-compatible store;
- the backend on `:8019`;
- the app on `:4200`, proxied to that backend.

Done means a developer can go from nothing to signing in as `hocvien` on `localhost:4200`, with data from the
local DB. They do it by following one README section, and nothing calls `103.121.90.119`.

## What is added

### Backend repository (`corebanking-academy`)

| File                                            | Purpose                                                                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose.local.yaml`                            | Adds a MinIO service (`127.0.0.1:9000`, console `:9001`, volume `core_academy_s3`) next to `db` from `compose.yaml`                                                                                            |
| `.env.local.example`                            | Every key the app needs, pointing at `localhost` (DB `jdbc:postgresql://localhost:5432/core_academy?currentSchema=learning_hub`, `S3_ENDPOINT=http://localhost:9000`); placeholders for secrets                |
| `docs/sql/learning_hub_assessment_demo.sql`     | Demo competencies, questions and quizzes for the demo courses (dev/test only, one run, `RETURNING`, no hard-coded ids), so quiz screens have data                                                              |
| `docs/sql/README.md` (new section "Chạy local") | The order to run baselines and demos on an empty local DB                                                                                                                                                      |
| `scripts/local-smoke.sh`                        | `curl` checks against `localhost:8019`: health, sign-in as `hocvien`, `GET /api/v1/me/learning/catalog`, `GET /api/v1/me/quiz-attempts`. It reads the password from `LOCAL_DEMO_PASSWORD` and never prints it. |

The user's existing `.env` is not changed. A local run loads `.env.local` into the environment, which takes
precedence over the `.env` import in `application.yml`.

The demo media (one PDF, one MP4) is uploaded through the existing asset upload API as `quantri`. It is then
attached to a demo course through the course editor API. All of this is driven by `scripts/local-smoke.sh
--seed-media` with sample files from `docs/sql/demo-media/`, so the PDF and video blocks have READY assets.

### This repository

- `README.md` (or `docs/conventions/workspace.md` → Commands): "Run against a local backend" with
  `LMS_API_TARGET=http://localhost:8019 npm start`. `proxy.conf.mjs` already supports this, so no code change.
- `.claude/launch.json`: a `lms-local` entry with `LMS_API_TARGET` set, for the browser preview.

## Commands

```bash
cd ~/my-projects/corebanking-academy
cp .env.local.example .env.local
docker compose -f compose.yaml -f compose.local.yaml --env-file .env.local up -d db s3
export PGPASSWORD="$(grep '^DB_PASSWORD=' .env.local | cut -d= -f2-)"
for f in identity learning media_progress knowledge assessment community community_catalog \
         learning_demo assessment_demo community_demo; do
  psql -h localhost -U core_academy -d core_academy -v ON_ERROR_STOP=1 -f docs/sql/learning_hub_$f.sql
done
set -a; . ./.env.local; set +a; mvn spring-boot:run
LOCAL_DEMO_PASSWORD=… scripts/local-smoke.sh --seed-media
```

The `community_catalog` script has `v_org_code` and `v_actor_name` set at the top, and the defaults
(`BIDV110B803`, `quantri.ban`) match the Identity baseline. The exact file list and order come from
`docs/sql/README.md` and are checked while building: the assessment baseline's position relative to Knowledge
is not documented yet.

Then in this repository:

```bash
LMS_API_TARGET=http://localhost:8019 npm start
```

## Testing strategy

There is no unit test, because this module is configuration and scripts. Verification:

1. `scripts/local-smoke.sh` exits 0.
2. `learning_hub_community_verify.sql` passes on the local DB.
3. In the app at `localhost:4200`, sign in as `hocvien`, then open the catalog, a course and a lesson.
   The network panel shows only `localhost` requests.
4. While the stack runs, `lsof -i` shows no connection to `103.121.90.119`.

## Boundaries

- **Always:** keep `.env.local` out of git. It is already covered if `.gitignore` has `.env*`; check this and add
  it if it is missing. Keep the demo SQL dev/test only, under the same header warnings as
  `learning_hub_learning_demo.sql`.
- **Ask first:** the MinIO image. It is a new container, but not a Maven or npm dependency. The image is
  `bitnamilegacy/minio` (pinned tag, includes `mc`). The official `minio/minio` and `minio/mc` images can no longer
  be pulled (Docker Hub and quay.io both refuse). This image is frozen and gets no security updates, which is
  acceptable for local-only use on loopback ports.
- **Never:**
  - change `.env` or the shared DB;
  - seed users beyond the Identity baseline;
  - print the demo password in scripts, logs or this spec.

## Success criteria

1. On an empty Docker volume, the commands above bring up DB and S3. They apply every baseline and demo with no
   error, and the backend starts with `ddl-auto=validate`.
2. `scripts/local-smoke.sh` passes: sign-in and the three GET calls return `status: SUCCESS`.
3. The app on `:4200` signs in as `hocvien` and lists the demo courses from the local DB.
4. At least one demo course has a READY PDF block and a READY video block.
5. At least one demo course has a published quiz with questions in two or more competencies.
6. No request leaves the machine: checked with the browser network panel and `lsof`.

## Open questions

1. **MinIO:** is adding `compose.local.yaml` with MinIO acceptable? The alternative is lesson media without
   real files, which would leave PDF bookmarks and video chapters unverifiable.
2. **Sample media:** may two small sample files (a PDF of a few pages and a short MP4, both made here) be
   committed under `docs/sql/demo-media/`?
