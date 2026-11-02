import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../http/page';

/**
 * A certificate is a completed cycle of the caller's course (`course_enrollments`), so `id` is the
 * enrollment id. `courseTitle` is the title of the revision the learner finished and is null when
 * that revision has none (show the code then). `bestScorePercent` is the course card's value, the
 * best score of the final exam, null without one. `verificationCode` is
 * `CBA-{courseCode}-{userId}-{cycleNo}` in upper case.
 */
export const CertificateSchema = z.object({
  id: z.number().int(),
  courseId: z.number().int(),
  courseCode: z.string(),
  courseTitle: z.string().nullable(),
  cycleNo: z.number().int(),
  revisionId: z.number().int(),
  userId: z.string(),
  fullName: z.string(),
  completedAt: z.iso.datetime({ offset: true }),
  bestScorePercent: z.number().min(0).max(100).nullable(),
  verificationCode: z.string(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

/** Newest completion first; the server fixes the order. */
export const CertificatesQuerySchema = z.object({
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});
export type CertificatesQuery = z.infer<typeof CertificatesQuerySchema>;
