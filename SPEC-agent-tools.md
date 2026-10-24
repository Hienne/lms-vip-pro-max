# Spec: `agent-tools` (backend, Phase 2)

Map: [SPEC.md](SPEC.md). Implements `AgentTool` from [SPEC-agent-runtime.md](SPEC-agent-runtime.md); reuses
retrieval and citations from [SPEC-kb-chat.md](SPEC-kb-chat.md) and the profile update behind `PATCH /auth/me`.

## Objective

Three tools the model can call: search the shared documents, open one of the user's own screens, and propose a
change to the user's own profile. Each validates the model's arguments itself, reads identity only from
`AgentContext`, and enforces the same rules as the screen or endpoint it stands in for. Only `update_profile`
changes data, and only through a confirmed action.

| Tool               | Kind                   | Offered to                                       | Outcome                      |
| ------------------ | ---------------------- | ------------------------------------------------ | ---------------------------- |
| `search_documents` | read                   | everyone                                         | `Result` (+ a turn finisher) |
| `open_screen`      | read, terminal         | users with at least one openable screen          | `Navigate`                   |
| `update_profile`   | changes data, terminal | `LOCAL` accounts with no pending password change | `ActionRequired`             |

## `search_documents`

Definition sent to the model:

```json
{
  "name": "search_documents",
  "description": "Tìm trong kho tài liệu nội bộ dùng chung (quy trình, nghiệp vụ, thuật ngữ Core Banking). Dùng cho mọi câu hỏi cần thông tin từ tài liệu. Kết quả là các đoạn đánh số [n]; chỉ trả lời từ các đoạn đó và ghi [n] sau mỗi ý.",
  "parameters": {
    "type": "object",
    "properties": { "query": { "type": "string", "description": "Câu hỏi hoặc từ khoá cần tìm, tiếng Việt, tối đa 300 ký tự." } },
    "required": ["query"]
  }
}
```

Run:

1. `query` missing or not 1–300 characters after trim → `Result("Câu tìm kiếm phải từ 1 đến 300 ký tự.")`.
2. `KnowledgeChatService.retrieve(query)` (embedding, top-k, threshold, duplicate removal: unchanged). Its
   `KNOWLEDGE-AI_UNAVAILABLE` refusal is rethrown as `OllamaUnavailableException`, so the runtime ends the stream
   with `ASSISTANT-AI_UNAVAILABLE`.
3. Number the hits **continuing across calls in the same turn**: a chunk already retrieved this turn keeps its
   number and is not repeated; new chunks take the next numbers. The turn keeps them in order.
4. Result text: each new chunk in the `kb-chat` format `[n] (<file>, trang p, dòng a–b)\n<content>`, then
   `Chỉ trả lời từ các đoạn trên, ghi [n] sau mỗi ý. Nếu các đoạn không có câu trả lời, trả lời đúng một câu:
"Không tìm thấy thông tin này trong tài liệu."`. No new hit and none earlier →
   `Không có đoạn tài liệu nào liên quan. Trả lời đúng một câu: "Không tìm thấy thông tin này trong tài liệu."`
5. Register the turn finisher (once per turn):
   - no chunk retrieved in the whole turn → answer = the fixed sentence, no citations (whatever the model wrote;
     `kb-chat` never asks the model in that case either);
   - `NotFoundAnswer.isNotFound(answer)` → the fixed sentence, no citations;
   - otherwise the citations are the turn's chunks the answer marks with `[n]`, in number order, each once;
     markers outside the turn's range are ignored; no usable marker → every chunk of the turn. Citation file,
     page, lines and snippet come from chunk metadata only.

Shared with `kb-chat` by extraction, with no behaviour change to `/knowledge/chat`:
`ChatPromptBuilder.formatChunk(int n, ChunkHit hit)` and a public `CitationSelector.select(String answer,
List<ChunkHit> numberedHits)` taken out of `KnowledgeChatService.conclude`. `KnowledgeChatServiceTest` stays green
unchanged.

## `open_screen`

