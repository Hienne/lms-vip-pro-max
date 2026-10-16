# Converting the mockup to Angular

`lms-mockup/` is the specification: behaviour, copy, states and look. Read it,
never import it. Its README maps every competition checklist item to a route;
a converted screen must still satisfy the items mapped to its route.

Run it for side-by-side comparison:

```bash
python3 -m http.server 8080 -d lms-mockup
```

## Layer mapping

| Mockup                                                  | Angular target                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `assets/css/tokens.css`                                 | token maps in `libs/ui/src/styles/ui/_tokens.scss` (`ui-library.md` → Styling)                                 |
| `assets/css/components.css` blocks                      | one `_<block>.scss` partial per atom in `libs/ui`                                                              |
| `assets/css/base.css`, `layout.css`, `pages.css`        | layout helpers or `ui` mixins (`ui-library.md` table); layout → `app/layout/`; page rules → route `.scss`      |
| `core/types.js`                                         | zod schemas in `@lms/contracts`                                                                                |
| `data/seed.js`                                          | fixtures in `@lms/mocks`                                                                                       |
| `api/*.js` function                                     | endpoint in `@lms/contracts` with the same key, called with `EndpointClient`; its body is the **backend** spec |
| `api/core.js` (`PERMS`, `unitScope`, scoring, progress) | backend only; the app uses roles for navigation and display, nothing more                                      |
| `core/router.js` `routes[]`                             | a screen of the screen table (`core/routing/screens.ts`), under the menu that grants it                        |
| `core/router.js` `layout: 'focus'` / `public`           | the screen's `layout` (`focus`, `bare`) and `public` fields in the screen table                                |
| `core/store.js` session, prefs                          | `core/session/` store-like root service (session, theme), per angular.md §5.2 shape                            |
| `core/shell.js`                                         | `app/layout/app-shell` (template) + role-based nav config                                                      |
| `core/ui.js` toast/modal/drawer/menu                    | `@lms/ui` organisms on CDK / `@angular/aria` (`ui-library.md` table)                                           |
| Demo menu                                               | dev toolbar + in-app mock API (`contracts-and-mocks.md` → In-app mock API)                                     |
| `UI.X(props)`                                           | atom/molecule/organism per the inventory below                                                                 |
| `html\`…\`` auto-escaping                               | Angular interpolation; `UI.Markdown` becomes a component that builds nodes, never `innerHTML`                  |

### Page contract → route module

`LMS.page(key, { title, layout, initState, load, view, mount, actions })`:

| Page part                                      | Goes to                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `key`                                          | route-module folder name, kebab-case (`quizTake` → `quiz-take/`)                                                                    |
| `title`                                        | route `title`                                                                                                                       |
| `initState()`                                  | store `state` object                                                                                                                |
| `load(ctx)`                                    | store `serverData`(s) calling `client.call(endpoint, …)`                                                                            |
| filtering / sorting / grouping inside `view()` | store `computed()` selectors                                                                                                        |
| markup in `view()`                             | component template built from `@lms/ui` + `shared/`                                                                                 |
| `actions[name]`                                | store command (template handler is a one-liner)                                                                                     |
| `data-input` (debounced typing)                | store state + debounced params (check for a built-in signal debounce first; otherwise `toObservable` + `debounceTime` + `toSignal`) |
| `mount` / `unmount` (timers, listeners)        | store `effect` with `onCleanup`, or `afterRenderEffect` for DOM work                                                                |
| `skeleton`                                     | loading state rendered from `isLoading$()`                                                                                          |

## Feature mapping

| Mockup file          | Page keys                                                   | Feature folder                                       |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `auth.js`            | `login`                                                     | `features/auth`                                      |
| `auth.js`            | `profile`, `notifications`                                  | `features/account`                                   |
| `auth.js`            | `home`                                                      | redirect by role in `app.routes.ts`                  |
| `auth.js`            | `forbidden`, `notFound`                                     | `features/errors` (`notFound` is the wildcard route) |
| `learner.js`         | `dashboard`, `catalog`, `course`                            | `features/learning`                                  |
| `lesson.js`          | `lesson`                                                    | `features/lesson`                                    |
| `quiz.js`            | `quizIntro`, `quizTake`, `quizResult`, `quizAttempts`       | `features/quiz`                                      |
| `tools.js`           | `progress`, `leaderboard`, `certificates`, `certificate`    | `features/achievements`                              |
| `tools.js`           | `saved`, `flashcards`, `assistant`                          | `features/study-tools`                               |
| `instructor.js`      | `instructor`, `inbox`                                       | `features/instructor`                                |
| `admin-content.js`   | `adminHome`, `adminCatalog`, `adminCourses`, `courseWizard` | `features/admin-content`                             |
| `admin-questions.js` | `questions`, `quizzes`, `quizConfig`, `import`              | `features/admin-assessment`                          |
| `admin-org.js`       | `users`, `userDetail`, `org`, `assignments`, `system`       | `features/admin-org`                                 |
| `reports.js`         | `reports`, `reportDetail`                                   | `features/reports`                                   |
| `design-system.js`   | `designSystem`                                              | `features/design-system`                             |

