# Spec: `assistant-screen` (frontend, Phase 3)

Map: [SPEC.md](SPEC.md). Uses [SPEC-kb-contracts.md](SPEC-kb-contracts.md) and
[SPEC-doc-tracker.md](SPEC-doc-tracker.md). Mockup: `lms-mockup/src/pages/tools.js` (page `assistant`) and
`src/components/ai.js`; README checklist G.1 "Trợ lý AI có trích nguồn" (criterion F1). Follow
`docs/migration/mockup-to-angular.md` → "Converting one screen" and `docs/conventions/visual-design.md`.

## Objective

On `/assistant`, any signed-in user can add documents to the shared knowledge base, see every document and
its status, and ask questions whose answers show their sources (file, page, lines) as numbered badges that
open a popover with the quoted text.

## Route and menu

- Screen table: `/assistant` moves from `open` to a new menu group
  `AI_ASSISTANT: { nav: { icon: 'sparkles', section: 'Công cụ học' }, screens: [{ path: 'assistant',
title: 'Trợ lý AI', mockupPage: 'assistant', load: … }] }`.
- Route module `apps/lms/src/app/features/study-tools/assistant/` (feature folder from the migration
  doc's mapping).

## Layout (a workspace: chat that fills the page, documents panel on the right)

The route uses the `workspace` layout (`screens.ts`): the app frame is exactly the viewport
(`app-shell--fill`), the page fills what the header and the offline banner leave, and the window
never scrolls. Each region scrolls inside itself. Regions meet at 1px `border` lines; the panel is
on `surface`, the chat on the page background. No shadows, cards or tinted tiles.

1. **Chat column** (every column the panel does not take)
   - **Bar** (`min-height` 48px, 1px bottom border): `h1` **Trợ lý AI tra cứu tài liệu** (body font,
     `lg`, semibold: a workspace title, not a page hero), and the panel toggle on the right: a ghost
     `uiButton` (small) with icon `panel-right`, text **Tài liệu** and the document count in muted
     tabular figures. It has `aria-expanded` and `aria-controls="assistant-documents"` while the panel
     is open. No page description and no eyebrow.
   - **Conversation**: scrolls inside the column; messages sit in a centred column of
     `ui.layout(reading)` (760px), so lines stay readable at any width. It starts with the mockup's
     greeting **Xin chào! Hãy hỏi mình bất kỳ điều gì về nội dung tài liệu trong kho.** and scrolls to the
     newest message.
   - Each answer: plain text with each `[n]` marker that has a citation rendered as a **source badge**
     in place (see below); a marker with no matching citation stays as written. When the answer has no
     usable marker (the backend then returns every retrieved passage), the same badges sit in a row
     under the answer, with no heading. There is no **Nguồn** list.
   - While answering: a typing indicator with **Đang tìm trong tài liệu…**, then **Đã tìm thấy N đoạn
     liên quan, đang soạn câu trả lời…** after `retrieved`, then the text as it streams (markers are plain
     text until `done` brings the citations).
   - **Composer**, docked under the conversation (1px top border, same 760px column): label (visually
     hidden) **Câu hỏi cho trợ lý**, `input[uiInput]` placeholder **Nhập câu hỏi…**, `maxlength=300`,
     primary button **Hỏi** (icon `send`). While answering the input stays editable, the button becomes
     **Dừng** (secondary), which aborts the stream and keeps the partial text marked **Đã dừng**. Under
     it, one `xs` muted line: **Trợ lý chỉ trả lời từ các tài liệu trong kho. Hãy đối chiếu với tài liệu
     gốc trước khi áp dụng.**
2. **Documents panel** (`aside#assistant-documents`, `ui.layout(panel)` = 360px, from `md` 720px up)
   - **Bar** (same height as the chat bar, so the borders line up): `h2` **Tài liệu trong kho** and the
     count in muted text. The `aside` is labelled by this heading.
   - **Body** (scrolls): the upload control, then the list.
   - Upload: `[uiDropzone]` (compact padding) + file input `accept=".pdf,.md,.docx"`, `multiple`; text
     **Kéo thả tệp vào đây hoặc chọn tệp** and the hint **PDF, Markdown hoặc Word (.docx), tối đa 20 MB mỗi
     tệp.** Files upload one after another, each shown until the server answers. Client checks
     (extension, size) mirror the backend with the backend's messages; a refusal stays on that file's row
     (`ui-upload-item` with a dismiss button) instead of a toast.
   - List, server-paged (size 20, `ui-pagination`), newest first, rows divided by 1px lines, no card:
     file name (truncate + `title`), uploader, time (relative, `title` = full date), status as one
     `uiBadge` with `dot`: `queued` **Đang chờ** (neutral), `processing` **Đang xử lý** (info), `ready`
     **Sẵn sàng** (success), `failed` **Không xử lý được** (danger) with the server's `errorMessage` as a
     muted second line.
   - Reloads when `DocumentTrackerStore.finished` bumps and after each upload.
   - Empty: one muted line **Chưa có tài liệu nào. Tải lên tệp đầu tiên để bắt đầu hỏi đáp.**

### Panel open and closed

- The open/closed choice is per-viewer screen state in the store (`panelOpen`), not persisted.
- From `md` (720px) up it starts **open** beside the chat; the toggle hides it and the chat takes the
  full width.
- Below `md` it starts **closed** and opens as a `uiDrawer` from the end edge titled **Tài liệu trong
  kho**, holding the same upload control and list. Escape, the backdrop and the close button close it,
  and focus returns to the toggle (CDK dialog).
- Crossing the breakpoint resets the choice to that width's default.

### Source badges

- A focusable `button[uiBadge]` (`outline`, neutral colours) showing the number `n`, with
  `aria-label` **Nguồn 1: Quy-trinh-EOD.pdf, trang 3, dòng 13–27** (DOCX: **đoạn 4–6**, MD: **dòng
  2–9**). The number is the visible label, so the meaning never rests on colour.
- A click, tap, Enter or Space opens a `uiPopover` (a non-modal `role="dialog"` named like the badge)
  with the file name, the location (`citation-label.ts`: **trang 3 · dòng 13–27**, **đoạn 13–27**,
  **dòng 13–27**) and the snippet (at most 280 characters, from the backend). The badge carries
  `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`. Focus moves into the panel; Escape closes
  it with focus back on the badge; a click outside or a second click on the badge closes it.
- Badges are built from the parsed answer text and the citation array (`answer-parts.ts`), never from
  HTML.

### The owl on this page

The shell renders the owl `quiet` on a workspace page: only its screen-reader announcement stays, so it
never covers the composer or the panel toggle, and the panel shows the same document status.

## Store (`assistant/data-access/assistant.store.ts`)

`state`: `messages` (the chat log, browser only), `answering` (id of the message being streamed),
`uploadQueue`, `page`, `panelOpen` (a `linkedSignal` of the `md` breakpoint read through the CDK
`BreakpointObserver`; selectors `panelOpen$`, `panelBeside$`, `panelInDrawer$`). Resources: `documents` (`serverData`, `reloadOn` the tracker's `finished` and a local
invalidation), `upload` (a queue, one file at a time; a refusal stays on its row; on success `tracker.track(doc)` and next
in queue). Commands: `ask(question)`, `stop()`, `retry(messageId)`, `addFiles(files)`, `setPage(n)`,
`togglePanel()`, `closePanel()`.
Streaming uses `EndpointClient.stream` in a command; the subscription is held in the store and cancelled
by `stop()` and on destroy (raw stream, not `serverData`: comment says why).

## Components (each in its own folder under `assistant/components/`)

`chat-log`, `chat-message`, `source-badge`, `ask-form` (Signal Forms, schema from `AskCommandSchema` +
Vietnamese messages in `ask-form.form.ts`), `document-upload`, `document-list`. `citation-list` is gone. Presentational, inputs and
outputs only. A `knowledge-status` badge goes in `shared/` only if a second screen needs it.

## Deliberate differences from the mockup (listed again in the PR)

- Eyebrow "Công cụ học" removed (banned).
- Assistant avatar (sparkles icon in a yellow circle) removed: icon tile and `accent` outside achievements
  are banned; messages are told apart by alignment and a plain **Trợ lý** / **Bạn** label.
- The `alert` with icon becomes one muted line; its em-dash sentence is rewritten.
- The three suggestion chips (CIF, EOD, thay đổi khẩn cấp) removed: chips are for filters, and the
  questions depended on the mockup's seeded courses, not on uploaded documents.
- Citations are numbered badges inside the answer whose popover shows file, page and line range and the
  snippet, instead of `lessonTitle · where` links.
- The page is a workspace in the spirit of a notebook tool: the chat fills the page and the documents
  sit in a panel that opens and closes (a drawer on a phone), separated by 1px borders. The page header
  and its description become a slim bar with the `h1` and the panel toggle.
- New: upload and the shared document list (not in the mockup).

## Local run

`apps/lms/proxy.conf.mjs` reads `LMS_API_TARGET` (default stays `http://103.121.90.119:8019`); for this
PoC: `LMS_API_TARGET=http://localhost:8019 npm start` with `mockBackend: false`.

## Testing

- Store spec: list load/error/retry, upload queue (sequential, tracker called), `ask` streaming events into
  messages, `stop` aborts, offline and refusal errors, not-found answer has no citations.
- Component specs: each state above renders; citation labels per file type; markers become badges (a
  marker without a citation stays text, an answer without markers gets the row); the badge popover shows
  file, location and snippet on click, closes on Escape with focus back on the badge and on a second click; the panel toggle flips
  `aria-expanded`; below `md` the panel is a drawer that Escape closes with focus back on the toggle;
  keyboard: the form submits on Enter.
- Migration registry: `route-assistant` and `feature-assistant` entries move to `done` with the PR link and
  the four checks.

## Verify (migration doc step 5)

angular.md §14; `npm run check`; side by side with the mockup at 375, 768, 1280 and 1440 px, light and dark;
visual-design checklist; each error forced through the dev toolbar (`Prefer: code=…`); keyboard-only pass.

## Boundaries

- Always: store owns state; copy in Vietnamese from the mockup or this spec.
- Never: render answer text as HTML; compute status or relevance in the app.

## Success criteria

All of the above pass, and against the local backend a real upload goes `Đang chờ → Đang xử lý → Sẵn
sàng` in the list while a question streams an answer with citations.

## Implementation notes (as built)

- No chat card: the chat column is plain content (`visual-design.md` rule on cards and framing). Since the redesign the
  conversation scrolls inside the chat column (the `workspace` layout) and the newest message is scrolled into view.
- Sources open in the existing `uiPopover`, not a tooltip: the content is several lines (file, place, quote) and a
  click works the same with a mouse, a keyboard and a touch screen. `uiBadge` also applies to a `<button>`.
- New layout tokens: `reading` (760px, the conversation column) and `panel` (360px, the documents panel).
- The streamed text is silent for screen readers; a visually hidden `role="status"` region announces "Đang tìm…", "Đang soạn…"
  and the finished answer once, instead of `aria-live` on the log.
- The opening line "Xin chào! …" is kept as the chat's first message (a conversation start, not a page greeting).
- A blank question is not sent and shows no error text; `maxlength` comes from `maxLength(path, 300)` on the form.
- The migration entries `route-assistant` and `feature-assistant` are claimed (`in-progress`, owner Hienne); they turn `done`
  with the pull request link, which the registry schema requires.