Definition, built per request from `AgentContext.rights().functions()`:

```json
{
  "name": "open_screen",
  "description": "Mở một màn hình của hệ thống cho người dùng. Chỉ dùng các mã sau: USER_MANAGEMENT (Quản lý người dùng), ORGANIZATION_MANAGEMENT (Tổ chức), …",
  "parameters": {
    "type": "object",
    "properties": { "functionCode": { "type": "string", "enum": ["USER_MANAGEMENT", "ORGANIZATION_MANAGEMENT", "…"] } },
    "required": ["functionCode"]
  }
}
```

- Openable screens: the user's granted functions whose `routePattern` is set and has no `:` parameter, in `sortNo`
  order. None → the tool is not offered.
- Run: `functionCode` must be one of them (Ollama does not enforce `enum`). Otherwise →
  `Result("Bạn không có quyền mở màn hình này hoặc màn hình không tồn tại.")`, so the model says so; nothing
  navigates.
- Valid → `Navigate(routePattern, name, "Đã mở trang " + name + ".")`. The server decides the path; the app checks it
  against the user's menu before navigating, and the route guards still apply.

## `update_profile`

Definition:

```json
{
  "name": "update_profile",
  "description": "Đề xuất sửa hồ sơ của chính người dùng: họ tên, email, chức danh. Chỉ gửi trường người dùng muốn đổi. Thay đổi chỉ có hiệu lực sau khi người dùng bấm xác nhận.",
  "parameters": {
    "type": "object",
    "properties": {
      "fullName": { "type": "string", "description": "Họ tên mới" },
      "email": { "type": "string", "description": "Email mới; chuỗi rỗng để xoá email" },
      "positionName": { "type": "string", "description": "Chức danh mới; chuỗi rỗng để xoá" }
    }
  }
}
```

- Offered only when the context's profile is `LOCAL` and `mustChangePassword` is false (an SSO account's fields
  belong to the identity provider, as on the profile page).
- Run, all checks before any card exists:
  - unknown properties are ignored; no known property → `Result("Bạn muốn đổi trường nào: họ tên, email hay chức danh?")`;
  - `fullName`: trimmed, 1–255; `email`: trimmed, empty → clear (null), otherwise a valid address ≤ 100;
    `positionName`: trimmed, empty → clear, otherwise ≤ 255 (the `ProfileUpdateRequest` rules). A failure →
    `Result` with the field's Vietnamese message, so the model asks again;
  - fields whose new value equals the current one are dropped; none left →
    `Result("Hồ sơ đã có đúng giá trị này, không cần thay đổi.")`.
- Valid → store a `PendingAction` with the changes and return
  `ActionRequired(action, "Vui lòng kiểm tra và xác nhận thay đổi bên dưới.")`. The preview lists each change as
  `{ field, label, from, to }` with labels "Họ tên", "Email", "Chức danh" and `null` shown by the app as "(trống)".
