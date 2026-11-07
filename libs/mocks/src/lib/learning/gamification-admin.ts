import {
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
  SaveBadgeCommandSchema,
  SaveGamificationConfigCommandSchema,
  type AdminBadge,
  type CalendarDay,
  type ConfigVersion,
  type ImpactReport,
  type SaveCalendarYearCommand,
} from '@lms/contracts';
import { envelopeOk } from '../envelope';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import type { LearningDirectory } from './learning.backend';
import { refuse, refuseField } from './learning-reply';

/** The version the server seeds from its settings, with the default ladder. */
const seedVersion: ConfigVersion = {
  versionNo: 1,
  lessonXp: 5,
  quizPassXp: 30,
  firstTryBonusXp: 20,
  firstTryThresholdPercent: 90,
  communityXp: 10,
  communityDailyCap: 30,
  levels: [
    { level: 1, name: 'Giao dịch viên tập sự', minXp: 0 },
    { level: 2, name: 'Giao dịch viên', minXp: 200 },
    { level: 3, name: 'Chuyên viên', minXp: 600 },
    { level: 4, name: 'Chuyên viên chính', minXp: 1500 },
    { level: 5, name: 'Chuyên gia nghiệp vụ', minXp: 3500 },
    { level: 6, name: 'Chuyên gia Core Banking', minXp: 7000 },
  ],
  createdBy: null,
  createdAt: '2026-11-07T02:15:03Z',
  current: false,
};

/** The fixed solar holidays the server seeds for 2026. */
const seedCalendar: readonly CalendarDay[] = [
  { date: '2026-01-01', type: 'HOLIDAY', note: 'Tết Dương lịch' },
  { date: '2026-04-30', type: 'HOLIDAY', note: 'Ngày Giải phóng miền Nam' },
  { date: '2026-05-01', type: 'HOLIDAY', note: 'Ngày Quốc tế Lao động' },
  { date: '2026-09-02', type: 'HOLIDAY', note: 'Quốc khánh' },
];

/** Badges the server seeds: one already held (so its rule is locked) and one nobody holds. */
const seedBadges: readonly AdminBadge[] = [
  {
    badgeId: 1,
    code: 'FIRST_COURSE',
    name: 'Khóa học đầu tiên',
    description: 'Hoàn thành khóa học đầu tiên của bạn.',
    icon: 'graduation-cap',
    ruleType: 'COURSES_COMPLETED',
    paramN: 1,
    paramProgramId: null,
    programName: null,
    condition: 'Hoàn thành khóa học đầu tiên',
    status: 'active',
    locked: true,
    holders: 42,
    backfillStatus: 'DONE',
    backfillTotal: 42,
    backfillDone: 42,
  },
  {
    badgeId: 2,
    code: 'COURSES_10',
    name: 'Mười khóa học',
    description: 'Hoàn thành 10 khóa học.',
    icon: 'library',
    ruleType: 'COURSES_COMPLETED',
    paramN: 10,
    paramProgramId: null,
    programName: null,
    condition: 'Hoàn thành 10 khóa học',
    status: 'active',
    locked: false,
    holders: 0,
    backfillStatus: 'DONE',
    backfillTotal: 0,
    backfillDone: 0,
  },
];

/**
 * What the report shows for the mock's 48 learners: launched this morning, so only the window before it
 * has figures. Rates are percentages with one decimal, as the server gives them.
 */
function impactReport(request: FakeRequest): ImpactReport {
  const launchedAt = '2026-11-07T02:15:03Z';
  const day = (iso: string) => iso.slice(0, 10);
  return {
    from: request.query['from']?.toString() ?? '2026-10-11',
    to: request.query['to']?.toString() ?? day(new Date().toISOString()),
    launchedAt,
    learners: 48,
    weeklyActive: [
      { weekStart: '2026-10-12', learners: 15 },
      { weekStart: '2026-10-19', learners: 19 },
      { weekStart: '2026-10-26', learners: 24 },
      { weekStart: '2026-11-02', learners: 27 },
    ],
    assigned: {
      assigned: 120,
      completed: 84,
      completedOnTime: 66,
      completionRatePercent: 70,
      onTimeRatePercent: 55,
    },
    comparison: {
      launchedAt,
      windowDays: 28,
      before: {
        from: '2026-10-10',
        to: '2026-11-06',
        weeklyActiveLearners: 14.5,
        assigned: {
          assigned: 90,
          completed: 54,
          completedOnTime: 40,
          completionRatePercent: 60,
          onTimeRatePercent: 44.4,
        },
      },
      after: null,
    },
    xpBySource: [
      { source: 'LESSON', xp: 1800, learners: 40 },
      { source: 'QUIZ_PASS', xp: 900, learners: 31 },
      { source: 'COURSE', xp: 640, learners: 22 },
    ],
    badges: [
      { badgeId: 1, name: 'Khóa học đầu tiên', awarded: 30 },
      { badgeId: 2, name: 'Mười khóa học', awarded: 0 },
    ],
    levels: [
      { level: 1, name: 'Giao dịch viên tập sự', learners: 20 },
      { level: 2, name: 'Giao dịch viên', learners: 28 },
    ],
    optOut: { hidden: 4, learners: 48, ratePercent: 8.3 },
  };
}

