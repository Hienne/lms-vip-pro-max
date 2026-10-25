# Spec: `chat-widget` (frontend, Phase 3)

Map: [SPEC.md](SPEC.md). Uses [SPEC-agent-contracts.md](SPEC-agent-contracts.md). The launcher is
[SPEC-owl-launcher.md](SPEC-owl-launcher.md). Read `docs/conventions/angular.md`, `ui-library.md` and
`visual-design.md` first.

## Objective

A small chat panel, "Trợ lý nhanh", that floats above the owl in the bottom-right corner of every app page. The
user asks about documents, asks to open a screen, or asks to change their profile; answers stream in, document
answers show source badges as on `/assistant`, navigation happens on its own, and a profile change shows a card
that does nothing until "Xác nhận". The conversation survives navigation and reload in this tab.

## Where it lives

```text
apps/lms/src/app/core/assistant/
├── agent-chat.store.ts          app-level store (providedIn: 'root'), like DocumentTrackerStore
├── agent-chat.model.ts          AgentTurn, AgentReply, ActionCard
├── agent-chat.storage.ts        sessionStorage read/write, versioned, tolerant of bad data
└── *.spec.ts
apps/lms/src/app/core/storage/session-storage.ts   SESSION_STORAGE token, the twin of LOCAL_STORAGE
apps/lms/src/app/layout/chat-widget/
├── chat-widget.ts|html|scss      the panel (owns its DOM: header, log, composer)
└── components/
    ├── agent-message/            one turn: question, reply text with badges, tool status, error
    ├── action-card/              the confirmation card
    └── agent-composer/           Signal Form: textarea, send, stop
apps/lms/src/app/shared/assistant/   moved from features/study-tools/assistant (no behaviour change):
    source-badge/, answer-parts.ts, citation-label.ts (+ their specs)
```

`layout/` cannot import from `features/`, so the source badge, `answer-parts` and `citation-label` move to
`shared/assistant/`; the `/assistant` screen imports them from there. The move is its own commit, with the
assistant specs green before and after.

## Store (`AgentChatStore`)

State (signals, private, exposed read-only):

```ts
interface AgentTurn {
  readonly id: number;
  readonly question: string;
  readonly reply: AgentReply;
}
interface AgentReply {
  readonly status: 'waiting' | 'working' | 'composing' | 'done' | 'stopped' | 'error';
  readonly toolName: string | null; // the last `tool` event, for the status line
  readonly text: string;
  readonly citations: readonly Citation[];
  readonly navigatedTo: { path: string; title: string } | null;
  readonly action: ActionCard | null;
  readonly error: string | null;
}
interface ActionCard {
  readonly pending: PendingAction;
  readonly status: 'pending' | 'confirming' | 'confirmed' | 'cancelled' | 'expired' | 'failed';
  readonly message: string | null; // the server's result or refusal message
}
```

plus `open: boolean` and `answeringId: number | null`.

Commands and rules:

- `toggle()`, `open()`, `close()`. Opening does not send anything.
- `ask(question)`: refused while answering or offline (`NetworkStore`), with the `/assistant` offline message.
  Builds `AgentCommand` from the last 10 finished turns (`user` = question, `assistant` = final reply text, plus
  the card's result message when the action was confirmed or cancelled; errored and stopped turns are left out),
  then the new question. Streams `agentEndpoints.stream` through `EndpointClient` exactly like
  `AssistantStore.ask` (one `Subscription`, unsubscribed on stop and on destroy).
- Events: `tool` → `working` with `toolName`; `delta` → `composing`, text appended; `navigate` → `navigatedTo` set
  and `Router.navigateByUrl(path)` **only if** `path` is one of the signed-in user's nav item paths (otherwise the
  reply shows the generic error and nothing navigates); `action_required` → `action` with status `pending`;
  `done` → text replaced by `answer`, `citations` set, `done`; `error` → `error` with the event's message; a stream
  that ends without `done` → `error` "Kết nối bị ngắt khi đang trả lời."; a refusal envelope before the stream →
  `error` with its message.
