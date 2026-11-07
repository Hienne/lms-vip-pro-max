import { toUrl } from '../http/endpoint';
import { capturedGamification as captured } from './gamification.captured';
import { gamificationEndpoints } from './gamification.endpoints';
import {
  AdminBadgeSchema,
  CalendarYearSchema,
  ConfigVersionSchema,
  ImpactReportSchema,
  SaveBadgeCommandSchema,
  SaveCalendarYearCommandSchema,
  SaveGamificationConfigCommandSchema,
} from './gamification.schema';

const command = {
  lessonXp: 5,
  quizPassXp: 30,
  firstTryBonusXp: 20,
  firstTryThresholdPercent: 90,
  communityXp: 10,
  communityDailyCap: 30,
  levels: [
    { name: 'Cấp 1', minXp: 0 },
    { name: 'Cấp 2', minXp: 100 },
  ],
};

describe('gamificationEndpoints', () => {
  it('declares the verb and path of every call', () => {
    expect(
      Object.entries(gamificationEndpoints).map(([name, e]) => [
        name,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['config', 'get', '/api/v1/admin/learning/gamification/config'],
      [
        'configVersions',
        'get',
        '/api/v1/admin/learning/gamification/config/versions',
      ],
      ['saveConfig', 'post', '/api/v1/admin/learning/gamification/config'],
      ['calendar', 'get', '/api/v1/admin/learning/working-calendar/{year}'],
      ['saveCalendar', 'put', '/api/v1/admin/learning/working-calendar/{year}'],
      ['badges', 'get', '/api/v1/admin/learning/badges'],
      ['createBadge', 'post', '/api/v1/admin/learning/badges'],
      ['updateBadge', 'put', '/api/v1/admin/learning/badges/{badgeId}'],
      ['retireBadge', 'post', '/api/v1/admin/learning/badges/{badgeId}/retire'],
      ['impact', 'get', '/api/v1/reports/learning/gamification-impact'],
      [
        'exportImpact',
        'get',
        '/api/v1/reports/learning/gamification-impact/export',
      ],
    ]);
    expect(toUrl(gamificationEndpoints.calendar, { year: 2026 })).toBe(
      '/api/v1/admin/learning/working-calendar/2026',
    );
  });

  it('parses the responses captured from the backend', () => {
    expect(ConfigVersionSchema.parse(captured.config).versionNo).toBe(2);
    const versions = captured.versions.map((v) => ConfigVersionSchema.parse(v));
    expect(versions.map((v) => v.versionNo)).toEqual([2, 1]);
    expect(versions[1].createdBy).toBeNull();
    expect(CalendarYearSchema.parse(captured.calendar)).toHaveLength(3);
    const badges = captured.badges.map((b) => AdminBadgeSchema.parse(b));
    expect(badges.map((b) => b.backfillStatus)).toEqual(['DONE', 'RUNNING']);
    const impact = ImpactReportSchema.parse(captured.impact);
    expect(impact.comparison?.after).toBeNull();
    expect(impact.weeklyActive).toHaveLength(5);
  });

  it('refuses a calendar day of an unknown type', () => {
    expect(
      CalendarYearSchema.safeParse([
        { date: '2026-01-01', type: 'SUNDAY', note: null },
      ]).success,
    ).toBe(false);
  });
});

describe('SaveGamificationConfigCommandSchema', () => {
  const messages = (value: unknown) => {
    const result = SaveGamificationConfigCommandSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it('accepts a valid ladder', () => {
    expect(SaveGamificationConfigCommandSchema.safeParse(command).success).toBe(
      true,
    );
  });

  it('wants the first level at 0 XP, with the messages the server gives', () => {
    expect(messages({ ...command, levels: [{ name: 'A', minXp: 5 }] })).toEqual(
      ['Cấp đầu tiên phải từ 0 XP.'],
    );
  });

  it('wants strictly rising thresholds', () => {
    expect(
      messages({
        ...command,
        levels: [
          { name: 'A', minXp: 0 },
          { name: 'B', minXp: 100 },
          { name: 'C', minXp: 100 },
        ],
      }),
    ).toEqual(['Ngưỡng XP phải lớn hơn cấp trước.']);
  });

  it('refuses an empty name, a threshold above 100 and a negative weight', () => {
    expect(
      messages({ ...command, levels: [{ name: '  ', minXp: 0 }] }),
    ).toEqual(['Cần nhập tên cấp.']);
    expect(messages({ ...command, firstTryThresholdPercent: 101 })).toEqual([
      'Ngưỡng điểm từ 0 đến 100.',
    ]);
    expect(messages({ ...command, lessonXp: -1 })).toEqual([
      'Số XP không được âm.',
    ]);
  });
});

describe('SaveCalendarYearCommandSchema', () => {
  it('accepts an empty year and trims a note', () => {
    expect(SaveCalendarYearCommandSchema.parse({ days: [] }).days).toEqual([]);
    const day = SaveCalendarYearCommandSchema.parse({
      days: [{ date: '2026-09-02', type: 'HOLIDAY', note: '  Quốc khánh ' }],
    }).days[0];
    expect(day.note).toBe('Quốc khánh');
  });
});

describe('SaveBadgeCommandSchema', () => {
  const badge = {
    name: 'Đúng hẹn',
    description: 'Hoàn thành đúng hạn.',
    icon: 'award',
    ruleType: 'COURSES_COMPLETED',
    paramN: 3,
    paramProgramId: null,
  };
  const messages = (value: unknown) => {
    const result = SaveBadgeCommandSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it('accepts a count rule and a programme rule', () => {
    expect(SaveBadgeCommandSchema.safeParse(badge).success).toBe(true);
    expect(
      SaveBadgeCommandSchema.safeParse({
        ...badge,
        ruleType: 'PROGRAM_COMPLETED',
        paramN: null,
        paramProgramId: 3,
      }).success,
    ).toBe(true);
  });

  it('wants a count in range or a programme, as the server does', () => {
    expect(messages({ ...badge, paramN: 0 })).toEqual([
      'Ngưỡng từ 1 đến 1000.',
    ]);
    expect(messages({ ...badge, paramN: null })).toEqual([
      'Ngưỡng từ 1 đến 1000.',
    ]);
    expect(
      messages({ ...badge, ruleType: 'PROGRAM_COMPLETED', paramN: null }),
    ).toEqual(['Chọn một chương trình đào tạo.']);
  });

  it('refuses an empty name and an icon that is not a Lucide name', () => {
    expect(messages({ ...badge, name: ' ' })).toEqual([
      'Cần nhập tên huy hiệu.',
    ]);
    expect(messages({ ...badge, icon: 'Bad Icon' })).toEqual([
      'Biểu tượng là tên Lucide viết thường, ví dụ award.',
    ]);
  });
});
