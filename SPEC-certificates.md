# Spec: `certificates`

Map: [SPEC.md](SPEC.md). Status: **draft, waiting for approval.** Depends on `learner-scores` (the score on the
certificate) and, through it, `learner-quiz`.

## Objective

The mockup (`tools.js` pages `certificates` and `certificate`, `api/learner.js` `certificates`) describes three
screens:

- **"Chứng nhận hoàn thành".** One card per completed course, with title, code, completion date, best score and
  "Đã cấp".
- **One certificate.** Breadcrumb Chứng nhận › {course}. It shows the learner's full name, the course title and
  code, the completion date, the score, and a verification code. It has a primary "In / Lưu PDF".
- **On a completed course,** the course page shows "Xem chứng nhận".

The page copy says certificates are issued automatically on completion, so no one issues them by hand. The app
has both screens on mock paths (`/api/me/certificates…`, including a `download` endpoint). The backend has
nothing.

## Decision: no table

A certificate is a **completed enrollment cycle**: `course_enrollments` with `status = completed` and
`completed_at` set. That row already gives:

- a stable id;
- the date;
- the cycle number;
- the course revision the learner finished.

A certificate stays valid when the course changes later, because it points at the revision. Map decision 2 rules
out a PDF library, and the mockup's verification code is derived (`CBA-{code}-{staffCode}`). So there is nothing
to store. A table would be needed only for revocation or numbered serials, which nobody asked for.

## Backend (`corebanking-academy`, module `learning`)

| #   | Endpoint                                              | Response                                                                                                |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C1  | `GET /api/v1/me/learning/certificates`                | `Page<CertificateView>`, newest completion first; `page`, `size`                                        |
| C2  | `GET /api/v1/me/learning/certificates/{enrollmentId}` | `CertificateView`. A cycle that is not the caller's or not completed → `LEARNING-CERTIFICATE_NOT_FOUND` |
| C3  | `CourseCard`, `LearnerCourse`                         | **changed, additive**: `certificateId` (the enrollment id when this cycle is completed, else null)      |

```java
public record CertificateView(Long id,               // enrollment id
                              Long courseId, String courseCode, String courseTitle,
                              Integer cycleNo, Long revisionId,
                              String fullName, String userId, String orgName,
                              Instant completedAt,
                              BigDecimal bestScorePercent,   // from learner-scores; null when the course has no quiz
                              String verificationCode) {
}
```

**Fields:**

- `courseTitle` is the title of the revision the learner completed.
- `verificationCode` is `CBA-{courseCode}-{userId}-{cycleNo}` in upper case. Adding `cycleNo` keeps two cycles of
  the same course distinct; the mockup has no cycles.
- `fullName` and `orgName` are read through the Identity public adapter.

A public verification endpoint (look up a code without signing in) is **not** part of this module; see open
question 1. Neither is a download endpoint. The mock `download` key is removed from the contracts.

No schema change.

Docs: a "Chứng nhận" section in `docs/api/LEARNING.md`.

## App

| Where                                | Change                                                                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/contracts/src/lib/personal`    | `certificates` → C1 (paged), `certificate` → C2, numeric ids; `download` deleted; `served: 'mock'` removed. `CertificateSchema` follows `CertificateView`. `CourseCardSchema` gains `certificateId`.                                                                  |
| `features/achievements/certificates` | The list uses C1. The empty state reads "Chưa có chứng nhận" with one line pointing to the catalog. The detail uses C2, laid out as a certificate.                                                                                                                    |
| print                                | "In / Lưu PDF" calls `window.print()`. A print stylesheet (in the component's SCSS, using `@media print`) hides the shell, the breadcrumb and the button, and sets the page to A4 landscape with token-based type. The browser's own "Save as PDF" produces the file. |
| course page                          | When `certificateId` is set: "Xem chứng nhận" → `/certificate/{certificateId}`, next to the course's main action.                                                                                                                                                     |
| Mock                                 | `libs/mocks/src/lib/personal` serves C1 and C2 from completed seed enrollments.                                                                                                                                                                                       |

## Testing

- **Backend:**
  - Only completed cycles of the caller are returned.
  - Another learner's id → not found.
  - The score equals `learner-scores`' best for the course.
  - The title is the completed revision's, after a later revision is published.
- **App:**
  - List and empty state.
  - The detail renders every field.
  - The print button calls `window.print`.
  - The course page shows "Xem chứng nhận" only with `certificateId`.
- **Local, as `hocvien`:**
  - Complete a demo course: required lessons, and the quiz lesson from `learner-quiz`.
  - Its certificate appears with the right date and score.
  - Print preview shows only the certificate on one A4 landscape page.

## Boundaries

- **Ask first:** server-side PDF generation, or any new dependency.
- **Never:** compute completion in the app; show a certificate for a cycle the server does not return.

## Success criteria

1. After `hocvien` completes a demo course on the local stack, its certificate is listed, opens, and shows the
   server's name, course, date, score and code.
2. "Xem chứng nhận" appears on that course page and nowhere else.
3. The print preview (checked in the browser) has no shell chrome and fits one A4 landscape page.
4. `mvn clean test` and `npm run check` green. The visual-design checklist passes for both screens.

## Open questions

1. **Public verification:** should anyone be able to check a code without signing in (`/verify/{code}`)? That is
   a public endpoint and needs a security decision. Default: not in this initiative.
2. **Certificate image:** should the certificate show the Ban's seal or a signature image? Default: no image,
   because there is no approved asset.
