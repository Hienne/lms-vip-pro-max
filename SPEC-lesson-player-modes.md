# Spec: `lesson-player-modes`

Map: [SPEC.md](SPEC.md). Status: **approved 2026-11-03, amended by `tasks/plan.md`.** Depends on `local-stack`, which provides a READY
video block. It can be built at any point after that.

## Objective

Three player features from the mockup `lesson.js`:

1. **Chế độ tập trung.** A toggle in the lesson's top bar hides the side panel (Mục lục / Ghi chú) and widens the
   content.
   - The control is labelled "Chế độ tập trung" when off and "Hiện mục lục" when on, with `aria-pressed`.
   - The choice is kept per browser as a convenience (it is not server state).
   - On narrow screens the side panel is already a drawer, so the toggle is hidden there.
2. **Mốc video (chapters).** Under a video block there is a row of chapter buttons: "{mm:ss} {title}". A click
   seeks the video. The chapter being played is marked as current (`aria-current`).
3. **Transcript.** A collapsible "Transcript ({n} đoạn)" under the video.
   - Each line shows "{mm:ss}" and the text. Clicking a line seeks the video.
   - The line being played is highlighted, without auto-scrolling the page.
   - A search box filters the lines.

Focus mode needs nothing from the backend. Chapters and transcript need data that lesson video blocks do not
have. Today the only transcripts are `community_media_transcripts`, for community recordings.

## Backend (`corebanking-academy`, module `learning`)

The mockup keeps both lists on the video block (`b.data.chapters`, `b.data.transcript`). The backend does the
same:

| #   | Where                                            | Change                                                                                                                                                                                                                      |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `LearningRequests.BlockInput` (course tree save) | **changed, additive**: `videoChapters: List<{ startSeconds, title }>?` and `transcript: List<{ startSeconds, text }>?`. Both are accepted only for `blockType = video`; otherwise the response is `LEARNING-BLOCK_INVALID`. |
| P2  | `LearningViews.LessonBlockView`                  | **changed, additive**: `videoChapters`, `transcript` (empty lists when not set)                                                                                                                                             |

**Validation (service, at save):**

- At most 50 chapters. Each title is 1–120 characters.
- At most 2000 transcript lines. Each line is 1–1000 characters.
- `startSeconds` is a number ≥ 0, strictly increasing in each list, and at most the asset's `duration_seconds`
  when the asset is READY.

Revisions copy both lists like any other block field (`source_block_id`). Learners read them through the
existing enrollment detail and the `LearnerCourse` (D4). There is no new endpoint.

### DB upgrade `docs/sql/upgrade/2026-11-xx-lesson-player-modes.sql`

```sql
BEGIN;
ALTER TABLE learning_hub.lesson_blocks ADD COLUMN IF NOT EXISTS video_chapters jsonb;
ALTER TABLE learning_hub.lesson_blocks ADD COLUMN IF NOT EXISTS transcript jsonb;
COMMENT ON COLUMN learning_hub.lesson_blocks.video_chapters IS
    'Mốc video [{startSeconds, title}] tăng dần; chỉ dùng cho block video; NULL khi chưa có.';
COMMENT ON COLUMN learning_hub.lesson_blocks.transcript IS
    'Transcript [{startSeconds, text}] tăng dần; chỉ dùng cho block video; NULL khi chưa có.';
COMMIT;
```

- **Rollback.** Drops the two columns.
- **Entity mapping.** `LessonBlock` maps both columns as `JsonNode`, as `MediaTranscript.segmentsJson` already
  does.
- **Baseline.** The learning baseline gets the columns.
- **Demo data.** The `local-stack` demo course's video block gets chapters and a short transcript through the
  course API, in the `--seed-media` step.

Docs: `docs/api/LEARNING.md` gets the block fields and limits.

## App

| Where                                  | Change                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/contracts/src/lib/learning`      | `LessonBlockSchema` gains `videoChapters` and `transcript`, both defaulting to `[]`                                                                                                                |
| `video-block`                          | It renders the chapter row and the transcript, and emits the current time. Both seek through the block's player API. The current chapter or line is computed from the time and the server's lists. |
| `features/lesson/lesson`               | The focus toggle in the top bar. The layout class hides the side column. A remembered preference is read and written in a `try/catch` (`localStorage` may throw).                                  |
| `features/admin-content/course-editor` | Optional, see open question 1.                                                                                                                                                                     |
| Mock                                   | The seeded video blocks carry chapters and transcript, as in the mockup data.                                                                                                                      |

## Testing

- **Backend:**
  - Save with valid lists.
  - Each validation error: count, length, order, beyond duration, non-video block.
  - A revision copy keeps the lists.
  - Read through the enrollment detail.
- **App:**
  - `video-block` spec: a chapter click seeks; the current chapter follows the time; the transcript search
    filters; a transcript line click seeks.
  - Lesson spec: the focus toggle hides the side panel and sets `aria-pressed`.
- **Local, as `hocvien`:** on the demo video, chapters and transcript show, and seeking works from both. Focus mode
  hides the outline and survives a reload.

## Boundaries

- **Never:**
  - generate transcripts in the app;
  - call the community transcript worker for lesson videos (it is out of scope).

## Success criteria

1. The demo video on the local stack shows its chapters and transcript from the backend response. A click on
   either seeks the video to the right time.
2. Saving a block with an invalid list is refused with the server's message.
3. Focus mode hides the side panel on wide screens, with the right label and `aria-pressed`. The layout has no
   horizontal scroll.
4. The upgrade script and its rollback apply cleanly. `mvn clean test` and `npm run check` green.

## Open questions

1. **Authoring:** should the course editor get a simple chapters and transcript editor (one textarea each,
   "mm:ss tiêu đề" per line)? Default: no; the data is entered through the API or demo SQL (map decision 5).
2. **Speech-to-text:** should lesson videos reuse the community speech-to-text worker later? This only needs an
   answer before anyone builds it. Nothing here blocks it.
