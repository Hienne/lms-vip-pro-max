import { capturedCertificates as captured } from './certificate.captured';
import { certificateEndpoints as e } from './certificate.endpoints';
import { CertificatesQuerySchema } from './certificate.schema';
import { CourseCardSchema } from '../course/course.schema';
import { EnvelopeSchema } from '../http/envelope';

describe('certificateEndpoints', () => {
  it('lives on the backend, not on the mock', () => {
    for (const endpoint of Object.values(e)) {
      expect(endpoint.served).toBeUndefined();
      expect(endpoint.path).toMatch(/^\/api\/v1\/me\/learning\/certificates/);
    }
  });

  it.each([
    ['certificates', e.certificates, captured.list],
    ['certificate', e.certificate, captured.one],
  ] as const)('parses the captured %s answer', (_, endpoint, data) => {
    expect(endpoint.response.safeParse(data).success).toBe(true);
  });

  it('keeps the numeric ids, the null score and the verification code', () => {
    const list = e.certificates.response.parse(captured.list);
    expect(list.items.map((certificate) => certificate.id)).toEqual([17, 12]);
    expect(list.items[0]).toMatchObject({
      bestScorePercent: 100,
      verificationCode: 'CBA-QZ-E2E-01-000004-1',
    });
    expect(list.items[1].bestScorePercent).toBeNull();
    expect(e.certificate.response.parse(captured.one).id).toBe(12);
  });

  it('accepts a certificate whose revision has no title, and refuses a missing name', () => {
    expect(
      e.certificate.response.safeParse({ ...captured.one, courseTitle: null })
        .success,
    ).toBe(true);
    const { fullName: _, ...withoutName } = captured.one;
    expect(e.certificate.response.safeParse(withoutName).success).toBe(false);
  });

  it('refuses the shape of the old mock certificate', () => {
    expect(
      e.certificate.response.safeParse({
        id: 'cert1',
        courseId: 'c1',
        courseCode: 'CIF',
        courseTitle: 'Nghiệp vụ CIF',
        userName: 'Nguyễn An',
        completedAt: '2026-10-18T08:00:00Z',
        score: 90,
        verificationCode: 'DEMO-CBA-CIF',
        issuedAt: '2026-10-18T08:00:10Z',
        fileName: 'DEMO.pdf',
      }).success,
    ).toBe(false);
  });

  it('has no download endpoint', () => {
    expect(Object.keys(e)).toEqual(['certificates', 'certificate']);
  });

  it('asks for a page of at most 100', () => {
    expect(
      CertificatesQuerySchema.safeParse({ page: 0, size: 100 }).success,
    ).toBe(true);
    expect(CertificatesQuerySchema.safeParse({ size: 101 }).success).toBe(
      false,
    );
    expect(CertificatesQuerySchema.safeParse({ size: 0 }).success).toBe(false);
  });

  it('reads the captured refusals as error envelopes', () => {
    expect(EnvelopeSchema.parse(captured.notFound)).toMatchObject({
      status: 'ERROR',
      messageCode: 'LEARNING-NOT_FOUND',
    });
    expect(EnvelopeSchema.parse(captured.badId)).toMatchObject({
      status: 'ERROR',
      messageCode: 'CORE-VALIDATION_FAILED',
    });
  });

  it('parses the captured course card with its certificate id', () => {
    expect(CourseCardSchema.parse(captured.courseCard).certificateId).toBe(12);
  });

  it('keeps cards without a certificate valid', () => {
    const card = { courseId: 7, code: 'DEMO-MEDIA' };
    expect(
      CourseCardSchema.parse({ ...card, certificateId: null }).certificateId,
    ).toBeNull();
    expect(CourseCardSchema.safeParse(card).success).toBe(true);
    expect(
      CourseCardSchema.safeParse({ ...card, certificateId: '12' }).success,
    ).toBe(false);
  });
});
