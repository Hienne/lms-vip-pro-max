# Spec: `assistant-screen` (frontend, Phase 3)

Map: [SPEC.md](SPEC.md). Uses [SPEC-kb-contracts.md](SPEC-kb-contracts.md) and
[SPEC-doc-tracker.md](SPEC-doc-tracker.md). Mockup: `lms-mockup/src/pages/tools.js` (page `assistant`) and
`src/components/ai.js`; README checklist G.1 "Trợ lý AI có trích nguồn" (criterion F1). Follow
`docs/migration/mockup-to-angular.md` → "Converting one screen" and `docs/conventions/visual-design.md`.

## Objective

On `/assistant`, any signed-in user can add documents to the shared knowledge base, see every document and
its status, and ask questions whose answers show their sources (file, page, lines) with the quoted text one
click away.

## Route and menu

- Screen table: `/assistant` moves from `open` to a new menu group
  `AI_ASSISTANT: { nav: { icon: 'sparkles', section: 'Công cụ học' }, screens: [{ path: 'assistant',
title: 'Trợ lý AI', mockupPage: 'assistant', load: … }] }`.
- Route module `apps/lms/src/app/features/study-tools/assistant/` (feature folder from the migration
  doc's mapping).

## Layout (top to bottom; two columns at ≥ 1024 px, chat left 2/3, documents right 1/3; one column below)

1. `ui-page-header`: title **Trợ lý AI tra cứu tài liệu**; description **Hỏi đáp dựa trên các tài liệu
   trong kho dùng chung, luôn kèm nguồn trích dẫn.** No eyebrow.
2. **Chat card**
   - One muted line: **Trợ lý chỉ trả lời từ các tài liệu trong kho. Hãy đối chiếu với tài liệu gốc trước
     khi áp dụng.**
   - Message log (`aria-live="polite"`, scrolls to the newest message), starting with the mockup's
     greeting: **Xin chào! Hãy hỏi mình bất kỳ điều gì về nội dung tài liệu trong kho.**
   - Each answer: the text (plain text, `[n]` markers kept), then **Nguồn** and one row per citation:
     `[n] <tên tệp> · trang 3 · dòng 13–27` (PDF), `· dòng 13–27` (MD), `· đoạn 13–27` (DOCX, by file
     extension). Each row is a native `<details>`; its `<summary>` is the label, the body is the `snippet`
     in a quote block.
   - While answering: a typing indicator with **Đang tìm trong tài liệu…**, then **Đã tìm thấy N đoạn liên
     quan, đang soạn câu trả lời…** after `retrieved`, then the text as it streams; citations appear on
     `done`.
   - Form: label (visually hidden) **Câu hỏi cho trợ lý**, `input[uiInput]` placeholder **Nhập câu
     hỏi…**, `maxlength=300`, primary button **Hỏi** (icon `send`). While answering the input stays
     editable, the button becomes **Dừng** (secondary), which aborts the stream and keeps the partial text
     marked **Đã dừng**.
3. **Documents card** (title **Tài liệu trong kho**, count in muted text)
   - Upload: `[uiDropzone]` + file input `accept=".pdf,.md,.docx"`, `multiple`; text **Kéo thả tệp vào
     đây hoặc chọn tệp** and the hint **PDF, Markdown hoặc Word (.docx), tối đa 20 MB mỗi tệp.** Files
     upload one after another, each shown with `ui-upload-item` until the server answers. Client checks
     (extension, size) mirror the backend with the backend's messages; a server refusal is a toast.
   - List, server-paged (size 20, `ui-pagination`), newest first: file name (truncate + `title`),
     uploader, time (relative, `title` = full date), status as one `uiBadge` with `dot`:
     `queued` **Đang chờ** (neutral), `processing` **Đang xử lý** (info), `ready` **Sẵn sàng** (success),
     `failed` **Không xử lý được** (danger) with the server's `errorMessage` as a muted second line.
   - Reloads when `DocumentTrackerStore.finished` bumps and after each upload.
   - Empty: one muted line **Chưa có tài liệu nào. Tải lên tệp đầu tiên để bắt đầu hỏi đáp.**

## States (from mockup step 1 + the new data)

| State                      | Render                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| list loading               | `uiSkeleton` rows                                                                                                 |
| list error                 | `ui-error-state` with retry                                                                                       |
| list empty                 | the muted line above                                                                                              |
| no `ready` document yet    | the form stays usable; the not-found answer explains itself                                                       |
| asking offline             | mockup copy **Mất kết nối — không gửi được câu hỏi. Thử lại khi có mạng.** in the answer bubble, with **Thử lại** |
| `KNOWLEDGE-AI_UNAVAILABLE` | the server's message in the bubble, with **Thử lại**                                                              |
| stream `error` event       | partial text kept, the message below it, **Thử lại**                                                              |
| not found                  | the fixed sentence, no **Nguồn**                                                                                  |

## Store (`assistant/data-access/assistant.store.ts`)

`state`: `messages` (the chat log, browser only), `answering` (id of the message being streamed),
`uploadQueue`, `page`. Resources: `documents` (`serverData`, `reloadOn` the tracker's `finished` and a local
invalidation), `upload` (`serverMutation`, `errors: 'toast'`, `onSuccess` → `tracker.track(doc)` and next
in queue). Commands: `ask(question)`, `stop()`, `retry(messageId)`, `addFiles(files)`, `setPage(n)`.
Streaming uses `EndpointClient.stream` in a command; the subscription is held in the store and cancelled
by `stop()` and on destroy (raw stream, not `serverData`: comment says why).

## Components (each in its own folder under `assistant/components/`)

`chat-log`, `chat-message`, `citation-list`, `ask-form` (Signal Forms, schema from `AskCommandSchema` +
Vietnamese messages in `ask-form.form.ts`), `document-upload`, `document-list`. Presentational, inputs and
outputs only. A `knowledge-status` badge goes in `shared/` only if a second screen needs it.

## Deliberate differences from the mockup (listed again in the PR)

- Eyebrow "Công cụ học" removed (banned).
- Assistant avatar (sparkles icon in a yellow circle) removed: icon tile and `accent` outside achievements
  are banned; messages are told apart by alignment and a plain **Trợ lý** / **Bạn** label.
- The `alert` with icon becomes one muted line; its em-dash sentence is rewritten.
- The three suggestion chips (CIF, EOD, thay đổi khẩn cấp) removed: chips are for filters, and the
  questions depended on the mockup's seeded courses, not on uploaded documents.
- Citations show page and line ranges with an expandable snippet instead of `lessonTitle · where` links.
- New: upload and the shared document list (not in the mockup).

## Local run

`apps/lms/proxy.conf.mjs` reads `LMS_API_TARGET` (default stays `http://103.121.90.119:8019`); for this
PoC: `LMS_API_TARGET=http://localhost:8019 npm start` with `mockBackend: false`.

## Testing

- Store spec: list load/error/retry, upload queue (sequential, tracker called), `ask` streaming events into
  messages, `stop` aborts, offline and refusal errors, not-found answer has no citations.
- Component specs: each state above renders; citation labels per file type; keyboard: the form submits on
  Enter, `<details>` toggle with Enter/Space.
- Migration registry: `route-assistant` and `feature-assistant` entries move to `done` with the PR link and
  the four checks.

## Verify (migration doc step 5)

angular.md §14; `npm run check`; side by side with the mockup at 375, 768, 1280 px, light and dark;
visual-design checklist; each error forced through the dev toolbar (`Prefer: code=…`); keyboard-only pass.

## Boundaries

- Always: store owns state; copy in Vietnamese from the mockup or this spec.
- Never: render answer text as HTML; compute status or relevance in the app.

## Success criteria

All of the above pass, and against the local backend a real upload goes `Đang chờ → Đang xử lý → Sẵn
sàng` in the list while a question streams an answer with citations.
