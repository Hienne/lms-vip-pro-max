# Default question cover

Questions use `/images/question-default.webp` when no cover is selected or the revision-scoped image
cannot be read. Article and lesson covers keep their existing default. The thumbnail appears in the
question list, My posts, saved questions and create/edit previews; question score, answer count and
resolution state remain visible. No default asset ID is written to the backend.

## Asset provenance

- Source: OpenAI built-in image generation, using the `imagegen` skill, on 2026-11-06.
- File: `apps/lms/public/images/question-default.webp`.
- Delivery: 1280 × 720 WebP, 57,248 bytes. The generated PNG was resized and encoded for web delivery.
- The people and office are synthetic and do not identify actual staff or a bank.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: default thumbnail for a Vietnamese internal banking technology academy Q&A list. Create one polished, understated editorial photograph, horizontal 16:9 composition. Two professional colleagues sitting together at a modern shared office table, collaboratively troubleshooting something on an open laptop, one pointing toward its screen while the other takes notes. Only natural hands/side profiles, no posed portrait focus. A notebook and glass of water, calm daylight, restrained neutral office materials and subtle teal details. Convey helpful peer discussion and finding an answer. Subject legible at a tiny 144px-wide thumbnail, central composition, realistic anatomy and textures, no readable text on laptop or paper, no logos, no question-mark graphics, no icons, no gradients or UI, no watermark. This must be visually distinct from an empty training desk: show the human exchange.

## Backend readiness

- `POST /api/v1/community/questions` takes `CreateContent.assets`; `usage: 'cover'` is already accepted.
- Draft updates preserve the asset collection and use the existing revision system.
- Uploads share the authenticated community upload endpoints, checked SHA-256 parts and server image processing (JPG/PNG/WebP, at most 5,000,000 bytes).
- The card projection added with article thumbnails also returns `coverRevisionAssetId` for questions, choosing the published revision before an editable draft.
- Image bytes require revision/content ACL through `GET /api/v1/community/revision-assets/{revisionAssetId}/content`.
- Existing `CommunityApiIT` now also covers question creation/publishing with a cover and its list projection. No schema migration or new endpoint is required.

## Verification

- All 62 community tests pass, including image upload, draft creation, navigation to the edit form and removal for both questions and articles, plus preserving other attachments.
- Frontend lint (existing warnings only), typecheck, production build and bundle guard pass. Changed files pass Prettier and the Git whitespace check.
- Chrome inspection covers new-question default/uploaded previews, question list, edit-question form and My posts, each at 1280 and 375px in light/dark themes. Upload and media responses are local fixtures; other production requests were read-only except authorized sign-in.
- Authenticated object URLs use a native image because Angular's optimized image directive rejects blob URLs; bundled defaults use the optimized directive. URLs are revoked on change/destruction.
- Backend test compilation remains blocked by an uncached Spring Boot 3.5.16 parent dependency; the prior online attempt timed out at Maven Central. Backend integration tests have not run. Deploy/verify the matching backend card projection before the frontend.
- The full repository check remains blocked by existing unrelated formatting failures; this task does not claim a globally green check.
