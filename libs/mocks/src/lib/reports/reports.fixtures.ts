import type {
  ReportOverview,
  ReportDimension,
  ReportRow,
} from '@lms/contracts';

const summary = {
  enrolments: 2,
  completed: 1,
  inProgress: 1,
  notStarted: 0,
  failed: 0,
  overdue: 0,
  pct: 75,
  avgScore: 80,
  passRate: 100,
};
const unit = {
  id: 'un1',
  name: 'Ban QL&PT Core Banking',
  learners: 1,
  ...summary,
};
const group = { id: 'g1', name: 'Nhóm nghiệp vụ', learners: 1, ...summary };
const program = {
  id: 'p1',
  name: 'Hội nhập Core Banking',
  learners: 1,
  ...summary,
};
const course = {
  id: 'c1',
  name: 'Nghiệp vụ quản lý khách hàng CIF',
  learners: 1,
  ...summary,
  enrolments: 1,
  completed: 0,
  pct: 50,
};
export const reportOverviewFixture: ReportOverview = {
  scope: { unitId: 'un1', label: 'Ban QL&PT Core Banking' },
  total: { learners: 1, ...summary },
  byUnit: [unit],
  byGroup: [group],
  byProgram: [program],
  byCourse: [course],
  competency: [
    { id: 'k-cif', name: 'Quản lý CIF', value: 80, sampleSize: 1 },
    { id: 'k-eod', name: 'Xử lý cuối ngày', value: 60, sampleSize: 1 },
    { id: 'k-deposit', name: 'Tiền gửi', value: null, sampleSize: 0 },
  ],
  weeks: [
    { weekStart: '2026-10-05', completedLessons: 1 },
    { weekStart: '2026-10-12', completedLessons: 2 },
  ],
  filters: {
    units: [{ id: unit.id, name: unit.name }],
    groups: [{ id: group.id, name: group.name, unitId: unit.id }],
    programs: [{ id: program.id, name: program.name }],
    courses: [{ id: course.id, title: course.name }],
  },
  canEdit: false,
};
const person = { id: '000004', name: 'Nguyễn Minh An', unit: unit.name };
export const reportRowsFixture: Record<ReportDimension, ReportRow[]> = {
  learners: [
    {
      ...person,
      email: 'learner@demo.cb',
      group: group.name,
      status: 'active',
      courses: 2,
      completed: 1,
      overdue: 0,
      failed: 0,
      pct: 75,
      avgScore: 80,
      lastAccess: '2026-10-19T02:00:00Z',
    },
  ],
  courses: [course],
  programs: [program],
  groups: [group],
  units: [unit],
  status: [
    {
      ...person,
      id: 'en1',
      userId: person.id,
      group: group.name,
      courseId: 'c1',
      course: course.name,
      status: 'in_progress',
      overdue: false,
      pct: 50,
      dueAt: '2026-10-30T10:00:00Z',
      startedAt: '2026-10-12T02:00:00Z',
      completedAt: null,
      lastAccess: '2026-10-19T02:00:00Z',
    },
  ],
  results: [
    {
      ...person,
      id: 'at1',
      userId: person.id,
      quizId: 'q1',
      quiz: 'Kiểm tra CIF',
      score: 80,
      passed: true,
      nth: 1,
      at: '2026-10-18T08:00:00Z',
      autoSubmitted: false,
    },
  ],
  competency: [
    {
      ...person,
      values: [
        { competencyId: 'k-cif', name: 'Quản lý CIF', value: 80 },
        { competencyId: 'k-eod', name: 'Xử lý cuối ngày', value: 60 },
        { competencyId: 'k-deposit', name: 'Tiền gửi', value: null },
      ],
    },
  ],
};
