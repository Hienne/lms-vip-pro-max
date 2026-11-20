# Glossary

## CHAN Academy

The product name of the internal training platform of Ban QL&PT Core Banking, shown to every user.
Formerly "Core Banking Academy". The name stands for four pillars:

- **Connect**: kết nối con người, chuyên môn và tri thức giữa các nhóm.
- **Harness**: khai thác và chuyển hóa kinh nghiệm thực tế thành tài sản tri thức.
- **Accelerate**: thúc đẩy tốc độ học tập, tiếp cận và làm chủ nghiệp vụ.
- **Nurture**: nuôi dưỡng văn hóa học tập, chia sẻ và phát triển năng lực.

The four pillars lead to excellence (xuất sắc), which the motto names: "Kết nối tri thức. Bứt phá năng lực."
(Connecting Knowledge. Accelerating Excellence.)

_Avoid_: Core Banking Academy, CHANX Academy.

## Lessons

**Video Block**:
A block of a lesson whose primary resource is one video file.
_Avoid_: video lesson, bài học video (a lesson may hold several blocks of different types)

**Transcript**:
The spoken words of one Video Block as ordered text lines, each optionally anchored to a time in the video. A Video Block has at most one Transcript; it is the only text the lesson assistant can read from a video.
_Avoid_: subtitle, phụ đề, script, caption

## Soạn cùng trợ lý

The way an author builds a new course with the assistant from one source document: the assistant reads
the document, fills the course editor one step at a time in front of the author, and waits for the author
to confirm each step before it moves to the next. The author can edit anything the assistant filled. The
assistant never writes the lessons' content; that stays the author's work. It can be started from the chat
or from the new course page.

_Avoid_: Tạo bằng AI, Soạn bằng AI (the earlier flow, in which the AI also wrote every lesson).

## Đề xuất

What the assistant fills into one step of the course editor during Soạn cùng trợ lý. A field stays an
Đề xuất, marked as such, until the author edits it or confirms the step.

## Chốt bước

The author's confirmation that a step is as they want it, after any edits of their own. It is what lets the
assistant move on to the next step. Chốt bước on the first step saves the course as a draft.

_Avoid_: duyệt (kept for publishing and reviewing content).

## Trợ lý ngoài

An AI assistant that runs outside CHAN Academy, on the user's side, and acts in CHAN Academy on behalf of
one user, with exactly that user's permissions. It may only make the Đề xuất of Soạn cùng trợ lý from a
document the user hands to it; it can never read documents, lessons or other content held in CHAN Academy.
The author still does Chốt bước in CHAN Academy.

_Avoid_: MCP, Claude (the protocol and one product that can act as a Trợ lý ngoài).

## Kết nối trợ lý ngoài

The permission a user grants so that a Trợ lý ngoài can act for them. The user creates it, can see when it
was last used, and can revoke it at any time; it stops working when they lose the role it needs.
