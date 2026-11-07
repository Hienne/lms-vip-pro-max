# Community architecture review readiness

Initial source audit on 2026-11-07, followed by the implementation addendum below.
The initial assessment is preserved for context. Production database and production
API verification remain outside this local implementation.

## Result

The SQL baseline and JPA model already represent the core architecture review
workflow. No new business table is currently indicated for the proposed first
release. The API read surface needs completion before a reloadable FE workflow
can be delivered; the nine existing review mappings are not a complete UI contract.

## Persistence already present

All tables below are in schema `learning_hub` in the backend's
`docs/sql/learning_hub_community.sql`.

| Table                                            | Existing responsibility                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `community_review_proposals`                     | Status, due date, concluded revision, conclusion, actor and timestamp                  |
| `community_review_invitations`                   | Reviewer, inviter, response status, response time and expiry                           |
| `community_review_threads`                       | Specific revision/file and JSON anchor, open/resolved state, resolution note and actor |
| `community_contents`                             | Identity, author/maintainer, organization, lifecycle and visibility                    |
| `community_content_revisions`                    | Versioned title, Markdown and structured `context.review`                              |
| `community_assets` + `community_revision_assets` | Uploaded design files attached to an exact revision                                    |
| `community_comments`                             | Root feedback and replies tied to a review thread/revision                             |
| `community_content_links`                        | Immutable follow-up relationship to an earlier review                                  |

The three dedicated review tables have `row_version` and audit metadata. Thread
creation has `client_request_id` and `request_hash`. Logical relationships are
validated by services in accordance with this repository's no-physical-FK policy;
this audit does not propose adding foreign keys or uniqueness constraints.

Evidence: SQL table definitions at lines 700, 727 and 754; matching entities
`ReviewProposal`, `ReviewInvitation`, `ReviewThread`; repository
`CommunityReviewRepository`; service `CommunityReviewService`.

The demo SQL also has a review proposal, invitations and a thread. Seed source is
not evidence that those records exist in production. Configuration uses
`ddl-auto: validate` and Flyway disabled, so deployment does not automatically
apply missing tables from these SQL files.

## API behavior verified by reading source

`CommunityReviewController` registers nine mappings (C78–C86):

- List and create reviews.
- Create invitations and accept/decline/complete/cancel an invitation.
- Create a revision-anchored feedback thread and resolve/reopen it.
- Conclude, close and create a follow-up review.

Shared content endpoints cover draft/edit/publish, revision reads, files, comments
and lifecycle. Opening a review is a separate `open_review` lifecycle action after
publishing; publishing alone does not open it.

The service checks reader access before inviting, and invitation does not grant
access. Feedback is pinned to a published/superseded revision and optionally its
file. Concluding requires the current published revision and zero open threads on
that revision. An existing `CommunityApiIT` method,
`architectureReviewPinsThreadsAndConcludesOnlyAfterResolution`, covers part of this
flow, but was not executed as part of this source-only audit.

## Gaps to resolve before FE implementation

| Gap                                                                   | Why it matters                                                                             | Suggested contract addition, not implemented                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| No GET for a complete `ReviewView`                                    | Generic `ContentDetail` lacks review status, conclusion and review-specific actions        | Review detail read, including capabilities and version identifiers              |
| No GET listing invitations or my pending invitations                  | Mutation responses cannot reconstruct participant state after reload                       | Authorized invitation list and caller-scoped inbox/filter                       |
| No GET listing `ThreadView` records                                   | Comments expose thread IDs but not anchors, status, resolution metadata or thread versions | Paginated threads filtered by revision/status with capabilities                 |
| Review-level actions not in generic content capabilities              | FE must not infer invite/open/conclude permission from roles                               | Explicit server-provided review action capabilities                             |
| `in_review` documented in DB but absent from current service workflow | List rejects that filter; mutations operate on `open`                                      | Use draft/open/concluded/closed for phase one, or align service semantics first |

These can primarily use existing tables. Query/DTO/controller/service changes are
still needed, followed by ACL, version conflict and reload verification. Do not
reconstruct review state by replaying mutation responses or fetching all comments.

## Proposed delivery scope and design

Phase one: keep Questions, Articles/Incident lessons and My content; add review
list, draft creation, publish/open, reviewer invitations, revision-based feedback,
resolution and conclusion. The current helpful-button design stays on eligible
questions/answers/articles; it is not used as an architecture approval mechanism.

The supplied unified prototype includes 17 screens: questions/list/detail/create;
articles/list/detail/create; reviews/list/detail/create; My content; Wiki/Radar;
Guilds; recordings/transcript; collections; contributions; analytics; moderation.
The broader specialist and management pages are a visual direction, not a claim
that their endpoints are integrated. Notifications/digest are deliberately excluded
from the delivery recommendation per the user's stated preference.

Before committing phase-one scope, verify the three review tables and shared
tables on the authorized deployment, complete the missing reads/capabilities,
then exercise two users across create/publish/open/invite/accept/comment/resolve/
conclude/reload and unauthorized/cross-org cases. No production DB connection,
schema migration, data seed or runtime BE test was performed for this assessment.

## Implementation addendum — 2026-11-07

### Delivered scope

Community navigation now exposes Questions, Articles, Architecture reviews and My
content from the server-granted `COMMUNITY` function. Specialist spaces (Wiki,
Radar, Guild, recordings, collections and contributions) are excluded from this
phase. Existing Questions/Articles/helpful interactions remain available.

