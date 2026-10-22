# Spec: `kb-chat` (backend, Phase 2)

Map: [SPEC.md](SPEC.md). Builds on [SPEC-kb-storage.md](SPEC-kb-storage.md); needs `ready` documents from
[SPEC-kb-ingestion.md](SPEC-kb-ingestion.md) to be useful.

## Objective

Any signed-in user asks a question; the backend embeds it, finds the closest chunks in the shared
knowledge base, and asks `qwen3:8b` to answer **only** from them. The answer streams back, followed by
citations built from chunk metadata. When the documents do not contain the answer, the reply is exactly
"Không tìm thấy thông tin này trong tài liệu." with no citations.

## API (`/api/v1/knowledge`, every signed-in user)

| Method | Path           | Request               | Success                                            | Refusals (HTTP 200 `ERROR`)                                                         |
| ------ | -------------- | --------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| POST   | `/chat`        | `{ "question": "…" }` | `BaseResponse<ChatAnswerView>`                     | `CORE-VALIDATION_FAILED` (1–300 chars after trim), `KNOWLEDGE-AI_UNAVAILABLE`; 401  |
| POST   | `/chat/stream` | `{ "question": "…" }` | `application/x-ndjson`, one event per line (below) | before the first line: the same envelope as `/chat` (JSON); after: an `error` event |

`/chat` is the contract of record (tests, Postman); the app uses `/chat/stream`. Both share one service.
Streams are not wrapped in `BaseResponse` (API_CONTRACT.md: file/stream keep their own protocol).

```json
{ "answer": "CIF là mã khách hàng duy nhất… [1]", "found": true, "citations": [{ "n": 1, "documentId": 42, "fileName": "Quy-trinh-EOD.pdf", "page": 3, "lineStart": 13, "lineEnd": 27, "snippet": "CIF (Customer Information File) …" }] }
```

Stream events:

```text
{"type":"retrieved","count":5}                      retrieval done, generation starting
{"type":"delta","text":"CIF là "}                   answer text, many lines
{"type":"done","found":true,"citations":[…]}         last line on success
{"type":"error","messageCode":"KNOWLEDGE-AI_UNAVAILABLE","message":"…"}   last line on failure mid-stream
```

Citations come last so they can be withdrawn when the model says it found nothing.

## Flow (`KnowledgeChatService`)

1. Validate the question (trim, 1–300 characters; matches the mockup's `maxlength`).
2. `ollama.embed([question])`; `OllamaUnavailableException` → `KNOWLEDGE-AI_UNAVAILABLE`.
3. Vector search (`DocumentChunkRepository.search`), all documents, all users:

   ```sql
   SELECT c.chunk_id, c.document_id, d.file_name, c.page_number, c.line_start, c.line_end, c.content,
          1 - (c.embedding <=> CAST(? AS vector)) AS similarity
     FROM learning_hub.knowledge_document_chunks c
     JOIN learning_hub.knowledge_documents d ON d.document_id = c.document_id
    ORDER BY c.embedding <=> CAST(? AS vector)
    LIMIT ?
   ```

   then keep rows with `similarity >= min-similarity` (0.35). Only `ready` documents have chunks.

4. **No row left → not found** without calling the chat model: answer = the fixed sentence,
   `found=false`, `citations=[]`.
5. Prompt (system message, Vietnamese):

   ```text
   Bạn là trợ lý tra cứu tài liệu nội bộ của Ban QL&PT Core Banking.
   Chỉ dùng các đoạn trong phần NGỮ CẢNH dưới đây để trả lời. Không dùng kiến thức bên ngoài.
   Nếu NGỮ CẢNH không có câu trả lời, chỉ trả lời đúng một câu:
   "Không tìm thấy thông tin này trong tài liệu."
   Sau mỗi ý, ghi số đoạn nguồn trong ngoặc vuông, ví dụ [1] hoặc [2][3].
   Trả lời bằng tiếng Việt, ngắn gọn, đúng thuật ngữ trong tài liệu.
   ```

   User message: `NGỮ CẢNH:` then each chunk as `[n] (<file>, trang p, dòng a–b)\n<content>`, then
   `CÂU HỎI: <question>`. Options: `think:false`, `temperature 0.1`, `num_ctx 8192`.

6. Answer: if the trimmed answer starts with "Không tìm thấy thông tin này trong tài liệu" →
   `found=false`, `citations=[]`; else `found=true` and the citations are **all retrieved chunks** in rank
   order, numbered `n` = their `[n]` in the prompt, with `snippet` = the first 280 characters of the chunk
   content on a word boundary. Citations are never parsed from the model's text.
7. Stream: steps 1–4 run on the request thread (so refusals are envelopes); generation runs inside a
   `StreamingResponseBody`, writing and flushing one JSON line per Ollama delta. The response sets
   `Cache-Control: no-store` (already global) and `X-Accel-Buffering: no`.

## Project structure

```text
knowledge/
├── controller/  KnowledgeChatController
├── service/     KnowledgeChatService, ChatPromptBuilder, NotFoundAnswer (the fixed sentence + check)
├── repository/  DocumentChunkRepository.search(float[] query, int limit)
└── dto/         ChatRequest, ChatAnswerView, CitationView, ChatStreamEvent (sealed records)
docs/api/KNOWLEDGE.md (chat section), docs/postman (chat requests)
```

## Code style

```java
public sealed interface ChatStreamEvent {
    record Retrieved(String type, int count) implements ChatStreamEvent { }
    record Delta(String type, String text) implements ChatStreamEvent { }
    record Done(String type, boolean found, List<CitationView> citations) implements ChatStreamEvent { }
    record Error(String type, String messageCode, String message) implements ChatStreamEvent { }
}
```

## Testing

- `DocumentChunkSearchIT` (Testcontainers): insert chunks with hand-made unit vectors; the query returns
  them in cosine order with the right similarity, respects `LIMIT`, and joins `file_name`.
- `KnowledgeChatServiceTest` (`OllamaClient` mocked): nothing above the threshold → not-found answer and
  `chat` is **never called**; the model answers the not-found sentence → `found=false`, no citations; a
  normal answer → citations equal the retrieved chunks with page and lines; the prompt contains only the
  retrieved chunks; Ollama down → `KNOWLEDGE-AI_UNAVAILABLE`.
- `KnowledgeChatControllerTest` (MockMvc, async dispatch): NDJSON lines in order `retrieved`, `delta`…,
  `done`; validation refusal returns a JSON envelope, not a stream; 401 without token.

## Boundaries

- Always: answer only from retrieved chunks; citations from metadata.
- Ask first: multi-turn memory, re-ranking, a cloud model, a different not-found sentence.
- Never: send document text or questions to anything but the local Ollama; log question or answer text.

## Success criteria

Tests green in `mvn clean verify`; manually, with real documents, an in-document question cites the right
file and lines, an out-of-document question returns the fixed sentence, and the first `delta` arrives
while generation is still running (measured in Phase 2, reported with the time to first token).
