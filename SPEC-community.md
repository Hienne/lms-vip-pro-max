# Community ("Cộng đồng"): feature evaluation and proposed scope

Status: **scope decided 2026-10-28** (see [Decisions](#decisions)); Đợt 1 is CM-01 to CM-06 and CM-08.
Mockups are in `docs/mockups/community/` (CM-08 being aligned with the real moderation API). No capability
map or module spec is approved yet.

## Decisions

Taken by the user on 2026-10-28:

1. **Navigation:** the backend adds two function codes, so the sidebar stays server-driven:
   `COMMUNITY` "Cộng đồng" `/community` (every role) and `COMMUNITY_MODERATION` "Điều phối cộng
   đồng" `/community/moderation` (ADMIN, SUPER_ADMIN). The SQL is
   `corebanking-academy/docs/sql/learning_hub_community_functions.sql` (rerun-safe). **Applied to the
   shared DB on 2026-10-28**: functions 21 `COMMUNITY` and 20 `COMMUNITY_MODERATION`, 7 role mappings; a
   rerun inserted 0 rows. The SQL file is not committed in the backend repo and not yet folded into
   `learning_hub_identity.sql` for new databases.
2. **Shared server, checked read-only on 2026-10-28:** the community DDL (51 tables), the catalogue
   (12 tags, 3 badges) and the FE demo (15 contents, 3 Guilds) are in `appdb`. Both workers are off: the
   deployed config sets no `app.community.*`, the 15 outbox events are still `pending`, and there are 0
   notifications and 0 assets. No community moderator exists yet.
3. **CM-07 notifications is out of Đợt 1**, and so are attachments (#6): without the media worker no
   upload reaches `ready`. Both move to Đợt 2, to start once the backend turns the workers on.
4. **Audience is the whole Ban**, technical or not. Guilds stay in Đợt 2.
5. **Moderators get the menu entry through `/me`** (decided after the mockups). Backend change, not yet
   committed or deployed: Identity exposes a port `identity.service.FunctionGrantSource`, which
   `AuthorizationService.rights` merges after the role mapping; Community implements it in
   `community.service.CommunityModeratorFunctions`, granting `COMMUNITY_MODERATION` with an ORG scope to
   an active row of `community_moderators` in the user's current org. An ADMIN who is not also a
   moderator sees the entry but the report queue (C38) refuses them: CM-08 shows them only the
   "Người điều phối" tab.
6. **Lessons learned keep the free "Nội dung" body** (min 20 characters at publish) below the four
   structured fields: the backend intends it.
7. **Two read endpoints added for CM-08** (backend, not yet committed or deployed; documented in
   `COMMUNITY.md` and `community-openapi.json`, now 137 active operations):
   - **C139 `GET /moderation/reports/{reportId}`** → `ReportView`, for a moderator of the same org. For
     anyone but the moderator assigned to the case (`capabilities.canReadEvidence`), `description` and
     `reporter` are null and `actions` is empty.
   - **C140 `GET /moderation/moderators?orgId=&status=active|revoked&page=&size=`** →
     `PageResponse<ModeratorView>` (newest grant first), for an ADMIN in scope, SUPER_ADMIN, or an active
     moderator of that org (to pick a colleague when reassigning a case). Each row's `version` feeds C42.
8. **Fields the mockups need were added to the backend** (2026-10-29, local, uncommitted; 138 active
   operations). The app integrates against a locally run backend until these are deployed.
   - `ContentDetail`: `saved`, `subscriptionMode`, `isDuplicate`, `duplicateTarget`, `closure {action,
reason, actor, occurredAt}` (`action` is `close`, `duplicate` or `moderated`; a moderator acting on a
     report case is `moderated` with no reason or actor; reopening drops the duplicate mark); `capabilities` gains `canClose`, `canReopen`, `canArchive`, `canDelete`,
     `canMarkDuplicate` (detail only; list cards return them false).
   - `ContentCard`: `hasDraft`, `occurredOn`. `RevisionDetail`: `changeNote`, `editor`, `updateTime`;
     `SaveDraft` takes `changeNote` (≤ 500).
   - `ReportCard`/`ReportView`: `target {kind, contentId, title}` (title only when the caller can read it).
   - **C141 `GET /moderation/candidates?orgId=&q=&page=&size=`** → `PageResponse<PersonRef>`: active staff
     of the org, same callers as C140; feeds the appoint and assign-maintainer pickers.
   - Not changed: a resolved case still shows metadata and action history only, and restore stays in
     Đợt 2. CM-08's restore state and the evidence on a resolved case are dropped from Đợt 1.
   - Answers keep the server's fixed order, so CM-03 has no answer sort select.
   - `ContentDetail.questionId` (answers only): the editor names an answer's question and an
     answer's own address opens its question. C05 cards carry no answer body, so CM-03 reads each
     answer's detail (C10); a question shows at most 50 answers.

## Moderation API as served (checked 2026-10-28 on the shared server's OpenAPI)

- `ReportCard` (C38 list): `reportId`, `reasonCode`, `status`, `reportedAt`, `assignedModerator`
  (`userId`, `displayName`), `version`, `createTime`, `updateTime`. No target title or type, no
  reporter, no `capabilities`. Filters: `status`, `assignedToMe`, `page`, `size`.
- `ReportView` adds `targetType`, `targetId`, `description`, `reporter`, `actions` and `capabilities`
  (`canAssign`, `canReadEvidence`, `canAct`). It comes from C37 create, C39 assign, C41 action and,
  since Decision 7, C139.
- `EvidenceView` (C40, only for the assigned moderator): `targetType`, `targetId`, `targetVersion`,
  `content` (RevisionDetail) or `comment` (`bodyMarkdown`, `status`, `deletedAt`), `revisionId`,
  `actions` (`actionType`, `reason`, `actor`, `occurredAt`).
- `reasonCode` is free text (≤100) with no server list, so the app owns the list of report reasons.
- Moderators: C42 `PUT /moderation/moderators/{userId}` (`orgId`, `active`, `reason`,
  `expectedVersion`; 0 when none) and, since Decision 7, the C140 list.

Consequences for CM-08: queue rows show only the report code, reason, status, time and assignee. A
report opens through C139: metadata and target for every moderator, and "Nhận xử lý" (C39) when it is
unassigned; the assigned moderator also sees the reporter, their note, the history and the evidence
(C40). The "Người điều phối" tab lists active and revoked moderators (C140) with grant and revoke (C42),
and the "Giao cho người khác" picker uses the same list.

## Objective

The backend (`corebanking-academy`, package `community`, PR #11 "feat community") ships a full staff
community: 138 contract operations (C01–C138), 135 active, 51 tables. The mockup has no community
screens, and the app has none. This document lists what the backend offers, judges which parts staff
actually need, and proposes the screens for a first release.

Users: every active staff account of the org (asks, answers, writes), org moderators (handle reports),
ADMIN (appoints moderators).

## What was checked

- `corebanking-academy/docs/api/COMMUNITY.md` (contract, permission matrix, state machines, DTO rules),
  the commit's file list, `docs/sql/learning_hub_community_catalog.sql` and `..._demo.sql`.
- The shared backend `http://103.121.90.119:8019/v3/api-docs` (no sign-in): 110 of 173 paths are
  `/api/v1/community/**`, so the routes are deployed. Whether the community tables exist in that
  database, and whether the workers are on, could not be checked without signing in (see Open questions).
- Server-built links: notifications, collections, contributions, learning resources and the
  Assistant's `search_community` tool all link to **`/community/contents/{contentId}[?revisionId=]`**.
  The Assistant already ships in this app, so those links 404 today.

## Facts that shape the scope

1. **No function code.** Identity has no `COMMUNITY` function; the sidebar is built from `/me`
   functions (`core/menu/menu-catalog.ts`). Community is open to every active user and moderation is a
   community table (`community_moderators`), not an Identity role.
2. **Workers are off by default** (`app.community.jobs.enabled`, `media.worker-enabled`). Without the
   jobs worker there are no notifications, digests, points, badges or search index. Without the media
   worker no upload ever reaches `ready`, so **even an image attached to a question cannot be
   published**.
3. **Catalogue seeds 12 tags** (Spring Boot, Oracle, Angular, OpenShift…) and 3 badges; it seeds no
   moderator. A question cannot be published without 1–10 active tags.
4. **Every write is versioned** (`expectedContentVersion`, `expectedRevisionVersion`) and creates use
   `clientRequestId`; a conflict returns `COMMUNITY-CONFLICT` and the UI must reload, never retry over
   someone else's change.
5. **Overlaps with shipped features:** the Assistant (answers with sources), the knowledge-base
   documents, the learning leaderboard and achievements, the header search, and video lessons.
6. **AI (C126–C128) is disabled on the server** (404).

## Evaluation

Verdict: **Đợt 1** = needed for the first release; **Đợt 2** = useful once Đợt 1 is used;
**Không làm** = not now (reason given). Effort is UI effort in this app.

| #   | Feature group (backend APIs)                                                                | Value for staff                         | Effort | Verdict                                                     | Reason                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------- | ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Q&A: list, search-first ask, answer, accept, vote, comment (C01–C07, C12–C17, C20, C25–C28) | High: the core of a technical community | M      | **Đợt 1**                                                   | The reason Community exists; everything else hangs off it.                                                                                                        |
| 2   | Content detail at `/community/contents/:id` (C04, C10, C122)                                | Mandatory                               | S      | **Đợt 1**                                                   | Every server-built link, including the Assistant's citations, lands here.                                                                                         |
| 3   | Articles (blog) (C08–C09)                                                                   | Medium-high                             | S      | **Đợt 1**                                                   | Same editor and detail as Q&A; small extra cost.                                                                                                                  |
| 4   | Lessons learned / incident write-ups (C93–C94)                                              | High for a core-banking ops team        | S      | **Đợt 1**                                                   | An article with a structured form (symptoms, root cause, resolution, prevention). Shown as a type filter of Articles, not a separate section.                     |
| 5   | Draft editor: save, publish, tags, revision history (C11–C16, C19)                          | Mandatory for 1, 3, 4                   | M      | **Đợt 1**                                                   | One shared editor for every kind.                                                                                                                                 |
| 6   | Attachments upload (C43–C49, C138)                                                          | Medium                                  | M      | **Đợt 1 if the media worker is on**, else Đợt 2             | Without the worker nothing becomes `ready`; Markdown code blocks cover most technical posts.                                                                      |
| 7   | Access scope: restricted / per-user grants (C18)                                            | Low at first                            | M      | **Đợt 2**                                                   | Đợt 1 publishes at `organization` scope only. Grant management is a full dialog with expiry and conflict handling.                                                |
| 8   | Bookmarks and "my posts" incl. drafts (C11, C29–C30)                                        | Medium                                  | S      | **Đợt 1**                                                   | A user must be able to find their own drafts.                                                                                                                     |
| 9   | In-app notifications (C33–C34) and follow button (C32)                                      | High: closes the ask→answer loop        | S      | **Đợt 1 if the jobs worker is on**                          | Without fan-out the inbox stays empty. Uses the existing header bell rather than a new screen if possible.                                                        |
| 10  | Report and moderation queue (C37–C41)                                                       | Mandatory in a bank                     | M      | **Đợt 1**                                                   | User-generated content needs a takedown path (customer data, credentials in a post).                                                                              |
| 11  | Appoint moderators (C42, ADMIN)                                                             | Mandatory once                          | S      | **Đợt 1**                                                   | No moderator is seeded; without one the queue has no reader. One tab in moderation.                                                                               |
| 12  | Mark duplicate (C136), help request to a person (C35–C36)                                   | Medium                                  | S      | Duplicate **Đợt 1** (a menu action); help request **Đợt 2** | Help request needs the expert directory to pick a person.                                                                                                         |
| 13  | Expert directory and own expertise (C87–C89)                                                | Medium                                  | S      | **Đợt 2**                                                   | Valuable once there is content and people to ask.                                                                                                                 |
| 14  | Unified search over Community, Learning, Knowledge (C97)                                    | Medium-high                             | M      | **Đợt 2**                                                   | Fits the existing header search; Đợt 1 has the Q&A list filter (C01 `q`).                                                                                         |
| 15  | Guilds: list, join, members, feed, pins (C50–C61, C133)                                     | Depends on team structure               | L      | **Đợt 2**                                                   | Only worth it if the Ban runs as several squads; adds membership and private-ACL states.                                                                          |
| 16  | Course reference links (C123–C125)                                                          | Medium                                  | M      | **Đợt 2**                                                   | Touches the shipped course editor and lesson player; ship after posts exist to link.                                                                              |
| 17  | Moderator stats: unanswered questions, overview (C118–C121)                                 | Medium for moderators                   | S      | **Đợt 2**                                                   | One "Chưa có trả lời" list first; charts later.                                                                                                                   |
| 18  | Notification settings, subscriptions list (C31, C99–C100)                                   | Low-medium                              | S      | **Đợt 2**                                                   | Defaults (digest off) are fine at launch.                                                                                                                         |
| 19  | Tag management (C21–C24, OM)                                                                | Low at first                            | S      | **Đợt 2**                                                   | 12 tags are seeded by SQL.                                                                                                                                        |
| 20  | Wiki with approval workflow, maintenance reviews (C62–C69, C131–C132, C134)                 | Overlaps the knowledge base             | L      | **Không làm**                                               | Second document store beside the KB; approval queue, cycles, review schedules. Revisit if the KB cannot hold coding standards.                                    |
| 21  | Tech Radar (C70–C71)                                                                        | Low                                     | M      | **Không làm**                                               | Needs Guilds and Wiki approval; a niche artefact.                                                                                                                 |
| 22  | Architecture review with anchored threads (C78–C86)                                         | High for a few, rare                    | XL     | **Không làm**                                               | Anchors on PDF pages, regions and JDL lines plus a reviewer workflow: the most expensive UI here for a low-frequency use.                                         |
| 23  | Video sharing and transcripts (C72–C77)                                                     | Low                                     | L      | **Không làm**                                               | Learning already hosts video; needs the media worker and FFmpeg; manual transcript editor.                                                                        |
| 24  | Knowledge requests: claim, fulfil (C90–C92)                                                 | Low                                     | M      | **Không làm**                                               | Overlaps "ask a question"; adds a second request workflow.                                                                                                        |
| 25  | Shared collections with ACL (C102–C107)                                                     | Low                                     | M      | **Không làm**                                               | Bookmarks (C29) cover saving.                                                                                                                                     |
| 26  | Digest, onboarding (C101, C108–C110, C137)                                                  | Low                                     | M      | **Không làm**                                               | Needs the jobs worker; onboarding without Guilds is just tag follows.                                                                                             |
| 27  | Contribution points, badges, community leaderboard (C111–C117)                              | Low, risk of confusion                  | M      | **Không làm**                                               | Competes with the learning leaderboard and achievements already shipped; two point systems confuse staff. Revisit as one tab of the existing achievements screen. |
| 28  | Reindex, jobs (C129–C130)                                                                   | Ops only                                | S      | **Không làm**                                               | Operators use the API; no staff screen.                                                                                                                           |
| 29  | AI answers with citations (C126–C128)                                                       | n/a                                     | n/a    | **Không làm**                                               | Disabled on the server; the Assistant already searches Community.                                                                                                 |

## Proposed Đợt 1 screens

Routes under `/community`. Sidebar entries come from the functions `COMMUNITY` ("Cộng đồng", entry
CM-01) and `COMMUNITY_MODERATION` ("Điều phối cộng đồng", entry CM-08); see Decision 1.

| Id    | Screen (UI title)                                                                                     | Route                                                     | APIs                                                                       | Who                                  |
| ----- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| CM-01 | Hỏi đáp                                                                                               | `/community/questions`                                    | C01, C21                                                                   | everyone                             |
| CM-02 | Đặt câu hỏi (suggests existing questions while typing the title)                                      | `/community/questions/new`                                | C02, C03, C13, C14, C21                                                    | everyone                             |
| CM-03 | Chi tiết câu hỏi / bài viết (answers, accept, vote, comments, save, follow, report, close, duplicate) | `/community/contents/:id`                                 | C04, C05, C06, C07, C10, C14, C17, C20, C25–C28, C30, C32, C37, C122, C136 | everyone (actions by `capabilities`) |
| CM-04 | Bài viết (filter: bài viết / bài học sự cố)                                                           | `/community/articles`                                     | C08, C93                                                                   | everyone                             |
| CM-05 | Soạn bài / sửa bản nháp (article, lesson-learned form, answer edit; history drawer; no attachments)   | `/community/articles/new`, `/community/contents/:id/edit` | C09, C94, C12–C16, C19                                                     | author, maintainer                   |
| CM-06 | Của tôi (tabs: Bài của tôi with drafts, Đã lưu)                                                       | `/community/me`                                           | C11, C29, C30                                                              | everyone                             |
| CM-08 | Điều phối cộng đồng (tabs: Báo cáo, Người điều phối)                                                  | `/community/moderation`                                   | C38–C42                                                                    | moderators; ADMIN for the second tab |
| —     | Dialogs: Báo cáo vi phạm, Đánh dấu trùng lặp, Đóng câu hỏi, Xác nhận xung đột phiên bản               | in CM-03 / CM-05                                          | C37, C136, C17                                                             | —                                    |

The follow button (C32) stays on CM-03: it records the subscription now, and notifications arrive once
the jobs worker runs.

Đợt 2 would add, once the workers are on: CM-07 notifications and attachments. Then unified search in
the header, expert directory and help requests, Guilds, course reference links, notification settings,
tag management, the unanswered-questions list.

## Boundaries

- Always: render `capabilities` from the server and never compute permissions, scores or answer
  counts in the app; parse every response with zod; send the versions the server returned; show
  `COMMUNITY-CONFLICT` as "someone changed this, reload" and never auto-retry; follow
  `docs/conventions/visual-design.md` (the mockup has no reference for these screens).
- Ask first: adding a Markdown renderer or editor dependency; any change to the shipped course
  editor, lesson player, header or achievements screens.
- Never: build the features marked "Không làm" without a new decision; bypass ACL by IDs;
  render raw HTML from Markdown.

## Open questions

1. **Backend changes are local only:** the `/me` port, the entity fix, C139 and C140 sit uncommitted on
   `corebanking-academy` `main` and are not deployed; the shared server still answers 404 for C139/C140.
2. **Function SQL in the backend repo:** commit `learning_hub_community_functions.sql` (or fold it into
   `learning_hub_identity.sql`) so new databases get the codes. The app ignores codes it does not know
   (`knownFunctions`) until Đợt 1 adds them to `FunctionCodeSchema`. The Assistant reads `/me` functions
   too and may now offer "Cộng đồng" as a screen before the route exists.
3. **Backend `main` does not start (found 2026-10-28, fixed locally, not committed):** the assessment
   module's `Question` entity clashed with community's; community's is now
   `@Entity(name = "CommunityQuestion")`, like `CommunityAssetUploadPart`. `CommunityApiIT` also lacked
   `learning_hub_assessment.sql` in its schema fixture (added). The shared server runs a build from before
   the assessment merge, so a deploy of today's `main` without these fixes would fail at startup.
4. **Lessons learned:** confirm it belongs under Articles as a type rather than its own sidebar entry.
5. **Leaderboard:** confirm community points stay out until they can join the existing achievements
   screen.