- `stop()`: unsubscribes; the reply becomes `stopped`, keeping the text streamed so far.
- `confirm(turnId)` / `cancel(turnId)`: `serverMutation` on `confirmAction` / `cancelAction`, errors handled inline
  (no toast: the card is the one feedback). Confirm success → `session.apply(result.data)`, card `confirmed` with
  `result.message`. `ASSISTANT-ACTION_NOT_FOUND` → `expired`; `ASSISTANT-ACTION_STALE` and any other refusal →
  `failed`; both show the server's message. A card whose `expiresAt` has passed is shown `expired` without a
  request. Only one card can be confirming at a time.
- `clear()`: empties the conversation (and storage); refused while answering.
- **Persistence:** on every change, a streaming turn included, the turns are written to `sessionStorage`
  under `lms.agent-chat.v1.<userId>` (at most 30 turns, oldest dropped). Whenever a user is signed in, every other
  `lms.agent-chat.v1.*` key in the tab is removed. On sign-in the store reads that key;
  data that fails its zod check is discarded. A turn that was streaming at reload is restored as `stopped`. Sign-out
  removes the key and empties the state. `open` is persisted too, so a reload keeps the panel open.

Selectors: `turns$`, `isOpen$`, `isAnswering$`, `available$` (signed in, `AI_ASSISTANT` among the user's menus,
password change not pending), `announcement$` (screen-reader text, as `AssistantStore.announcement$`).

## Panel (`ChatWidget`)

- Rendered by the app shell when `available$` and the current page is not `/assistant` (the shell's
  `fillsViewport$`), and only while `isOpen$`. Outside the router outlet, so it survives navigation.
- `role="dialog"`, `aria-modal="false"`, named "Trợ lý nhanh" by `aria-label`. Non-modal: the page stays usable
  beside it. Opening focuses the composer; `Escape` or "Đóng" closes and returns focus to the owl once it shows
  again; focus is not trapped.
- Size and place: the owl's button hides while the panel is open, at every width, and the panel takes its corner.
  Below `sm`, a full-screen sheet. From `sm`, it floats in the corner, `container-assistant` (416px) wide and
  half the viewport (`50dvh`) tall however long the conversation, with `surface`, a 1px `border`, the card
  radius and `shadow(md)`. From `xl`, "Mở rộng" docks it to the right edge at full height: the shell pads its main
  column by the same width, and "Thu nhỏ" floats it again. The choice
  (`docked`) is kept with the chat in `sessionStorage`, written only when on. No entrance animation.
- Header: the owl face (`app-owl-face`, decorative) in place of a title, then icon buttons only, each with a tooltip:
  "Xoá hội thoại" (only once there are turns; disabled while answering), "Mở rộng" / "Thu nhỏ" (from `xl`), "Đóng".
  The sidebar's "Trợ lý AI" item is the way to `/assistant`.
- Log: turns in order, scrolled to the newest, further apart than the parts of a turn. The user's question is an
  outlined bubble on the right; the reply is plain text. Empty state, left-aligned: the muted line "Hỏi về tài liệu,
  mở một màn hình hoặc sửa hồ sơ của bạn. Thử:" and three suggested questions as plain links, which send as they stand:
  "Quy trình EOD gồm những bước nào?", "Mở trang Hồ sơ cá nhân", "Đổi chức danh của tôi". No chips, no greeting.
