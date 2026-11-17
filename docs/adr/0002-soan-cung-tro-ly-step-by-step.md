# 0002. The assistant drafts a course one confirmed step at a time and never writes lesson content

Date: 2026-11-17 · Status: accepted

## Context

The first AI course flow ("Tạo bằng AI") ran one background job per course: summarise the source
document, write an outline, wait for its approval, then write every lesson and its questions. The
author had to switch it on, fill step 1 by hand, and then mostly watched. Authors found it opaque,
and lesson content written by the model needed a full rewrite to be trusted.

## Decision

Replace it with **Soạn cùng trợ lý** (see `GLOSSARY.md`). The assistant reads the document, fills
the course editor one step at a time in front of the author (step 1 basic info, step 2 chapter and
lesson titles with a one-line description each, step 3 completion rules, bonus points and a draft
question set, step 4 the suggested audience and the pre-publish check), and waits for the author to
**Chốt bước** before moving on. Chốt bước on step 1 saves the draft. The assistant never writes
lesson content, and never publishes, assigns or shares a course. It can be started from the chat or
from the new course page; both run the same flow, on the server, so closing the chat does not stop it.

## Considered options

- Keep the background job and only prefill step 1 from the document: still writes lessons, still opaque.
- Run both flows side by side: two ways to do one thing, with different rules about lesson content.

## Consequences

- No new jobs of the old kind are started. Running ones finish, and their review screen stays
  readable; the old pipeline's code is removed in a later change.
- Lessons stay empty after the flow, so publishing is still blocked until the author writes them.
  The assistant reminds the author at step 4.
- Proposed questions and outline count as AI content: publishing still asks the author to confirm
  they reviewed it.
- The source document is kept as a private document tied to the draft, so a step can be proposed
  again (Đề xuất lại) later.