Route paths and role lists come from `lms-mockup/src/core/router.js`; keep the
paths (without `#`) so the README's route table stays valid.

## Component inventory

| Mockup                                                                    | Level     | Target                                                                                                                   |
| ------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `UI.Button`, `.btn`                                                       | atom      | `button[uiButton], a[uiButton]`                                                                                          |
| `.icon-btn`                                                               | atom      | `button[uiIconButton]` (required `label`)                                                                                |
| `.link-btn`                                                               | atom      | `button[uiLinkButton], a[uiLinkButton]`                                                                                  |
| `.input`, `.select`, `.textarea`, `UI.FilterSelect`                       | atom      | `input[uiInput]`, `select[uiSelect]`, `textarea[uiTextarea]`                                                             |
| `.check`, `.switch`                                                       | atom      | `input[type=checkbox][uiCheckbox]`, `input[type=checkbox][uiSwitch]`                                                     |
| `UI.Badge`, `.badge`, `.chip`                                             | atom      | `[uiBadge]` (`tone`), `[uiChip]`                                                                                         |
| `UI.Card`, `.card`                                                        | atom      | `[uiCard]` + `[uiCardHeader]`, `[uiCardBody]`                                                                            |
| `.list`, `.list__item`, `.list__icon`                                     | atom      | `ul[uiList]` + `[uiListItem]`, `[uiListIcon]`                                                                            |
| `UI.Skeleton`, `.skeleton`, `.spinner`                                    | atom      | `[uiSkeleton]`, `[uiSpinner]`                                                                                            |
| `.table`                                                                  | atom      | `table[uiTable]`                                                                                                         |
| `icon()`                                                                  | atom      | `ui-icon`                                                                                                                |
| `UI.Avatar`                                                               | atom      | `ui-avatar`                                                                                                              |
| `UI.Progress`, `UI.Ring`                                                  | atom      | `ui-progress`, `ui-ring`                                                                                                 |
| `mai()`, `UI.MaiBadge`                                                    | atom      | `ui-mai` (brand flower SVG), `ui-mai-badge`                                                                              |
| `UI.Field`, `.field`, `.error-summary`                                    | molecule  | `ui-field` (label, control slot, hint, the bound field's validator messages with `aria-describedby`), `ui-error-summary` |
| `UI.Search`, `.input-icon`                                                | molecule  | `ui-search`                                                                                                              |
| `UI.Tabs`, `UI.Segmented`                                                 | molecule  | `ui-tabs`, `ui-segmented` on `@angular/aria`                                                                             |
| `UI.Breadcrumb`                                                           | molecule  | `ui-breadcrumb`                                                                                                          |
| `UI.Stars`, `.rating`                                                     | molecule  | `ui-stars` (display), `ui-rating` (input)                                                                                |
| `UI.Kpi`                                                                  | molecule  | `ui-kpi`                                                                                                                 |
| `UI.Empty`, `UI.ErrorState`                                               | molecule  | `ui-empty`, `ui-error-state` (`retry` output)                                                                            |
| `.alert`, `.tip`                                                          | molecule  | `ui-alert` (`tone`), `ui-tip`                                                                                            |
| `.pagination`                                                             | molecule  | `ui-pagination`                                                                                                          |
| `.dropzone`, `.upload-item`                                               | molecule  | `[uiDropzone]` behaviour + `ui-upload-item`                                                                              |
| `.timer`                                                                  | molecule  | `ui-timer` (remaining seconds in; the clock lives in the quiz store)                                                     |
| `.sort-item`, `.drag-handle`                                              | molecule  | `uiSortableList` + `ui-sortable-item` (CDK drag-drop; `moved` `{ from, to }`)                                            |
| `.option-card`, `.answer`                                                 | molecule  | `ui-option-card` (selectable card; correct/wrong `tone`)                                                                 |
| `UI.PageHeader`                                                           | organism  | `ui-page-header` (eyebrow, title, desc, actions slot, breadcrumb)                                                        |
| `UI.DataTable`, `.bulk-bar`                                               | organism  | `ui-data-table` (sort, page, select emitted as outputs; state stays in the route store)                                  |
| `.modal`, `.drawer`, `.toasts`, `.menu`                                   | organism  | see `ui-library.md` → Composite widgets and overlays                                                                     |
| `.stepper`, `.tree`                                                       | organism  | `ui-stepper`, `ui-tree`                                                                                                  |
| `charts.js` (`Radar`, bars, `.chart-legend`)                              | organism  | `ui-radar-chart`, `ui-bar-chart`, `ui-chart-legend` (SVG, token colours)                                                 |
| `UI.PublishStatus`, `UI.CourseStatus`, `UI.AccountStatus`, `UI.RoleBadge` | domain UI | `app-publish-status`, `app-course-status`, `app-account-status`, `app-role-badge`                                        |
| `UI.CourseCard`, `UI.Journey`, `UI.Due`, `UI.Required`                    | domain UI | `app-course-card`, `app-journey`, `app-due-date`, `app-required-mark`                                                    |
| `UI.Markdown`                                                             | domain UI | `app-markdown` (node-built, no `innerHTML`)                                                                              |
| `viewers.js` (`PdfViewer`, `VideoPlayer`), `.pdf`, `.player`              | feature   | `features/lesson` child components, `@defer`                                                                             |
| `ai.js`, `.ai-msg`, `.cite`, `.typing`                                    | feature   | `features/study-tools` (assistant) and lesson tab                                                                        |
| `.q-grid`, `.q-cell`, `.q-legend`                                         | domain UI | `app-question-grid`, `app-question-legend` (`shared/quiz/`; stateless, `goto` output)                                    |
| `.certificate`, `.flashcard`, `.comment`, `.thread`                       | feature   | owning feature's `components/`                                                                                           |

When a mockup page has markup that matches no row, decide its level with the
`ui-library.md` table and add a row here.

## Icon names

Mockup `icon(name)` → Lucide name for `ui-icon`. Lucide renames icons between
releases: check each against the installed `@lucide/angular` exports, and for
rows marked `*` compare with the mockup's SVG path in `src/core/icons.js`. Checked against
`@lucide/angular` 1.55: every name below exists as an exported icon; the registry
(`libs/ui/src/lib/atoms/icon/icon-registry.ts`) holds all 89 mockup icons. Corrections to the first
draft of this table: `edit` is `pen-line` (the mockup draws a pen with an underline), `tree` is
`network` (a hierarchy of boxes), `send2` is `arrow-right` (the mockup's glyph is a plain arrow).
`pdf` is `file-text`, the nearest Lucide document icon: the mockup draws a "PD" file glyph that
Lucide has no equivalent for. The mockup's strokes are an older Lucide revision, so a few paths
differ by a pixel or two; stroke width is 1.75 as in the mockup.

| Mockup        | Lucide         | Mockup      | Lucide            | Mockup       | Lucide          |
| ------------- | -------------- | ----------- | ----------------- | ------------ | --------------- |
| home          | house          | book        | book-open         | library      | library         |
| cap           | graduation-cap | clipboard   | clipboard-check   | chart        | chart-column \* |
| trophy        | trophy         | bell        | bell              | search       | search          |
| user          | user           | users       | users             | settings     | settings        |
| logout        | log-out        | chevron-\*  | chevron-\*        | arrow-\*     | arrow-\*        |
| arrow-up-down | arrow-up-down  | plus        | plus              | minus        | minus           |
| edit          | pen-line \*    | copy        | copy              | trash        | trash-2         |
| eye           | eye            | eye-off     | eye-off           | upload       | upload          |
| download      | download       | file        | file              | pdf          | file-text \*    |
| video         | video          | play        | play              | pause        | pause           |
| volume        | volume-2       | mute        | volume-x          | maximize     | maximize        |
| zoom-in       | zoom-in        | zoom-out    | zoom-out          | check        | check           |
| x             | x              | alert       | triangle-alert    | info         | info            |
| check-circle  | circle-check   | x-circle    | circle-x          | lock         | lock            |
| unlock        | lock-open      | clock       | clock             | calendar     | calendar        |
| star          | star           | message     | message-square \* | help         | circle-help     |
| flag          | flag           | bookmark    | bookmark          | note         | notebook-pen \* |
| sparkles      | sparkles       | layers      | layers            | tree         | network \*      |
| building      | building-2     | list        | list              | grip         | grip-vertical   |
| filter        | funnel         | sun         | sun               | moon         | moon            |
| menu          | menu           | refresh     | refresh-cw        | wifi-off     | wifi-off        |
| shield        | shield         | award       | award             | flame        | flame           |
| link          | link           | paperclip   | paperclip         | image        | image           |
| send          | send           | more        | ellipsis \*       | database     | database        |
| history       | history        | archive     | archive           | pause-circle | circle-pause    |
| globe         | globe          | target      | target            | inbox        | inbox           |
| send2         | arrow-right \* | spreadsheet | file-spreadsheet  | process      | workflow \*     |
| key           | key            | palette     | palette           | rotate       | rotate-ccw \*   |
| printer       | printer        |             |                   |              |                 |

## Progress checklist

The single record of migration progress is the typed registry
`apps/lms/src/app/features/design-system/data-access/migration-entries.data.ts`
(schema: `migration-entry.schema.ts`). There is no Markdown copy. It has one entry per row of
the component inventory above and one per route of the mockup router. Each entry has a
`status` (`todo` · `in-progress` · `done`), an `owner` (GitHub username), a `pullRequest`
link, the README checklist codes it serves, and four verify checks (`lightDark`, `widths`
375/768/1280, `keyboard`, `errorStates`).

- **Claim** an entry before you start: set `status: 'in-progress'` and `owner: '<your GitHub
username>'` in a one-line change, merged on its own so teammates see it. Do not start an entry
  somebody else owns.
- **Complete** it in the same pull request as the work: `status: 'done'`, the `pullRequest` link
  (open the pull request first, or fill the link right after it exists),
  and each verify check `'done'` only after you performed it, or `'n/a'` when it does not
  apply (a UI atom has no error states).
- The schema rejects an owner-less `in-progress`/`done` entry, a `done` entry without a
  `pullRequest` link (the merged pull request that delivered it; for work delivered in a
  combined pull request, that pull request) and a `done` entry with a pending check. Specs fail when an `@lms/ui` export or an app route has no entry, and when a
  `done` entry targets an export or route that does not exist. `todo` and `in-progress` entries
  may name planned exports and routes.
- **See it**: the progress board is at `/dev/migration` in development and staging (not in
  production). Demos on `/design-system` show "Chưa migrate" until every entry they `need` is
  `done`, so finishing an atom is: build it, flip its entry, write its demo inside the
  `app-ds-demo` that waits for it.
- A piece that matches no inventory row: add a row to the table above **and** an entry.

## Order of work

1. **Foundation**: theme (tokens), atoms,
   `/design-system` route, app shell + layouts, session, route guards, error
   handling, errors feature (403, 404), login.
2. **Learner path**: learning → lesson → quiz → achievements → study-tools → account.
3. **Instructor**, then **admin** (content, assessment, org), then **reports**.

Build a molecule or organism when the first screen that needs it is converted,
not ahead of time.

## Converting one screen

Each step ends on its criterion; finish it before starting the next.

1. **Read the spec.** Open the page in `src/pages/<file>.js`, every `api.*`
   function it calls, and the CSS selectors its markup uses. Done when you can
   list every state (`load` result, loading, empty, each error the api function
   can throw) and every `data-action` / `data-input` / `data-submit` on the page.
2. **Contract.** For every api function in that list: endpoint, schemas,
   fixtures (success, plus the mockup's specific errors) (`contracts-and-mocks.md`).
   Done when its done criteria pass.
3. **UI pieces.** Every inventory row the page uses exists in `@lms/ui` or
   `shared/`; build missing ones to `ui-library.md` done criteria.
4. **Route module.** Store, component, template and child components per
   angular.md §4–§6, mapped with the tables above. Register it by adding `load`
   (a lazy `import()` of the component) to the screen's entry in the screen table.
   Done when every action from step 1 has a store command, every state from
   step 1 renders and the route shows the component instead of the placeholder.
5. **Verify.**
   - angular.md §14 checklist passes; `npm run check` green.
   - Side by side with the mockup in the browser at 375, 768 and 1280 px, light
     and dark: same structure, copy, tokens and states. Differences are
     deliberate (a11y fix, removed hardcoded value) and listed in the report.
   - Each error state forced through the dev toolbar (`Prefer: code=…`) renders
     with retry.
   - Keyboard-only pass over the page.
