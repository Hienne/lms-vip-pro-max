# 10: PR links on done checklist entries

**What to build:** every `done` entry of the migration checklist links to the real pull request that delivered it, so the progress board shows where each piece came from. Pieces delivered in a combined pull request (the foundation and design-system work, the base-libraries integration) link to that combined pull request. The registry spec rejects a `done` entry without a pull request link, so the gap cannot come back. Closes the "missing pull request links" gap from the foundation review (`docs/specs/base-libraries.md`, Out of Scope).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every `done` entry has a `pullRequest` URL of a merged pull request in this repository, found from git history (`gh pr list --state merged`)
- [ ] Registry spec fails when a `done` entry has no `pullRequest`; the failure names the entry id
- [ ] The board shows the link for each `done` entry in dev builds
- [ ] `docs/migration/mockup-to-angular.md` progress-checklist steps say to fill `pullRequest` when marking an entry `done`
- [ ] `npm run check` green; own pull request