- Reply status line (muted, spinner, the answer's line height) until the first text: `search_documents` "Đang tìm
  trong tài liệu…", `open_screen` "Đang mở màn hình…", `update_profile` "Đang chuẩn bị thay đổi…", any other "Đang xử
  lý…", then "Đang soạn câu trả lời…" while composing. The text replaces it on the same line.
- Reply text renders a `[n]` marker as a small raised teal number that moves focus to its line in the source list under
  the reply: every source of a finished reply, in number order, as "n file · place"; a line opens a popover with the
  quoted passage. `/assistant` keeps the shared source badges. A navigation reply links the page title in its text, or
  on a line of its own when the text does not name it.
- Action card (`ActionCard`): a question as its title, "Đổi chức danh?" for one field and the action's `title` with
  "?" for several (each field then named above its values); "Hiện tại" and "Mới" in two columns, the new value in
  semibold, `null` shown as "(trống)"; buttons "Xác nhận" (primary) and "Huỷ". Once confirmed, cancelled, expired or
  failed, the card gives way to its one result line, `expired` and `failed` in the danger text token.
- Composer: one line that grows with the text (up to 8rem), 1–500 characters after trim, counter from 400. The send
  icon button ("Gửi") sits inside the box and becomes "Dừng" while answering. `Enter` sends, `Shift+Enter` new line.
  Disabled offline with the offline line.

## Testing

- `agent-chat.store.spec.ts` (mock backend via `provideMockBackendHttp`, `signInToMockBackend`): the history sent is
  the last 10 finished turns with results, errored and stopped turns left out; every event moves the reply as above;
  a `navigate` outside the user's nav does not navigate; confirm applies `Me` to the session; not-found → `expired`,
  stale → `failed`; an expired `expiresAt` makes no request; stop keeps text; offline refuses; persistence
  round-trips, discards bad data, restores a streaming turn as `stopped`, and sign-out clears it.
- `agent-chat.storage.spec.ts`: version key, 30-turn cap, blocked storage (`null` token) works in memory.
- `chat-widget.spec.ts`: hidden on `/assistant` and for a user without `AI_ASSISTANT`; `Escape` closes and focuses the
  owl; clear only with turns and disabled while answering; the suggestions send; the dock toggle.
- `action-card.spec.ts`, `agent-message.spec.ts`, `agent-sources.spec.ts`, `agent-composer.spec.ts`: the question,
  `(trống)`, buttons by state, the settled line; raised numbers and the source list; Enter / Shift+Enter, length
  limit, stop.
- `owl.spec.ts`, `app-shell.spec.ts`: the owl steps aside for the sheet and the dock; the shell makes room when docked.
- The `/assistant` specs pass unchanged after the `shared/assistant/` move.

## Boundaries

- Always: the store owns state, components render selectors and call commands; tokens only; Vietnamese copy above;
  the visual-design checklist; one feedback per event.
- Ask first: inline editing of an action's values; showing the widget on `/assistant`; persisting beyond the tab.
- Never: navigate to a path that is not in the user's nav; confirm without a click on "Xác nhận"; an icon tile,
  gradient, coloured edge or badge soup in the panel; logging message content.

## Success criteria

`npm run check` green; angular.md §14 and the visual-design checklist pass; in the browser on the mock backend
(`mockBackend: true`): each scripted row of `agent-contracts` behaves as above, at 375px and at desktop width, in
light and dark themes, keyboard-only (open, ask, confirm, close).

## Implementation notes (as built)

- History: the store sends 9 finished turns plus the new question (`HISTORY_TURNS`), because the backend caps a request at
  20 messages; decision C4 said 10 turns.
- The panel opens at the newest message every time and keeps following streamed text only while the reader is at the end.
- After "Xác nhận" or "Huỷ" the cursor goes back to the message box, since the card's buttons disappear.
- The action card's CSS block is `action-card`: a block named `card` is reserved for the design system (template scan).
- The open state is stored with the conversation, so the panel is still open after a reload.
- Hardened after the ship review (2026-10-24): a confirm or cancel in flight is dropped when the user changes, and an
  answer that lands before the store noticed is ignored; a stream's late callbacks touch only its own turn (a late
  `complete` no longer clears the newer stream's handle, a late `done` no longer unlocks the composer); the chat is
  stored while streaming; other users' keys are cleared on sign-in.
- Browser pass (mock and local backend): 375 and 1280 wide, light and dark, keyboard only (owl → Enter → type → Enter → Tab to
  "Xác nhận" → Enter → Escape).