- `execute` (on confirm, request thread, the user's own security context):
  1. Reload the profile; if any change's `from` differs from the current value → `ASSISTANT-ACTION_STALE`.
  2. Build a `ProfileUpdateRequest` through its setters with only the changed fields and call
     `SelfProfileService.update` (its checks, write lock and `USER_PROFILE_UPDATED` audit apply unchanged).
  3. Return `ActionResultView(actionId, "update_profile", "Đã cập nhật hồ sơ.", authService.me())`.
     Refusals from the service (validation, SSO, password change pending) pass through as their own envelopes.

## Project structure

```text
src/main/java/vn/com/coreacademy/assistant/tool/
├── SearchDocumentsTool.java     (+ RetrievedChunks: the turn's numbered hits and the finisher)
├── OpenScreenTool.java
└── UpdateProfileTool.java       (+ ProfileChange record)
src/main/java/vn/com/coreacademy/knowledge/service/
├── CitationSelector.java        (extracted, public)
└── ChatPromptBuilder.java       (formatChunk made public static)
docs/api/ASSISTANT.md (tools section), docs/postman (a navigation turn, a profile turn, confirm, cancel)
```

## Code style

```java
@Component
@RequiredArgsConstructor
class OpenScreenTool implements AgentTool {
    @Override
    public ToolOutcome run(JsonNode arguments, AgentContext context, TurnState turn) {
        String code = ToolArguments.text(arguments, "functionCode");
        return openable(context).stream()
            .filter(function -> function.code().equals(code))
            .findFirst()
            .<ToolOutcome>map(function -> new ToolOutcome.Navigate(function.routePattern(), function.name(),
                "Đã mở trang " + function.name() + "."))
            .orElseGet(() -> new ToolOutcome.Result(NOT_ALLOWED));
    }
}
```

## Testing

As in `agent-runtime`, approving this spec is the explicit request for these tests.

- `SearchDocumentsToolTest` (`KnowledgeChatService.retrieve` mocked): numbering continues across two calls and a
  repeated chunk keeps its number; the finisher's three rules (nothing retrieved → fixed sentence even if the
  model wrote something else; not-found answer → no citations; marked chunks only, no marker → all); out-of-range
  markers ignored; an over-long query is a `Result`, not an exception; AI unavailable → `OllamaUnavailableException`.
- `OpenScreenToolTest`: the enum and description list only the user's static routes; a code from another role and an
  invented code → the refusal `Result`, no `Navigate`; a user with no openable screen is not offered the tool.
- `UpdateProfileToolTest`: SSO and must-change-password users are not offered it; each validation failure is a
  `Result`; unchanged fields are dropped; `ActionRequired` preview has labels and old values; `execute` calls
  `SelfProfileService.update` with only the changed fields; a profile changed since the proposal →
  `ACTION_STALE` and no update.
- `AgentProfileFlowIT` (Testcontainers, the seeded demo users, `OllamaClient` mocked to call `update_profile`):
  stream → `action_required`; confirm by another user → `ACTION_NOT_FOUND`; confirm by the owner → the row and the
  audit log change once; a second confirm → `ACTION_NOT_FOUND`.
- `KnowledgeChatServiceTest` and `KnowledgeChatControllerTest` unchanged and green.

## Boundaries

- Always: identity and rights from `AgentContext`; the same validation as the endpoint the tool stands in for; data
  changes only through `SelfProfileService`.
- Ask first: any new tool (course creation and assignment are the next map); letting `update_profile` touch org,
  team, role or password; changing `kb-chat` output.
- Never: navigate to a path the model wrote; change another user's profile; trust the model's `from` values (the
  server reads them); log profile values or queries.

## Success criteria

`mvn clean verify` green. Manually on the local backend: `hocvien` asking for "quản lý người dùng" gets a refusal and
no `navigate`; `quantri` gets `navigate` to `/admin/users`; a profile change shows `action_required`, the row is
unchanged until confirm, and changed once after it.

## Implementation notes (as built)

- `search_documents` asks the model to answer with the exact not-found sentence when the passages do not answer the
  question. `qwen3:8b` follows it for some questions and paraphrases for others ("… không được đề cập trong tài liệu"). A
  paraphrase carries no `[n]` marker, so the `kb-chat` rule (no usable marker returns every retrieved chunk) attaches
  sources to it. Checked on the local backend: of four out-of-document questions, one got the exact sentence with no sources.
  Making a paraphrased not-found carry no sources would change that `kb-chat` rule, which this map does not touch (ask first);
  it is left as a follow-up.
- A refusal from `open_screen` (a screen the role does not grant) goes back to the model as text, and the model sometimes
  repeats the function codes it was given ("PROFILE, COURSE_LEARNING, …") instead of screen names. Nothing navigates and the
  refusal is clear, but the wording is rough; a description sentence against it cost one eval case and was reverted.
- Verified on the local backend: `quantri` + "mở trang quản lý người dùng" navigates to `/admin/users`; `hocvien` is refused;
  "Đổi chức danh … thành Chuyên viên" shows the card, "Huỷ" changes nothing, "Xác nhận" updates the profile page.
