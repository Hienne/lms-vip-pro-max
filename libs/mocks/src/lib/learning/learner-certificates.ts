import {
  CertificatesQuerySchema,
  type Certificate,
  type Page,
} from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import type {
  EnrollmentRecord,
  LearnerEnrollments,
} from './learner-enrollments';
import { refuse } from './learning-reply';

const numeric = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

/**
 * The learner's certificates in memory. A certificate is a completed cycle of the caller's
 * enrolments, nothing more: the mock reads the enrolments the learning seed builds, the way the
 * backend reads `course_enrollments`. The list is newest completion first (then the highest id), and
 * an id that is another learner's, is not completed or does not exist answers "not found". The
 * score is the enrolment's fixed best score; the name is the person's current name.
 */
export class LearnerCertificates {
  constructor(
    private readonly enrollments: LearnerEnrollments,
    private readonly callerId: (request: FakeRequest) => string,
    private readonly nameOf: (userId: string) => string | undefined,
  ) {}

  /** `GET /certificates` */
  certificates(request: FakeRequest): Page<Certificate> {
    const userId = this.callerId(request);
    const parsed = CertificatesQuerySchema.safeParse({
      page: numeric(request.query['page']),
      size: numeric(request.query['size']),
    });
    if (!parsed.success) return refuse('validationFailed');
    const { page = 0, size = 20 } = parsed.data;

    const rows = this.enrollments
      .all()
      .filter((record) => this.isCertificate(record, userId))
      .sort(
        (a, b) =>
          (b.enrollment.completedAt ?? '').localeCompare(
            a.enrollment.completedAt ?? '',
          ) || b.enrollment.id - a.enrollment.id,
      );
    return {
      items: rows.slice(page * size, page * size + size).map(this.view),
      page,
      size,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
    };
  }

  /** `GET /certificates/{enrollmentId}` */
  certificate(request: FakeRequest): Certificate {
    const userId = this.callerId(request);
    const id = numeric(request.params['enrollmentId']);
    const record = id === undefined ? undefined : this.enrollments.byId(id);
    if (!record || !this.isCertificate(record, userId)) {
      return refuse('learningNotFound');
    }
    return this.view(record);
  }

  /** Only a completed cycle with its date, and only the caller's own. */
  private isCertificate(record: EnrollmentRecord, userId: string): boolean {
    const { enrollment } = record;
    return (
      enrollment.userId === userId &&
      enrollment.status === 'completed' &&
      enrollment.completedAt != null
    );
  }

  private readonly view = (record: EnrollmentRecord): Certificate => {
    const { enrollment, content } = record;
    const cycleNo = enrollment.cycleNo ?? 1;
    return {
      id: enrollment.id,
      courseId: enrollment.courseId,
      courseCode: content.course.code,
      courseTitle: content.revision.title ?? null,
      cycleNo,
      revisionId: enrollment.revisionId,
      userId: enrollment.userId,
      fullName: this.nameOf(enrollment.userId) ?? enrollment.userId,
      completedAt: enrollment.completedAt as string,
      bestScorePercent: record.bestScorePercent,
      verificationCode:
        `CBA-${content.course.code}-${enrollment.userId}-${cycleNo}`.toUpperCase(),
    };
  };
}
