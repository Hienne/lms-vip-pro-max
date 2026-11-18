# 0004. A Trợ lý ngoài drafts courses through a narrow MCP endpoint and never reads CHAN Academy content

Date: 2026-11-18 · Status: accepted

## Context

Soạn cùng trợ lý (ADR 0002) runs its proposals on the in-house model (qwen3:8b). Its proposals are slow
and often off, and authors who already use a stronger assistant such as Claude want that assistant to do
the drafting. Sending CHAN Academy content to an outside model is a compliance question for the bank, and
the backend has no OAuth server or personal tokens today, only its own sign-in JWT.

## Decision

Let a **Trợ lý ngoài** (see `GLOSSARY.md`) act for one user through an MCP endpoint in the backend
(Spring AI MCP Server, Streamable HTTP, stateless), behind a configuration flag that is off by default.

- **Reach:** v1 supports Claude Code on the user's machine inside the internal network. The endpoint is not
  exposed to the internet, so claude.ai connectors (which call from Anthropic's servers) are out of scope.
- **Permission:** a **Kết nối trợ lý ngoài**, created from the page header by the roles that may use Soạn
  cùng trợ lý. Its token is shown once, stored hashed, expires after 30 or 90 days, can be revoked, only
  works on the MCP endpoint, and stops working when the user loses the role.
- **Tools:** exactly five: start a drafting session, read reference data (categories, units, audiences),
  read the user's own drafting session, propose one step, stop the session. No tool reads documents, the
  knowledge base, lessons, other courses or the community, so the outside model only sees the document the
  user hands to it. The backend never receives that file.
- **Flow:** the Trợ lý ngoài takes the place of the in-house model as the one that makes the Đề xuất. The
  in-house worker never runs for such a session, and no chat messages are posted for it. A step accepts one
  proposal while it waits for one; only the author's "Đề xuất lại" on the page reopens it. Chốt bước stays
  the author's, on the page, and every rule of ADR 0002 holds: no lesson content, no publishing, assigning
  or sharing.
- **Limits and trail:** 60 calls a minute per connection, 256 KB per payload, 3 open sessions per user;
  every call is audited without the document's content.

## Considered options

- A public endpoint with OAuth 2.1 for claude.ai connectors: needs internet exposure and an authorisation
  server before the data question is settled. Left for later.
- Letting the Trợ lý ngoài call the course API directly: skips the live page and the per-step Chốt bước.
- A tool that waits for Chốt bước: costs tokens and hits tool time-outs; the author tells the assistant to
  go on instead.

## Consequences

- Using it in production waits on the bank's approval for sending documents to an outside model.
- The in-house chat flow stays for users without a Trợ lý ngoài.
