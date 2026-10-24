# Spec: `agent-contracts` (frontend, Phase 3)

Map: [SPEC.md](SPEC.md). Mirrors the backend contract in [SPEC-agent-runtime.md](SPEC-agent-runtime.md) and the
tool results in [SPEC-agent-tools.md](SPEC-agent-tools.md). Read `docs/conventions/contracts-and-mocks.md` first.

## Objective

The three agent endpoints have one zod schema and one registry entry each; every response, stream events
included, is parsed by its schema; the mock backend answers them with scripted, deterministic replies so the
widget can be built and tested without Ollama.

## Schemas (`libs/contracts/src/lib/assistant-agent/agent.schema.ts`)

```ts
export const AGENT_MESSAGE_MAX_LENGTH = 500;
export const AGENT_HISTORY_MESSAGES = 20;

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentCommandSchema = z.object({
  messages: z
    .array(AgentMessageSchema)
    .min(1)
    .max(AGENT_HISTORY_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === 'user'),
});
export type AgentCommand = z.infer<typeof AgentCommandSchema>;

export const ProfileChangeSchema = z.object({
  field: z.enum(['fullName', 'email', 'positionName']),
  label: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
});

/** A data change the model proposed; nothing has happened until it is confirmed. */
export const PendingActionSchema = z.discriminatedUnion('tool', [
  z.object({
    id: z.string(),
    tool: z.literal('update_profile'),
    title: z.string(),
    changes: z.array(ProfileChangeSchema).min(1),
    expiresAt: z.iso.datetime(),
  }),
]);
export type PendingAction = z.infer<typeof PendingActionSchema>;

export const AgentStreamEventSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('tool'), name: z.string() }), z.object({ type: z.literal('delta'), text: z.string() }), z.object({ type: z.literal('navigate'), path: z.string().startsWith('/'), title: z.string() }), z.object({ type: z.literal('action_required'), action: PendingActionSchema }), z.object({ type: z.literal('done'), answer: z.string(), citations: z.array(CitationSchema) }), z.object({ type: z.literal('error'), messageCode: z.string(), message: z.string() })]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

export const ActionResultSchema = z.discriminatedUnion('tool', [z.object({ actionId: z.string(), tool: z.literal('update_profile'), message: z.string(), data: MeSchema })]);
export type ActionResult = z.infer<typeof ActionResultSchema>;
```

- `CitationSchema` is imported from `knowledge.schema.ts` (one citation shape), `MeSchema` from `auth-v1.schema.ts`.
- `tool.name` stays `z.string()`: a tool the app does not know yet still parses, and the widget shows a generic
  status for it. An unknown `PendingAction.tool` fails parsing on purpose: the app must never offer to confirm a
  change it cannot show.
- The 1–500 limit on the last user message is the form's rule (`chat-widget`); the schema does not trim history.
- No UI copy in contracts; tool status labels live in the app.

## Endpoints (`agent.endpoints.ts`)

```ts
export const agentEndpoints = {
  /** One turn as NDJSON: `tool`, `delta`s, then `navigate`, `action_required` or `done`, or `error`. */
  stream: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/agent/stream',
    body: AgentCommandSchema,
    responseType: 'ndjson',
    response: AgentStreamEventSchema,
  }),
  /** Runs a pending action as the signed-in user. */
  confirmAction: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/agent/actions/{actionId}/confirm',
    params: z.object({ actionId: z.string() }),
    response: ActionResultSchema,
  }),
  /** Drops a pending action. */
  cancelAction: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/agent/actions/{actionId}/cancel',
    params: z.object({ actionId: z.string() }),
    response: z.unknown(),
  }),
} as const;
```

Not `served: 'mock'`: the backend has these endpoints once Phase 2 lands, so `FakeBackend` answers them only in
`mockBackend` mode, like the knowledge endpoints. Both files are exported from `libs/contracts/src/index.ts`.

## Backend refusals (`libs/mocks/src/lib/backend-responses.ts`)

Add `assistantAiUnavailable`, `assistantActionNotFound`, `assistantActionStale` with the codes, titles and messages of
`AssistantResponseCode` (HTTP 200).

## Fixtures and mock replies (`libs/mocks/src/lib/assistant-agent/agent.fixtures.ts`)

`FakeBackend` scripts each turn from the **last user message**, first match wins, so specs and the demo are
deterministic. It keeps pending actions in memory, bound to the signed-in user, with the same not-found rule.

| Last message contains (case- and accent-insensitive) | Reply                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `mở trang` / `mở màn hình` + a granted function name | `tool open_screen`, `navigate` to that function's route, `done` "Đã mở trang …"               |
| `mở trang` without a granted match                   | `delta`s + `done` "Bạn không có quyền mở màn hình này hoặc màn hình không tồn tại."           |
| `chức danh` / `email` / `họ tên` + `thành <giá trị>` | `tool update_profile`, `action_required` for that field (from = seeded value), `done`         |
| `lỗi ai`                                             | `tool search_documents`, then `error` `ASSISTANT-AI_UNAVAILABLE` (exercises mid-stream error) |
| `không có trong tài liệu`                            | `tool search_documents`, `done` with the fixed not-found sentence and no citations            |
| anything else                                        | `tool search_documents`, three `delta`s, `done` with `knowledgeAnswerFixture`'s citations     |

Confirm applies the change to the seeded user (so `/auth/me` returns it, as `updateMe` does) and answers
`ActionResult` with the refreshed `Me`. An SSO user gets no `update_profile` reply (the mock answers the not-allowed
text), matching the backend's offer rule.

## Project structure

```text
libs/contracts/src/lib/assistant-agent/   agent.schema.ts, agent.endpoints.ts, agent.schema.spec.ts
libs/contracts/src/index.ts               exports
libs/mocks/src/lib/assistant-agent/       agent.fixtures.ts
libs/mocks/src/lib/backend/fake-backend.ts  handlers for stream, confirm, cancel
libs/mocks/src/lib/backend-responses.ts   three refusals
```

## Testing

- `agent.schema.spec.ts`: every event type parses; `navigate` without a leading `/` fails; an unknown `tool` event
  parses; an unknown pending-action tool fails; a command whose last message is `assistant` fails.
- `fake-backend.spec.ts`: each scripted row yields its events in order and every line parses with
  `AgentStreamEventSchema`; confirm changes `/auth/me`; confirm twice, by another user, or after cancel →
  `assistantActionNotFound`.
- `fixtures.spec.ts`: the agent fixtures parse with their schemas.
- `npx nx test contracts` and `npx nx test mocks` green.

## Boundaries

- Always: types from `z.infer`; one citation shape shared with `knowledge`; refusals from `BACKEND_RESPONSES`.
- Ask first: widening `PendingActionSchema` beyond the tools in `SPEC-agent-tools.md`.
- Never: a fixture marker reaching the production or staging bundle; UI copy in contracts.

## Success criteria

`npm run check` green; the contract and mock specs above pass; `postman.contract.spec.ts` replays the backend's
new agent requests (added in `agent-tools`) against the mock and parses every answer.