/** How many people the mock "finds" when a badge's background award starts, and how many it does per read. */
const BACKFILL_TOTAL = 12;
const BACKFILL_STEP = 4;

/**
 * The gamification admin endpoints (XP weights, ladder, working calendar), stateful like the server: a save
 * adds a version or replaces a year, and the next read shows it. Only a system admin may call them.
 */
export class GamificationAdmin {
  private versions: ConfigVersion[] = [seedVersion];
  private days: CalendarDay[] = [...seedCalendar];
  private badges: AdminBadge[] = [...seedBadges];

  constructor(private readonly directory: LearningDirectory) {}

  /** The report for any caller with a report grant; the scope itself is the server's and is not simulated. */
  impact(request: FakeRequest): ImpactReport {
    this.directory.reportScope(request);
    return impactReport(request);
  }

  /** The same figures, one per line, as a CSV. */
  exportImpact(request: FakeRequest): FakeReply {
    const report = this.impact(request);
    const lines = [
      ['Phạm vi', 'Số học viên', report.learners],
      ...report.weeklyActive.map((w) => [
        'Học viên hoạt động theo tuần',
        `Tuần từ ${w.weekStart}`,
        w.learners,
      ]),
      ['Khóa được giao', 'Số khóa được giao', report.assigned.assigned],
      ...report.xpBySource.map((x) => ['XP theo nguồn', x.source, x.xp]),
      ...report.badges.map((b) => ['Huy hiệu được trao', b.name, b.awarded]),
      ...report.levels.map((l) => ['Học viên theo cấp', l.name, l.learners]),
    ].map((row) => row.map((cell) => `"${cell}"`).join(','));
    const header = '\uFEFF"Nhóm","Chỉ số","Giá trị"';
    const file = new Blob([[header, ...lines, ''].join('\r\n')], {
      type: 'text/csv',
    });
    return { status: 200, body: envelopeOk(null), file };
  }

  current(request: FakeRequest): ConfigVersion {
    this.requireAdmin(request);
    return this.newestFirst()[0];
  }

  history(request: FakeRequest): ConfigVersion[] {
    this.requireAdmin(request);
    return this.newestFirst();
  }

