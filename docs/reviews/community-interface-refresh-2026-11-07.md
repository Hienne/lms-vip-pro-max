# Community interface refresh — 2026-11-07

## Delivered scope

- Questions, Articles and Architecture Reviews use aligned horizontal list rows: cover, title, excerpt, byline, inline metrics and one status badge. The sidebar owns Community navigation; duplicate page navigation and duplicate topic sidebars were removed. Search, topic, status, sorting and pagination remain available.
- Question details use compact horizontal voting, author-first answers, accepted-answer status, comments, a smaller answer composer and a contextual information panel. Existing server capabilities still control writes.
- Article details include a cover, a body-derived table of contents, helpful voting, discussions and related content queried through existing scoped endpoints. Related content excludes the current item and has loading/error/retry handling.
- Review details include a cover and contextual shortcuts to reviewers and conclusions. Existing revisions, version-bound threads, invitations, resolution and conclusion actions remain controlled by backend capabilities.
- Review authoring now exposes the existing cover picker separately from the design-file control. Replacing/removing a cover preserves design files and attachment metadata.

## Default thumbnail behavior

The shared thumbnail renders an uploaded image first. Missing, unreadable or failed images fall back to one of twelve photographs. A stable index based on content ID and kind rotates the selection: neighbouring IDs vary, while a list row and its detail agree. It intentionally does not randomize on each render, which would cause covers to jump during filtering or navigation. This also updates existing consumers such as Mine/Saved rows through the shared component.

### Generated asset provenance

- Saved production asset: `apps/lms/public/images/community-defaults.png` (1932 × 814, 4 columns × 3 rows).
- Source tool: built-in ImageGen, one generation. No external image credentials or image-editing pipeline were used.
- The asset is wired into `ContentThumbnail` as a CSS sprite; all twelve images ship with the app and require no third-party image host.
- Final prompt summary: A production photographic sprite atlas with exactly twelve equal edge-to-edge landscape tiles in a 4 × 3 grid, no gutters, borders, typography or watermarks. Professional banking technology subjects: engineers collaborating, server corridor, desk and notebook, network equipment, analyst workstation, office atrium, circuit board, architecture whiteboard discussion, server racks, quiet workspace, developer typing and operations control room. Realistic editorial photography, muted teal/gray/wood palette, restrained contrast, no UI overlays.

## Backend compatibility

Read-only source inspection of sibling `corebanking-academy` found existing cover support in `CommunityContentService` and the review DTO/service. Cover files use the existing authenticated Community media upload/read endpoints and revision assets with `usage: cover`; ReviewCard includes ContentCard fields through its unwrapped DTO. Existing backend validation checks cover count and ready image assets. No endpoint, database migration, permission change or backend edit was necessary for this UI task. Production upload behavior was not retested or deployed in this task.

## Verification

- Node 24 used directly through the bundled runtime because `nvm`/`npm` were unavailable in this shell.
- Nx lint, typecheck, production build and bundle checks across LMS, UI, contracts and mocks passed (10 tasks). Existing warning budgets remain warnings.
- Community and Markdown: 103 tests passed; the subsequent article-outline/related-query test also passed (7 tests in the content spec). Tests cover upload/save/remove, default fallback/rotation, voting, answer acceptance/posting, topic filtering, review state transitions and cancellation.
- Contracts: 295 passed. Mocks: 340 passed. UI: 550 passed. The contracts inventory expectation was corrected to include the already-existing weekly dashboard activity endpoint; no API behavior changed.
- Browser: all six list/detail screens at 1280 and 375 px, light/dark (24 cases), no horizontal overflow and no page JavaScript errors. Also checked accepted-answer rendering, article outline targets, the conclusion shortcut and review cover control. Screenshots and browser results are under ignored `dist/community-ux/`.
- Browser data: Questions/Articles use the seeded in-app mock. Review uses temporary contract-shaped fixtures injected only into the local development session because FakeBackend has no review handlers. These fixtures are not part of application source. Review API writes are covered by HttpTestingController integration specs, not a live production end-to-end test.
- Design checklist: semantic tokens; no duplicate navigation, hero, gradient, decorative status colors or icon tiles; one status badge per list row. Deliberate differences from generated mockups: existing accessible primitives and token-based typography/radii; real server metrics and capabilities, no invented read-time, view-count, reviewer avatars or attachment previews.
- Angular checklist: no new legacy APIs or component state; endpoint state remains in stores, responses parsed by endpoint schemas, icon controls named, loading/error/retry/empty states retained.
- Raw repository-wide Prettier check reports CRLF line endings in 1,216 existing checkout files. The same check with `--end-of-line auto` passes across the repository. Changed files are formatted with the configured default LF; no repository-wide line-ending rewrite was made.
- Full LMS test status is recorded below after the final run.
