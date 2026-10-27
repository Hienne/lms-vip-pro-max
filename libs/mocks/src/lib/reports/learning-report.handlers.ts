import {
  reportEndpoints,
  ReportDimensionSchema,
  type AnyEndpoint,
  type ReportRow,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeOk } from '../envelope';
import { reportOverviewFixture, reportRowsFixture } from './reports.fixtures';

const matchesScope = (q: FakeRequest['query']) =>
  (!q['unitId'] || q['unitId'] === 'un1') &&
  (!q['groupId'] || q['groupId'] === 'g1') &&
  (!q['programId'] || q['programId'] === 'p1') &&
  (!q['courseId'] || q['courseId'] === 'c1');
function rowsFor(request: FakeRequest): ReportRow[] {
  const dim = ReportDimensionSchema.parse(
    request.params['dim'] ?? request.query['dim'],
  );
  if (!matchesScope(request.query)) return [];
  const { q, sort, from, to } = request.query;
  const rows = reportRowsFixture[dim].filter((row) => {
    const value =
      'at' in row
        ? row.at
        : 'lastAccess' in row
          ? row.lastAccess
          : '2026-10-19T02:00:00Z';
    return (
      (!q ||
        JSON.stringify(row)
          .toLocaleLowerCase('vi')
          .includes(q.toLocaleLowerCase('vi'))) &&
      (!from || (value !== null && value >= from)) &&
      (!to || (value !== null && value <= to))
    );
  });
  const [key = 'name', direction = 'asc'] = (sort ?? '').split(',');
  return [...rows].sort((a, b) => {
    const av: unknown = Reflect.get(a, key),
      bv: unknown = Reflect.get(b, key);
    const comparison =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''), 'vi');
    return direction === 'desc' ? -comparison : comparison;
  });
}
const cell = (value: unknown): string => {
  let text =
    typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export const learningReportHandlers = new Map<
  AnyEndpoint,
  (request: FakeRequest) => FakeReply
>([
  [
    reportEndpoints.overview,
    (request) => {
      const visible =
        matchesScope(request.query) &&
        (!request.query['from'] ||
          new Date(request.query['from']).getTime() <=
            Date.parse('2026-10-19T02:00:00Z')) &&
        (!request.query['to'] ||
          new Date(request.query['to']).getTime() >=
            Date.parse('2026-10-19T02:00:00Z'));
      const data = visible
        ? reportOverviewFixture
        : {
            ...reportOverviewFixture,
            total: {
              learners: 0,
              enrolments: 0,
              completed: 0,
              inProgress: 0,
              notStarted: 0,
              failed: 0,
              overdue: 0,
              pct: 0,
              avgScore: null,
              passRate: null,
            },
            byUnit: [],
            byGroup: [],
            byCourse: [],
            byProgram: [],
            competency: [],
            weeks: [],
          };
      return { status: 200, body: envelopeOk(data) };
    },
  ],
  [
    reportEndpoints.detail,
    (request) => {
      const rows = rowsFor(request),
        page = Math.max(0, Number(request.query['page'] ?? 0)),
        size = Math.min(100, Math.max(1, Number(request.query['size'] ?? 20)));
      return {
        status: 200,
        body: envelopeOk({
          items: rows.slice(page * size, (page + 1) * size),
          page,
          size,
          totalElements: rows.length,
          totalPages: Math.ceil(rows.length / size),
        }),
      };
    },
  ],
  [
    reportEndpoints.export,
    (request) => {
      const rows =
        request.query['dim'] === 'overview'
          ? matchesScope(request.query)
            ? [reportOverviewFixture.total]
            : []
          : rowsFor(request);
      const keys = rows.length ? Object.keys(rows[0]) : ['name'];
      const csv =
        '\uFEFF' +
        [
          keys.map(cell).join(','),
          ...rows.map((row) =>
            keys.map((key) => cell(Reflect.get(row, key))).join(','),
          ),
        ].join('\r\n');
      return {
        status: 200,
        body: envelopeOk(null),
        file: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      };
    },
  ],
]);