  save(request: FakeRequest): ConfigVersion {
    const admin = this.requireAdmin(request);
    const parsed = SaveGamificationConfigCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return refuseField(
        issue.path.map(String).join('.'),
        'INVALID_VALUE',
        issue.message,
      );
    }
    const command = parsed.data;
    const next: ConfigVersion = {
      versionNo: Math.max(...this.versions.map((v) => v.versionNo)) + 1,
      lessonXp: command.lessonXp,
      quizPassXp: command.quizPassXp,
      firstTryBonusXp: command.firstTryBonusXp,
      firstTryThresholdPercent: command.firstTryThresholdPercent,
      communityXp: command.communityXp,
      communityDailyCap: command.communityDailyCap,
      levels: command.levels.map((level, index) => ({
        level: index + 1,
        name: level.name,
        minXp: level.minXp,
      })),
      createdBy: admin,
      createdAt: new Date().toISOString(),
      current: true,
    };
    this.versions = [...this.versions, next];
    return next;
  }

  calendar(request: FakeRequest): CalendarDay[] {
    this.requireAdmin(request);
    return this.ofYear(this.year(request));
  }

  saveCalendar(request: FakeRequest): CalendarDay[] {
    this.requireAdmin(request);
    const year = this.year(request);
    const body = request.body as SaveCalendarYearCommand;
    const seen = new Set<string>();
    const entries: CalendarDay[] = [];
    body.days.forEach((day, index) => {
      const field = `days[${index}]`;
      if (Number(day.date.slice(0, 4)) !== year) {
        refuseField(
          `${field}.date`,
          'INVALID_VALUE',
          `Ngày phải thuộc năm ${year}.`,
        );
      }
      if (seen.has(day.date)) {
        refuseField(`${field}.date`, 'DUPLICATE', 'Ngày này đã có trong lịch.');
      }
      seen.add(day.date);
      entries.push({
        date: day.date,
        type: day.type,
        note: day.note?.trim() ? day.note.trim() : null,
      });
    });
    this.days = [
      ...this.days.filter((day) => Number(day.date.slice(0, 4)) !== year),
      ...entries,
    ];
    return this.ofYear(year);
  }

  /** Lists the badges; a badge still being awarded moves on a step with every read, like the server's job. */
  badgeList(request: FakeRequest): AdminBadge[] {
    this.requireAdmin(request);
    const listed = this.badges;
    this.badges = listed.map((badge) => this.advance(badge));
    return listed;
  }

  createBadge(request: FakeRequest): AdminBadge {
    this.requireAdmin(request);
    const command = this.badgeCommand(request);
    const badgeId = Math.max(0, ...this.badges.map((b) => b.badgeId)) + 1;
    const badge: AdminBadge = {
      ...this.described(command),
      badgeId,
      code: `CUSTOM_${String(badgeId).padStart(12, '0')}`,
      status: 'active',
      locked: false,
      holders: 0,
      backfillStatus: 'RUNNING',
      backfillTotal: BACKFILL_TOTAL,
      backfillDone: 0,
    };
    this.badges = [...this.badges, badge];
    return badge;
  }

  updateBadge(request: FakeRequest): AdminBadge {
    this.requireAdmin(request);
    const current = this.badge(request);
    const command = this.badgeCommand(request);
    const ruleChanged =
      command.ruleType !== current.ruleType ||
      command.paramN !== current.paramN ||
      command.paramProgramId !== current.paramProgramId;
    if (ruleChanged && current.locked) {
      refuseField(
        'ruleType',
        'LOCKED',
        'Huy hiệu đã có người nhận nên không đổi được luật.',
      );
    }
    const next: AdminBadge = {
      ...current,
      ...this.described(command),
      ...(ruleChanged && current.status === 'active'
        ? {
            backfillStatus: 'RUNNING' as const,
            backfillTotal: BACKFILL_TOTAL,
            backfillDone: 0,
          }
        : {}),
    };
    this.replace(next);
    return next;
  }

  retireBadge(request: FakeRequest): AdminBadge {
    this.requireAdmin(request);
    const next: AdminBadge = { ...this.badge(request), status: 'retired' };
    this.replace(next);
    return next;
  }

  private badge(request: FakeRequest): AdminBadge {
    const id = Number(request.params['badgeId']);
    const found = this.badges.find((b) => b.badgeId === id);
    return found ?? refuse('learningNotFound');
  }

  private replace(next: AdminBadge): void {
    this.badges = this.badges.map((b) =>
      b.badgeId === next.badgeId ? next : b,
    );
  }

  private badgeCommand(request: FakeRequest) {
    const parsed = SaveBadgeCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return refuseField(
        issue.path.map(String).join('.'),
        'INVALID_VALUE',
        issue.message,
      );
    }
    return parsed.data;
  }

  private described(
    command: ReturnType<GamificationAdmin['badgeCommand']>,
  ): Pick<
    AdminBadge,
    | 'name'
    | 'description'
    | 'icon'
    | 'ruleType'
    | 'paramN'
    | 'paramProgramId'
    | 'programName'
    | 'condition'
  > {
    const program =
      command.ruleType === 'PROGRAM_COMPLETED'
        ? `Chương trình ${command.paramProgramId}`
        : null;
    return {
      name: command.name,
      description: command.description,
      icon: command.icon,
      ruleType: command.ruleType,
      paramN: command.ruleType === 'PROGRAM_COMPLETED' ? null : command.paramN,
      paramProgramId:
        command.ruleType === 'PROGRAM_COMPLETED'
          ? command.paramProgramId
          : null,
      programName: program,
      condition:
        program === null
          ? `Đạt ngưỡng ${command.paramN}`
          : `Hoàn thành mọi khóa học của ${program}`,
    };
  }

  private advance(badge: AdminBadge): AdminBadge {
    if (badge.backfillStatus !== 'RUNNING') return badge;
    const done = Math.min(
      badge.backfillTotal,
      badge.backfillDone + BACKFILL_STEP,
    );
    return {
      ...badge,
      backfillDone: done,
      holders: badge.holders + (done - badge.backfillDone),
      locked: badge.locked || done > 0,
      backfillStatus: done >= badge.backfillTotal ? 'DONE' : 'RUNNING',
    };
  }

  private newestFirst(): ConfigVersion[] {
    const newest = Math.max(...this.versions.map((v) => v.versionNo));
    return [...this.versions]
      .sort((a, b) => b.versionNo - a.versionNo)
      .map((version) => ({
        ...version,
        current: version.versionNo === newest,
      }));
  }

  private ofYear(year: number): CalendarDay[] {
    return this.days
      .filter((day) => Number(day.date.slice(0, 4)) === year)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private year(request: FakeRequest): number {
    const year = Number(request.params['year']);
    if (
      !Number.isInteger(year) ||
      year < MIN_CALENDAR_YEAR ||
      year > MAX_CALENDAR_YEAR
    ) {
      refuseField(
        'year',
        'INVALID_VALUE',
        `Năm phải từ ${MIN_CALENDAR_YEAR} đến ${MAX_CALENDAR_YEAR}.`,
      );
    }
    return year;
  }

  private requireAdmin(request: FakeRequest): string {
    const userId = this.directory.callerId(request);
    if (!this.directory.isSystemAdmin(request)) refuse('accessDenied');
    return userId;
  }
}
