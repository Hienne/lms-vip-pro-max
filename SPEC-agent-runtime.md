# Spec: `agent-runtime` (backend, Phase 1)

Map: [SPEC.md](SPEC.md). Builds on the shipped `OllamaClient` and settings of [SPEC-kb-storage.md](SPEC-kb-storage.md).
The tools themselves are [SPEC-agent-tools.md](SPEC-agent-tools.md); this module runs any tool that implements
`AgentTool` and owns the contract between the backend and the app.

## Objective

A signed-in user sends the recent conversation; the backend asks `qwen3:8b` with the tools this user may use,
runs the read-only tools the model calls, feeds their results back, and streams the answer. A tool that changes
data never runs inside the loop: it becomes a pending action the user must confirm through a separate request,
which then runs as that user. The loop is bounded and every failure ends the stream with a readable message.

## API (`/api/v1/assistant/agent`, every user granted `AI_ASSISTANT`)

All three endpoints read `/auth/me` on the request thread and refuse with `CORE-ACCESS_DENIED` (HTTP 403) unless its
`functions` list `AI_ASSISTANT`; a user still on a temporary password has no functions, so this also keeps them out.

| Method | Path                          | Request                | Success                                    | Refusals (HTTP 200 `ERROR` unless noted)                                                        |
| ------ | ----------------------------- | ---------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| POST   | `/stream`                     | `AgentRequest` (below) | `application/x-ndjson`, one event per line | before the first line, JSON envelope: `CORE-VALIDATION_FAILED`, `ASSISTANT-AI_UNAVAILABLE`; 401 |
| POST   | `/actions/{actionId}/confirm` | —                      | `BaseResponse<ActionResultView>`           | `ASSISTANT-ACTION_NOT_FOUND`, `ASSISTANT-ACTION_STALE`, the tool's own refusals; 401            |
| POST   | `/actions/{actionId}/cancel`  | —                      | `BaseResponse<Void>`                       | `ASSISTANT-ACTION_NOT_FOUND`; 401                                                               |

Streams are not wrapped in `BaseResponse` (API_CONTRACT.md: file/stream keep their own protocol), exactly as
`/knowledge/chat/stream`. The client sends `Accept: application/x-ndjson, application/json`.

### Request

```json
{
  "messages": [
    { "role": "user", "content": "CIF là gì?" },
    { "role": "assistant", "content": "CIF là mã khách hàng duy nhất… [1]" },
    { "role": "user", "content": "Mở trang quản lý người dùng" }
  ]
}
```

