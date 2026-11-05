import { EnvelopeSchema } from '../http/envelope';
import { capturedLearningReports as captured } from './learning-reports.captured';
import { learningReportEndpoints as e } from './learning-reports.endpoints';
import {
  LearningReportFilterSchema,
  LearningReportGroupQuerySchema,
} from './learning-reports.schema';

describe('learningReportEndpoints', () => {
  it('lives on the backend, under the learning reports', () => {
    for (const endpoint of Object.values(e)) {
      expect(endpoint.served).toBeUndefined();
      expect(endpoint.path).toMatch(/^\/api\/v1\/reports\/learning\//);
    }
  });

  it.each([
    ['summary', e.summary, captured.summary],
    ['empty summary', e.summary, captured.emptySummary],
    ['groups by course', e.groups, captured.byCourse],
    ['groups by org', e.groups, captured.byOrg],
    ['groups by team', e.groups, captured.byTeam],
    ['enrollments', e.enrollments, captured.enrollments],
    ['overdue enrollments', e.enrollments, captured.overdue],
  ] as const)('parses the captured %s answer', (_, endpoint, data) => {
    expect(endpoint.response.safeParse(data).success).toBe(true);
  });

  it('keeps the counts, the instant and the time zone of the summary', () => {
    const summary = e.summary.response.parse(captured.summary);
    expect(summary.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(summary.counts).toMatchObject({
      enrollments: 21,
      overdue: 5,
      completionRate: 42.86,
    });
  });

  it('keeps group ids as strings and the enrolment inside each row', () => {
    const groups = e.groups.response.parse(captured.byOrg);
    expect(groups.items[0]).toMatchObject({
      id: '1',
      name: 'Ban Quản lý và phát triển Core Banking',
    });
    const rows = e.enrollments.response.parse(captured.enrollments);
    expect(rows.items).toHaveLength(2);
    expect(typeof rows.items[0].enrollment.progressPercent).toBe('number');
    expect(
      e.enrollments.response.parse(captured.overdue).items[0].enrollment
        .overdue,
    ).toBe(true);
  });

  it('reads the refused grouping as an error envelope', () => {
    const envelope = EnvelopeSchema.parse(captured.badGroupBy);
    expect(envelope).toMatchObject({
      status: 'ERROR',
      messageCode: 'CORE-VALIDATION_FAILED',
    });
  });

  it('exports a CSV blob with the same filters and a sort', () => {
    expect(e.exportEnrollments.responseType).toBe('blob');
    expect(
      e.exportEnrollments.query.safeParse({
        orgId: 1,
        overdue: true,
        sort: 'dueAt,asc',
      }).success,
    ).toBe(true);
  });

  it('refuses a grouping and a status the server does not know', () => {
    expect(
      LearningReportGroupQuerySchema.safeParse({ groupBy: 'quiz' }).success,
    ).toBe(false);
    expect(
      LearningReportFilterSchema.safeParse({ status: 'overdue' }).success,
    ).toBe(false);
  });
});
