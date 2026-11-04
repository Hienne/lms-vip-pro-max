import {
  LEARNING_REPORT_SORTS,
  LearningReportGroupBySchema,
  type DashboardEnrollment,
  type LearningReportCounts,
  type LearningReportEnrollmentRow,
  type LearningReportGroup,
  type LearningReportGroupBy,
} from '@lms/contracts';
import { refuse, refuseField } from './learning-reply';

type Query = Readonly<Record<string, string>>;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The backend's `LearningAnalytics.Counts`: 0 when empty, two decimals. */
export function learningCounts(
  rows: readonly LearningReportEnrollmentRow[],
): LearningReportCounts {
  const all = rows.map((row) => row.enrollment);
  const completed = all.filter((e) => e.status === 'completed').length;
  const progress = all.reduce((sum, e) => sum + e.progressPercent, 0);
  return {
    enrollments: all.length,
    learners: new Set(all.map((e) => e.userId)).size,
    courses: new Set(all.map((e) => e.courseId)).size,
    assigned: all.filter((e) => e.assigned).length,
    mandatory: all.filter((e) => e.mandatory).length,
    completed,
    inProgress: all.filter((e) => e.status === 'in_progress').length,
    notStarted: all.filter((e) => e.status === 'not_started').length,
    overdue: all.filter((e) => e.overdue).length,
    averageProgress: all.length ? round2(progress / all.length) : 0,
    completionRate: all.length ? round2((completed / all.length) * 100) : 0,
  };
}

const numberIs = (value: string | undefined, actual: number | null) =>
  value === undefined || value === '' || Number(value) === actual;

/** The report filter: ids match exactly, `q` searches the learner and the course. */
export function filterRows(
  rows: readonly LearningReportEnrollmentRow[],
  query: Query,
): LearningReportEnrollmentRow[] {
  const q = query['q']?.trim().toLocaleLowerCase('vi');
  const from = query['from'] ? Date.parse(query['from']) : undefined;
  const to = query['to'] ? Date.parse(query['to']) : undefined;
  return rows.filter(({ enrollment: e, fullName }) => {
    const enrolled = e.enrolledAt ? Date.parse(e.enrolledAt) : undefined;
    return (
      (!query['userId'] || e.userId === query['userId']) &&
      numberIs(query['orgId'], e.orgId) &&
      numberIs(query['teamId'], e.teamId) &&
      numberIs(query['courseId'], e.courseId) &&
      numberIs(query['programId'], e.programId) &&
      (!query['status'] || e.status === query['status']) &&
      (query['overdue'] === undefined ||
        e.overdue === (query['overdue'] === 'true')) &&
      (from === undefined || (enrolled !== undefined && enrolled >= from)) &&
      (to === undefined || (enrolled !== undefined && enrolled < to)) &&
      (!q ||
        [e.userId, fullName, e.courseCode, e.courseTitle].some((text) =>
          text?.toLocaleLowerCase('vi').includes(q),
        ))
    );
  });
}

const GROUP_KEY: Record<
  LearningReportGroupBy,
  (row: LearningReportEnrollmentRow) => [string | null, string | null]
> = {
  course: ({ enrollment: e }) => [
    String(e.courseId),
    `${e.courseCode} ${e.courseTitle}`,
  ],
  org: ({ enrollment: e, orgName }) => [
    e.orgId === null ? null : String(e.orgId),
    orgName,
  ],
  team: ({ enrollment: e, teamName }) => [
    e.teamId === null ? null : String(e.teamId),
    teamName,
  ],
  program: ({ enrollment: e }) => [
    e.programId === null ? null : String(e.programId),
    e.programName,
  ],
  user: ({ enrollment: e, fullName }) => [e.userId, fullName],
};

/** The counts per group, the groups with the most enrolments first; rows with no group are left out. */
export function groupRows(
  rows: readonly LearningReportEnrollmentRow[],
  groupBy: string | undefined,
): LearningReportGroup[] {
  const parsed = LearningReportGroupBySchema.safeParse(groupBy ?? 'course');
  if (!parsed.success)
    refuseField(
      'groupBy',
      'CORE-VALIDATION_FAILED',
      'Chọn user, course, program, org hoặc team.',
    );
  const key = GROUP_KEY[parsed.data as LearningReportGroupBy];
  const groups = new Map<
    string,
    { name: string | null; rows: LearningReportEnrollmentRow[] }
  >();
  for (const row of rows) {
    const [id, name] = key(row);
    if (id === null) continue;
    const group = groups.get(id) ?? { name, rows: [] };
    group.rows.push(row);
    groups.set(id, group);
  }
  return [...groups]
    .map(([id, group]) => {
      const {
        assigned: _a,
        mandatory: _m,
        ...counts
      } = learningCounts(group.rows);
      return { id, name: group.name, ...counts };
    })
    .sort((a, b) => b.enrollments - a.enrollments || a.id.localeCompare(b.id));
}

/** Sorts on one of `LEARNING_REPORT_SORTS` (`key,asc|desc`, default `id,asc`); nulls go last. */
export function sortRows(
  rows: readonly LearningReportEnrollmentRow[],
  sort: string | undefined,
): LearningReportEnrollmentRow[] {
  const [key = 'id', direction = 'asc'] = (sort || 'id,asc').split(',');
  if (!(LEARNING_REPORT_SORTS as readonly string[]).includes(key))
    refuse('validationFailed');
  const value = (row: LearningReportEnrollmentRow): number | null => {
    const raw = row.enrollment[key as keyof DashboardEnrollment];
    if (raw === null || raw === undefined) return null;
    return typeof raw === 'number' ? raw : Date.parse(String(raw));
  };
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
    return (av - bv) * sign || a.enrollment.id - b.enrollment.id;
  });
}

/** The export's CSV with the backend's header and raw values; a cell that could run as a formula is quoted. */
export function rowsCsv(rows: readonly LearningReportEnrollmentRow[]): Blob {
  const cell = (value: unknown): string => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const header =
    'Mã cán bộ,Họ tên,Đơn vị,Nhóm,Mã khóa,Khóa học,Chương trình,Trạng thái,Tiến độ %,Được giao,Bắt buộc,Ghi danh,Bắt đầu,Truy cập gần nhất,Hoàn thành,Hạn hoàn thành,Quá hạn';
  const lines = rows.map(({ enrollment: e, fullName, orgName, teamName }) =>
    [
      e.userId,
      fullName,
      orgName,
      teamName,
      e.courseCode,
      e.courseTitle,
      e.programName,
      e.status,
      e.progressPercent.toFixed(3),
      e.assigned,
      e.mandatory,
      e.enrolledAt,
      e.startedAt,
      e.lastAccessAt,
      e.completedAt,
      e.dueAt,
      e.overdue,
    ]
      .map(cell)
      .join(','),
  );
  return new Blob([`\uFEFF${header}\r\n${lines.join('\r\n')}\r\n`], {
    type: 'text/csv',
  });
}