Architecture reviews include a searchable, paginated status list; structured draft
creation and editing; optional design attachment; publication and opening for
feedback; reviewer invitations and accept/decline/complete/cancel responses;
revision-specific feedback, replies, resolution and reopening; published revision
history; conclusion/closure; and creating a follow-up draft. My content links reviews
to their own detail/editor routes. Historical generic content links redirect to the
review screen.

Permissions and eligible actions come from backend capabilities, never role checks
in the FE. Review, invitation and thread mutations use server versions. Feedback
creation carries an idempotency key and its source revision. A conclusion pins the
current published revision and requires its outstanding threads to be resolved.
Incomplete structured metadata is accepted for drafts and checked at publication.

### Backend and persistence

The existing proposal/invitation/thread tables are reused; no SQL migration was
introduced. Three authenticated, authorized reads were added:

- `GET /api/v1/community/reviews/{contentId}`
- `GET /api/v1/community/reviews/{contentId}/threads?revisionId=&status=&page=&size=`
- `GET /api/v1/community/reviews/{contentId}/invitations?page=&size=`

The detail response includes `reviewCapabilities`; thread and invitation reads
include their own capabilities and row versions. Reads respect draft privacy and
content/revision scope. Thread summaries batch root comments and display names.
Existing review writes, generic draft/publication/revision APIs and the established
media upload pipeline are integrated through typed, parsed endpoint contracts.
See the backend's `docs/api/COMMUNITY.md` for the updated API inventory.

Deploy the backend before the frontend: the frontend requires the new read routes
and review capabilities. The deployed DB must already contain the Community SQL
baseline; the absence of a new migration does not verify a production DB schema.

### Verification record

- Community and navigation: 18 spec files, 92 tests passed after the final UI fixes.
- Backend: 7 selected `CommunityApiIT` integration tests passed, zero skipped,
  against a disposable PostgreSQL 16 cluster. Coverage includes the complete review
  lifecycle, draft privacy, unauthorized reads, revision ownership, comments,
  thumbnail compatibility, stale draft handling and the OpenAPI response schema
  inventory (141 active Community routes).
- Review list/detail/editor were rendered against the real local backend at 1280, 768
  and 375px in light and dark themes: no horizontal overflow, no Community HTTP
  failures and no browser page errors. Visual inspection found and fixed missing
  page-header action projection and an initially blank revision select.
- Workspace lint/typecheck/production build/staging build/bundle guards passed.
  After the initial monolithic runner stopped, bounded runs completed all 182 LMS
  spec files. Libraries also passed: contracts 26 files/295 tests, mocks 21
  files/340 tests and UI 55 files/550 tests.
- Two authenticated browser sessions completed create/publish/open/invite/accept/
  feedback/resolve/conclude and verified persisted read-only state after reload.
  A follow-up copied the structured design, published a second revision with
  history intact, and closed successfully. No Community HTTP or browser page
  errors occurred in these flows.
- Keyboard checks passed for status filters, review tabs, create navigation,
  editor tab order and Escape cancellation. Offline filtering rendered the error
  state; returning online and using Retry restored the list.
- `npm run check` initially stopped at Prettier: the Windows checkout exposed
  1,230 warnings, mostly CRLF versus the default LF. A read-only cross-platform
  check (`prettier --check . --end-of-line auto`) isolated four existing format
  issues. Those four files received formatting only: organization HTML/SCSS,
  points-figure HTML and the workspace conventions document. The cross-platform
  whole-repository check now passes; default `npm run check` is not claimed green
  on this CRLF checkout. No formatting rule or CI gate was disabled.
- A monolithic LMS Vitest run stopped after 104 passing spec files because a worker
  exited unexpectedly. This is not recorded as a passing full test suite.
- Full backend `mvn clean verify`: 541 tests, zero assertion failures, 49 environment
  errors and 298 skipped tests. Docker/Testcontainers is unavailable here; the
  selected Review regression tests above were run separately and passed.

The disposable DB used temporary baseline copies replacing pgvector columns with
arrays and omitting vector indexes, with Hibernate validation disabled for that
local invocation only. Review table DDL was unchanged. These checks do not validate
vector retrieval, AI, production migrations or S3 upload/download connectivity.
No production credentials, accounts, grants, schema or data were changed.

### Design and rollout notes

The supplied phase-one reference is implemented using existing semantic theme
and spacing/type tokens. The list uses the shared accessible segmented control
rather than custom underline tabs and adds an explicit closed-state filter. The
side guide remains plain text. Review actions use centered, keyboard-accessible
confirmation/form dialogs; they do not introduce another right-side drawer.
Questions, Articles, Review and My content are distinct navigation destinations.
No professional-space modules or notification center were added. Invalid review
IDs render an explicit recovery action rather than an empty detail screen.

The migration inventory now lists the four Review routes. Its missing entry for
the already-existing chat-room route was also recorded to satisfy the registry
guard; no chat-room behavior changed. Inventory entries are not marked delivered
by a fictitious pull request. Test expectations were updated for the four Community
links, while function grants remain unique in the session profile.

The architecture review feature uses feedback threads and explicit conclusions,
not helpful-vote totals as an approval rule. Only the current revision's unresolved
threads block a conclusion; historic threads stay attached to their source version.
People are invited by staff code (leading zeros preserved), up to the existing
server limit, and must already have read access. Notifications and an invitation
inbox are not part of this release.

Remaining environment verification: exercise design attachment upload/download
against configured S3 storage and run the complete Docker-enabled backend suite.
These limitations do not change the successful local API and two-user FE workflow
results. Production deployment has not been performed.
