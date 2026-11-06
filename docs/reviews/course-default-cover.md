# Default course cover

Courses without an uploaded thumbnail use `/images/course-default.webp` from the frontend bundle. This applies to the shared course card, including the learner dashboard, catalogue and editor preview. Removing a custom cover restores the default. The existing neutral loading slot remains while an uploaded cover is fetched. A failed cover fetch falls back through the existing card adapter.

The default is presentation only: no asset is uploaded, no fake `coverAssetId` is saved and existing courses need no data migration. Custom cover uploads and their authorization are unchanged.

The image is a real raster asset rather than a tinted icon placeholder, deliberately replacing the former text-only card when no cover was supplied, as requested by the product owner. It uses an empty alt because the adjacent course title already names the card. The bundled image is lazy loaded with intrinsic dimensions to reserve its 16:9 space.

## Asset provenance

- Source: OpenAI built-in image generation tool, using the `imagegen` skill; generated for this project on 2026-11-06.
- File: `apps/lms/public/images/course-default.webp`.
- Delivery: 1280 × 720 WebP, approximately 81 KB. The generated PNG was resized and encoded for web delivery; no runtime image service or dependency was added.
- The generic scene does not depict a real office or identify any bank.

## Verification

- 146 tests pass across CourseCard, Learn, Catalog and CourseEditor, including selecting/uploading a custom image, removing it and falling back after a refused cover fetch.
- LMS lint, typecheck, production/staging builds and both bundle guards pass. Prettier and the Git whitespace check pass on the changed files.
- The built web app was inspected in Chrome: desktop at 1440px, plus the required 1280px and 375px layout checks, in light and dark. The default decodes at 1280 × 720, the custom cover still loads, the new-course preview uses the default, and no page errors or horizontal overflow were observed after layout settled. Production data was only read; no course was created.
- Angular section 14: no new writable component state, effects, forms, HTTP calls or business rules. The static source is presentation only. Existing loading, failure, empty and upload states remain intact.
- The full workspace check remains affected by the previously observed four TargetPicker spec failures and formatting issues in unrelated files. This change does not claim to resolve those failures.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: default 16:9 course thumbnail for an internal Core Banking Academy learning platform, used when a course author has not uploaded a cover. Create a refined editorial photograph: a quiet contemporary corporate learning workspace in a financial technology office, an open notebook and closed slim laptop in the foreground, modern glass architecture and a softly blurred server/technology area in the background. Balanced horizontal crop, clear readable composition even at 300px wide, professional understated premium banking atmosphere. Restrained deep teal, warm neutral gray, natural daylight, realistic materials. No people, no text or letters, no logos or brand marks, no watermark, no UI, no charts, no prominent glowing effects. Image fills the entire frame; no borders or rounded corners. Wide landscape composition 16:9.
