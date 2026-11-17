# 0001. CHAN Academy is a user-facing name; technical identifiers keep "corebanking-academy"

Date: 2026-11-17 · Status: accepted

## Context

The product is renamed from "Core Banking Academy" to **CHAN Academy** (Connect · Harness ·
Accelerate · Nurture; see `GLOSSARY.md`). The old name is also baked into technical identifiers:
the backend repository and Maven `artifactId` (`corebanking-academy`), the Java package
(`vn.com.coreacademy`), the container image (`ghcr.io/hmhug19/corebanking-academy`), the deploy
script's image check, log file names and Postman collections.

## Decision

Change only what a user sees: the browser title, header, sidebar, sign-in page, certificate,
chat-room scene, user guide and the AI assistant's self-description. Keep every technical
identifier as it is. Dated review documents keep the name they were written under.

## Consequences

- Repository, package and image names no longer match the product name. That is expected; do not
  "fix" it as a drive-by.
- Renaming the identifiers stays possible later as its own migration (CI image path, deploy digest
  check, package move), without touching the UI.
- Certificates render the name at view time, so certificates issued before the rename also show
  CHAN Academy.