- 1–20 messages (10 turns); roles `user` and `assistant` only, any other role is `CORE-VALIDATION_FAILED`;
  the last message is `user`; each `content` is trimmed, `user` 1–500 characters, `assistant` up to 4000
  (longer is cut, not refused, since it is the server's own earlier answer).
- History is text only. Tool calls and tool results are never accepted from the client; they exist only inside
  one request. A client that edits earlier `assistant` text gains nothing it could not type itself.
- Over 16 000 characters in all (`MAX_HISTORY_CHARS`), the oldest messages are dropped until the rest fits, starting
  again on a `user` message, so the prompt stays within `num_ctx` 8192.

### Stream events

```text
{"type":"tool","name":"search_documents"}                                  a tool started (the app shows a status line)
{"type":"delta","text":"CIF là "}                                          answer text, many lines
{"type":"navigate","path":"/admin/users","title":"Quản lý người dùng"}     the app navigates (from open_screen)
{"type":"action_required","action":{…PendingActionView…}}                  a data change waits for confirmation
{"type":"done","answer":"…","citations":[…]}                               last line on success
{"type":"error","messageCode":"ASSISTANT-AI_UNAVAILABLE","message":"…"}    last line on failure mid-stream
```

`citations` has the `kb-chat` `CitationView` shape (`n`, `documentId`, `fileName`, `page`, `lineStart`,
`lineEnd`, `snippet`) and is empty unless `search_documents` ran in this turn. `answer` on `done` is the final
text; a client replaces what it streamed with it (same rule as `kb-chat`).

```json
{
  "id": "6f1c…",
  "tool": "update_profile",
  "title": "Cập nhật hồ sơ cá nhân",
  "changes": [{ "field": "positionName", "label": "Chức danh", "from": "Chuyên viên", "to": "Chuyên viên chính" }],
  "expiresAt": "2026-10-24T09:10:00Z"
}
```

`ActionResultView`: `{ "actionId": "6f1c…", "tool": "update_profile", "message": "Đã cập nhật hồ sơ.", "data": { …MeResponse… } }`.
`data` is tool-specific (each tool documents it); for `update_profile` it is the refreshed `/auth/me`.

## Agent loop (`AgentService`)

On the request thread (so refusals are envelopes):

1. Validate the request (above).
2. Build the `AgentContext`: the actor's user id, `AuthorizationService.rights(userId)` and the current profile.
   Tools read identity **only** from this context, never from `SecurityContextHolder` (the stream body runs on
   another thread).
3. `ollama.isAvailable()` (2 s probe) false → `ASSISTANT-AI_UNAVAILABLE`.
4. Ask the registry for the tools this context may use (`AgentTool.availableTo(context)`), and their Ollama
   definitions (`definition(context)`: a tool may tailor its schema, e.g. the user's own screens).

Inside the `StreamingResponseBody`:

5. Take a place from `TurnLimiter`: one turn per user, at most `max-concurrent-turns` on the server. No place → the
   only event is `error` `ASSISTANT-BUSY` and the model is not called. The place is given back in a `finally`.
   Messages = system prompt (below) + the request's messages.
6. Up to `max-steps` (4) model calls: `ollama.chatWithTools(messages, tools, AGENT options, onDelta)`.
   Content deltas are written as `delta` events as they arrive.
   - No tool call → the turn is over: write `done` and stop.
   - Tool calls → only the first 3 (`MAX_CALLS_PER_STEP`) run and go back to the model; for each, in order: write `tool`; look the tool up (unknown name → tool result
     `"Công cụ không tồn tại."`); parse and validate its arguments with the tool's own validator (bad
     arguments → tool result with the validation message, so the model can ask the user); run it.
   - A tool's `ToolOutcome` is one of: `Result(text)` (appended as a `tool` message, loop continues),
     `Navigate(path, title, text)` and `ActionRequired(PendingAction)`. The last two are **terminal**: the runtime
     writes the event, then `done` with the outcome's fixed text, and makes no further model call.
   - Once a tool that `readsSharedContent()` (`search_documents`) has run, the tools that `actsForUser()`
     (`open_screen`, `update_profile`) are no longer offered, and a call to one, in the same step or later, gets the
     result `"Không thể mở màn hình hay đề xuất thay đổi trong lượt đã đọc tài liệu. Hãy trả lời câu hỏi, người dùng
có thể gửi yêu cầu đó riêng."` instead of running: document text is written by others and may carry instructions.
   - A blank final answer, after the finisher, becomes `"Mình chưa có câu trả lời cho yêu cầu này. Bạn thử hỏi lại
nhé."` with no citations.
7. Cap reached with the model still calling tools → `done` with
   `"Mình chưa xử lý được yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé."`.
8. `OllamaUnavailableException`/`OllamaException` (a stream closed before `done: true` included) → `error` event
   `ASSISTANT-AI_UNAVAILABLE`. Any other
   exception → `error` event `CORE-INTERNAL_ERROR` with the generic message; the stack trace is logged without
   message content.

`TurnState` is the per-turn scratch space a tool may write to. A tool that needs to shape the final answer
registers a `TurnFinisher` on it (`turn.finishWith(finisher)`); without one, `done` carries the streamed text and
no citations. `search_documents` uses it to keep the chunks it retrieved and apply the `[n]` and not-found rules
(see `SPEC-agent-tools.md`). Terminal outcomes skip the finisher.

### System prompt (Vietnamese)

```text
Bạn là trợ lý của hệ thống đào tạo Core Banking Academy, trả lời ngắn gọn bằng tiếng Việt.
Bạn có các công cụ được liệt kê. Chọn công cụ khi yêu cầu cần đến nó:
- Câu hỏi về nghiệp vụ, quy trình, thuật ngữ, tài liệu: luôn gọi search_documents trước, không trả lời từ kiến thức bên ngoài.
- Mở một màn hình: gọi open_screen với đúng mã chức năng trong danh sách.
- Sửa hồ sơ của chính người dùng: gọi update_profile; thay đổi chỉ có hiệu lực khi người dùng xác nhận.
Không bịa mã chức năng, giá trị hay kết quả. Nếu thiếu thông tin, hỏi lại người dùng một câu.
Với lời chào hoặc câu hỏi về cách dùng trợ lý, trả lời trực tiếp, không gọi công cụ.
```

Tool-specific rules (citation markers, the not-found sentence) live in each tool's description and result
text, not in this prompt.

## Ollama tool calling (`OllamaClient`, `knowledge/ai`)

New method beside `chatStream`; existing methods and their behaviour do not change.

```java
public ChatTurn chatWithTools(List<ChatMessage> messages, List<ToolDefinition> tools, Options options,
                              Consumer<String> onDelta)
```

- Body: as `chatBody` plus `"tools": [{ "type": "function", "function": { "name", "description", "parameters" } }]`,
  `stream: true`, `think: false`.
- Reading the stream: content deltas go to `onDelta`; `message.tool_calls` (`function.name`, `function.arguments`
  as a JSON object) are collected across lines; return at `done: true`; the stream ending without it is an
  `OllamaException` (also for `chatStream`). The log line names only the calls whose name is among the offered tools,
  others as `unknown`.
- `ChatMessage` carries `role`, `content`, optional `tool_calls` (an assistant step that called tools) and optional
  `tool_name` (a `tool` result), serialised with `NON_NULL` so the existing `Message` shape is unchanged.
- `Options.AGENT = new Options(0.1, 8192)`.
- Logs model, message count, tool names called and duration; never content or arguments.

## Pending actions (`PendingActionStore`)

- In memory: `ConcurrentHashMap<String, PendingAction>`, id = random UUID. `PendingAction(id, userId, tool,
arguments, preview, createdAt, expiresAt)`.
- TTL `action-ttl` (10 min). Expired entries are removed on every access and by a `@Scheduled` sweep each minute.
  At most 20 per user; the oldest is dropped when a 21st is added.
- `confirm(id, actorId)`: removes the entry atomically (so a double click runs once) and fails with
  `ASSISTANT-ACTION_NOT_FOUND` when it is missing, expired **or belongs to another user** (the same code, so an id
  reveals nothing). Then calls `tool.execute(action, context)` on the request thread, inside the tool's service
  transaction, with the normal security context.
- `cancel(id, actorId)`: removes it; the same not-found rule.
- A restart loses every pending action; the app shows the not-found message on confirm.

## Response codes (`AssistantResponseCode`)

| Code                         | Title                      | Message                                                                  |
| ---------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `ASSISTANT-AI_UNAVAILABLE`   | Dịch vụ AI chưa sẵn sàng   | Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.                |
| `ASSISTANT-ACTION_NOT_FOUND` | Yêu cầu không còn hiệu lực | Yêu cầu này đã hết hạn hoặc đã được xử lý. Vui lòng yêu cầu lại trợ lý.  |
| `ASSISTANT-BUSY`             | Trợ lý đang bận            | Trợ lý đang bận trả lời. Bạn đợi câu trả lời trước xong rồi thử lại nhé. |
| `ASSISTANT-ACTION_STALE`     | Dữ liệu đã thay đổi        | Dữ liệu đã thay đổi từ lúc trợ lý đề xuất. Vui lòng yêu cầu lại.         |

All HTTP 200, like `KnowledgeResponseCode`.

## Configuration

```yaml
app:
  assistant:
    agent:
      max-steps: ${ASSISTANT_AGENT_MAX_STEPS:4}
      history-messages: 20
      action-ttl: ${ASSISTANT_ACTION_TTL:10m}
      max-concurrent-turns: ${ASSISTANT_MAX_CONCURRENT_TURNS:4}
spring:
  mvc:
    async:
      request-timeout: ${ASSISTANT_STREAM_TIMEOUT:15m}
```

The model, URL and timeouts stay under `app.knowledge.ollama` (one Ollama client). The async timeout must cover
`max-steps` × the Ollama `read-timeout` (4 × 180 s); the servlet default of about 30 s cut longer turns.

## Project structure

```text
src/main/java/vn/com/coreacademy/assistant/
├── package-info.java
├── config/      AssistantProperties, AssistantSchedulingConfig (the sweep)
├── controller/  AgentController (stream), AgentActionController (confirm, cancel)
├── agent/       AgentService, AgentContext, AgentPrompt (the system prompt), ToolRegistry
├── tool/        AgentTool, ToolOutcome (sealed), ToolArguments (validation helper), TurnFinisher
├── action/      PendingAction, PendingActionStore
├── dto/         AgentRequest, AgentMessage, AgentStreamEvent (sealed records), PendingActionView, ActionResultView
└── exception/   AssistantResponseCode
src/main/java/vn/com/coreacademy/knowledge/ai/   OllamaClient.chatWithTools, ChatMessage, ToolCall, ToolDefinition, ChatTurn
docs/api/ASSISTANT.md, docs/postman (agent requests), application.yml
```

## Code style

```java
public interface AgentTool {
    String name();
    boolean availableTo(AgentContext context);
    ToolDefinition definition(AgentContext context);
    /** Validates the model's arguments and either answers, navigates or proposes an action. */
    ToolOutcome run(JsonNode arguments, AgentContext context, TurnState turn);
    /** Only tools that change data; runs after the user confirms, on the request thread. */
    default ActionResultView execute(PendingAction action, AgentContext context) {
        throw new UnsupportedOperationException(name() + " changes no data");
    }
}

public sealed interface ToolOutcome {
    record Result(String text) implements ToolOutcome { }
    record Navigate(String path, String title, String text) implements ToolOutcome { }
    record ActionRequired(PendingAction action, String text) implements ToolOutcome { }
}

/** Turns the model's final text into what `done` carries. */
@FunctionalInterface
public interface TurnFinisher {
    FinishedAnswer finish(String answer);
}
```

## Testing

The tests below are the explicit request the backend `AGENTS.md` asks for; approving this spec approves them.

- `OllamaClientTest` (MockRestServiceServer or a local stub): `chatWithTools` sends `tools`, `stream:true`,
  `think:false`; collects `tool_calls` split across lines; streams content deltas; `error` line → `OllamaException`;
  connection refused → `OllamaUnavailableException`; the existing `chat`/`chatStream` bodies are unchanged.
- `AgentServiceTest` (`OllamaClient` and two fake tools mocked): plain answer → `delta`… `done`; read tool → its result
  is sent back and the second answer is streamed; terminal `Navigate` and `ActionRequired` → their event, then `done`,
  **no second model call**; unknown tool and bad arguments → the error text goes back to the model; the step cap →
  the fixed sentence; Ollama down mid-stream → `error`; tools not `availableTo` the context are never offered.
- `PendingActionStoreTest`: confirm runs once under a race; another user's id, an expired id and a cancelled id are
  all `ACTION_NOT_FOUND`; the 21st action drops the oldest; the sweep removes expired entries.
- `AgentControllerTest` (MockMvc, async dispatch): NDJSON lines in order; a `system` or `tool` role, an empty list,
  a last `assistant` message and a 501-character message are JSON `CORE-VALIDATION_FAILED` envelopes, not streams;
  Ollama probe false → `ASSISTANT-AI_UNAVAILABLE` envelope; 401 without token; confirm and cancel envelopes.

## Boundaries

- Always: identity from `AgentContext`; every tool argument validated on the server; terminal outcomes end the turn;
  log names, counts and durations only.
- Ask first: Spring AI or LangChain4j; storing actions or conversations in the database; raising `max-steps`;
  changing `chat`/`chatStream`.
- Never: accept tool calls or tool results from the client; run `execute` from inside the stream; let a pending
  action be confirmed by anyone but its creator; log messages, arguments or tool results.

## Success criteria

`mvn clean verify` green. Manually, with a stub tool registered in a test profile, `curl -N` on `/stream` shows the
`tool` line before the answer deltas, and the first `delta` arrives while generation is still running.

## Phase 1 measurement (the map's open question)

`AgentToolChoiceEval`, a JUnit class kept out of the default run by its name (surefire includes only `*Test` and
`*IT`; run it with `mvn test -Dtest=AgentToolChoiceEval`), sends 20 fixed Vietnamese prompts through the real model with the three real tool
definitions (stubbed execution) and reports, per prompt, the tool chosen versus expected: 8 document questions,
5 navigation requests, 4 profile changes, 3 greetings or questions about the assistant. The result (hit rate,
median time to first token) is reported at the end of Phase 1; below 90% we revisit the prompt or the tool
descriptions before Phase 2. This needs the tool definitions from `agent-tools`, so Phase 1 adds them as
definitions only (no `run`).

## Implementation notes (as built)

- Tool-choice eval on the shipped code: 20/20 (tool and arguments). Median time to the tool decision about 1 s on this Mac;
  direct answers start streaming after about 0.2 s; a cold model adds about 8 s once.
- Time to first token, document question, warm model: the `tool` event after about 1.4 s (drives the status line), the first
  answer text after about 4 s (up to 8 s when the passages do not answer the question), `done` after about 8.5 s.
- The backend accepts 1–20 messages, so the app sends the last 9 finished turns plus the new question (19 messages), not
  the 10 turns of decision C4.
- A tried tweak to the `open_screen` description ("name screens, not codes") dropped the eval to 19/20 and was reverted.
- Hardened after the ship review (2026-10-24): acting tools withdrawn once document text is in the turn, the stream
  async timeout, `AI_ASSISTANT` enforced on the server, the turn limiter, the history and per-step caps, the blank-answer
  fallback, a stream without `done` as a failure, unknown tool names kept out of the log, and the stale check moved into
  the profile service's transaction (`SPEC-agent-tools.md`).
