import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';

/** Most levels a ladder may have (the server's limit). */
export const MAX_LEVELS = 20;
/** Largest XP weight an admin can enter for one activity (the server's limit). */
export const MAX_ACTIVITY_XP = 10_000;
/** Largest community daily cap (the server's limit). */
export const MAX_COMMUNITY_CAP = 100_000;
/** Years the working calendar accepts (the server's limit). */
export const MIN_CALENDAR_YEAR = 2000;
export const MAX_CALENDAR_YEAR = 2100;

/** One step of the level ladder as the server stores it: the level number, its name and the XP it starts at. */
export const LevelStepSchema = z.object({
  level: z.number().int().min(1),
  name: z.string(),
  minXp: z.number().int().nonnegative(),
});
export type LevelStep = z.infer<typeof LevelStepSchema>;

/**
 * `ConfigVersion`: one saved version of the XP weights and the level ladder. A version never changes; a save
 * adds the next one and the newest applies from the moment it is saved. `createdBy` and `createdAt` are
 * null on the version the server seeded from its settings.
 */
export const ConfigVersionSchema = z.object({
  versionNo: z.number().int().min(1),
  lessonXp: z.number().int().nonnegative(),
  quizPassXp: z.number().int().nonnegative(),
  firstTryBonusXp: z.number().int().nonnegative(),
  firstTryThresholdPercent: z.number().int().min(0).max(100),
  communityXp: z.number().int().nonnegative(),
  communityDailyCap: z.number().int().nonnegative(),
  levels: z.array(LevelStepSchema),
  createdBy: z.string().nullable(),
  createdAt: BackendDateTimeSchema.nullable(),
  current: z.boolean(),
});
export type ConfigVersion = z.infer<typeof ConfigVersionSchema>;

const xpField = (max: number, label: string) =>
  z
    .number({ error: `Nhập số XP cho ${label}.` })
    .int({ error: 'Nhập số nguyên.' })
    .min(0, { error: 'Số XP không được âm.' })
    .max(max, { error: `Không quá ${max}.` });

/** One step of the ladder as an admin enters it; the level number is its position. */
export const LevelInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Cần nhập tên cấp.' })
    .max(100, { error: 'Tên cấp không quá 100 ký tự.' }),
  minXp: z
    .number({ error: 'Nhập số XP.' })
    .int({ error: 'Nhập số nguyên.' })
    .min(0, { error: 'Số XP không được âm.' }),
});
export type LevelInput = z.infer<typeof LevelInputSchema>;

/**
 * `SaveGamificationConfig`: the weights and the ladder of the next version. The ladder rules are the server's:
 * the first level starts at 0 XP and every threshold is above the one before. The messages match the server's.
 */
export const SaveGamificationConfigCommandSchema = z.object({
  lessonXp: xpField(MAX_ACTIVITY_XP, 'bài học'),
  quizPassXp: xpField(MAX_ACTIVITY_XP, 'bài kiểm tra đạt'),
  firstTryBonusXp: xpField(MAX_ACTIVITY_XP, 'thưởng đạt ngay lần đầu'),
  firstTryThresholdPercent: z
    .number({ error: 'Nhập ngưỡng điểm.' })
    .int({ error: 'Nhập số nguyên.' })
    .min(0, { error: 'Ngưỡng điểm từ 0 đến 100.' })
    .max(100, { error: 'Ngưỡng điểm từ 0 đến 100.' }),
  communityXp: xpField(MAX_ACTIVITY_XP, 'đóng góp cộng đồng'),
  communityDailyCap: xpField(MAX_COMMUNITY_CAP, 'trần cộng đồng mỗi ngày'),
  levels: z
    .array(LevelInputSchema)
    .min(1, { error: 'Cần ít nhất một cấp.' })
    .max(MAX_LEVELS, { error: `Tối đa ${MAX_LEVELS} cấp.` })
    .superRefine((levels, ctx) => {
      levels.forEach((level, index) => {
        if (index === 0 && level.minXp !== 0) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'minXp'],
            message: 'Cấp đầu tiên phải từ 0 XP.',
          });
        }
        const previous = levels[index - 1];
        if (previous && level.minXp <= previous.minXp) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'minXp'],
            message: 'Ngưỡng XP phải lớn hơn cấp trước.',
          });
        }
      });
    }),
});
export type SaveGamificationConfigCommand = z.infer<
  typeof SaveGamificationConfigCommandSchema
>;

/** A day that differs from the usual Monday-to-Friday week: a holiday, or a make-up working day. */
export const CalendarDayTypeSchema = z.enum(['HOLIDAY', 'MAKEUP_WORKDAY']);
export type CalendarDayType = z.infer<typeof CalendarDayTypeSchema>;

/** `CalendarDay`: one exception day of the bank-wide working calendar. */
export const CalendarDaySchema = z.object({
  date: z.iso.date(),
  type: CalendarDayTypeSchema,
  note: z.string().nullable(),
});
export type CalendarDay = z.infer<typeof CalendarDaySchema>;

/** The calendar of one year, exception days only, oldest first. */
export const CalendarYearSchema = z.array(CalendarDaySchema);

/** One day as an admin enters it. */
export const CalendarDayInputSchema = z.object({
  date: z.iso.date({ error: 'Chọn ngày.' }),
  type: CalendarDayTypeSchema,
  note: z
    .string()
    .trim()
    .max(200, { error: 'Ghi chú không quá 200 ký tự.' })
    .nullable(),
});
export type CalendarDayInput = z.infer<typeof CalendarDayInputSchema>;

/**
 * `SaveCalendarYear`: every exception day of the year; the server replaces the year's days with these.
 * Each day must fall in the year and no date repeats (`year` is checked by the form, which knows it).
 */
export const SaveCalendarYearCommandSchema = z.object({
  days: z.array(CalendarDayInputSchema),
});
export type SaveCalendarYearCommand = z.infer<
  typeof SaveCalendarYearCommandSchema
>;

/** What a badge is earned for. `PROGRAM_COMPLETED` takes a programme; every other rule takes a count N. */
export const BadgeRuleTypeSchema = z.enum([
  'COURSES_COMPLETED',
  'PROGRAM_COMPLETED',
  'FIRST_TRY_PERFECT',
  'ASSIGNED_BEFORE_DEADLINE',
  'STREAK_WORKING_DAYS',
]);
export type BadgeRuleType = z.infer<typeof BadgeRuleTypeSchema>;

export const BADGE_NAME_MAX = 100;
export const BADGE_DESCRIPTION_MAX = 300;
export const BADGE_MAX_N = 1000;

/** How far the background award to people who already qualify has got. */
export const BadgeBackfillStatusSchema = z.enum(['RUNNING', 'DONE', 'FAILED']);
export type BadgeBackfillStatus = z.infer<typeof BadgeBackfillStatusSchema>;

/**
 * `AdminBadgeView`: one badge as the system admin sees it. `locked` is true once anyone holds the badge, from
 * then on its rule cannot change. `holders` counts everyone who has it, retired or not.
 */
export const AdminBadgeSchema = z.object({
  badgeId: z.number().int(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  ruleType: BadgeRuleTypeSchema,
  paramN: z.number().int().nullable(),
  paramProgramId: z.number().int().nullable(),
  programName: z.string().nullable(),
  condition: z.string(),
  status: z.enum(['active', 'retired']),
  locked: z.boolean(),
  holders: z.number().int(),
  backfillStatus: BadgeBackfillStatusSchema,
  backfillTotal: z.number().int(),
  backfillDone: z.number().int(),
});
export type AdminBadge = z.infer<typeof AdminBadgeSchema>;

/**
 * `SaveBadge`: the body of create and edit. A count rule needs `paramN` and no programme; the programme rule
 * the other way round.
 */
export const SaveBadgeCommandSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: 'Cần nhập tên huy hiệu.' })
      .max(BADGE_NAME_MAX, { error: 'Tên không quá 100 ký tự.' }),
    description: z
      .string()
      .trim()
      .min(1, { error: 'Cần nhập mô tả.' })
      .max(BADGE_DESCRIPTION_MAX, { error: 'Mô tả không quá 300 ký tự.' }),
    icon: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,50}$/, {
        error: 'Biểu tượng là tên Lucide viết thường, ví dụ award.',
      }),
    ruleType: BadgeRuleTypeSchema,
    paramN: z.number().int().nullable(),
    paramProgramId: z.number().int().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.ruleType === 'PROGRAM_COMPLETED') {
      if (value.paramProgramId === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['paramProgramId'],
          message: 'Chọn một chương trình đào tạo.',
        });
      }
    } else if (
      value.paramN === null ||
      value.paramN < 1 ||
      value.paramN > BADGE_MAX_N
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['paramN'],
        message: `Ngưỡng từ 1 đến ${BADGE_MAX_N}.`,
      });
    }
  });
export type SaveBadgeCommand = z.infer<typeof SaveBadgeCommandSchema>;

/** Learners who were active in one week (Monday is the first day, Vietnam time). */
export const ImpactWeekSchema = z.object({
  weekStart: z.iso.date(),
  learners: z.number().int(),
});

/**
 * Assigned courses whose start fell in the period: how many were assigned, finished, and finished on time.
 * A rate is a percentage with one decimal, `null` when nothing was assigned.
 */
export const ImpactAssignedSchema = z.object({
  assigned: z.number().int(),
  completed: z.number().int(),
  completedOnTime: z.number().int(),
  completionRatePercent: z.number().nullable(),
  onTimeRatePercent: z.number().nullable(),
});
export type ImpactAssigned = z.infer<typeof ImpactAssignedSchema>;

/** One side of the before/after comparison; `to` is the last day, included. */
export const ImpactWindowSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  weeklyActiveLearners: z.number().nullable(),
  assigned: ImpactAssignedSchema,
});
export type ImpactWindow = z.infer<typeof ImpactWindowSchema>;

/** Two windows of `windowDays` around the launch; `after` is `null` until a day has passed since launch. */
export const ImpactComparisonSchema = z.object({
  launchedAt: BackendDateTimeSchema,
  windowDays: z.number().int(),
  before: ImpactWindowSchema,
  after: ImpactWindowSchema.nullable(),
});

export const ImpactSourceSchema = z.object({
  source: z.enum([
    'LESSON',
    'QUIZ_PASS',
    'QUIZ_FIRST_TRY_BONUS',
    'COURSE',
    'COMMUNITY',
    'ADJUSTMENT',
  ]),
  xp: z.number().int(),
  learners: z.number().int(),
});
export type ImpactSource = z.infer<typeof ImpactSourceSchema>;

export const ImpactBadgeSchema = z.object({
  badgeId: z.number().int(),
  name: z.string(),
  awarded: z.number().int(),
});

export const ImpactLevelSchema = z.object({
  level: z.number().int(),
  name: z.string(),
  learners: z.number().int(),
});

export const ImpactOptOutSchema = z.object({
  hidden: z.number().int(),
  learners: z.number().int(),
  ratePercent: z.number().nullable(),
});

/**
 * `ImpactReport`: aggregates for the learners in the caller's scope, with no per-person rows. `launchedAt` is
 * when config version 1 was saved.
 */
export const ImpactReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  launchedAt: BackendDateTimeSchema.nullable(),
  learners: z.number().int(),
  weeklyActive: z.array(ImpactWeekSchema),
  assigned: ImpactAssignedSchema,
  comparison: ImpactComparisonSchema.nullable(),
  xpBySource: z.array(ImpactSourceSchema),
  badges: z.array(ImpactBadgeSchema),
  levels: z.array(ImpactLevelSchema),
  optOut: ImpactOptOutSchema,
});
export type ImpactReport = z.infer<typeof ImpactReportSchema>;

/** The report's filters: a period of whole days, both ends included, and optionally one unit and its subtree. */
export const ImpactQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  orgId: z.number().int().positive().optional(),
});
export type ImpactQuery = z.infer<typeof ImpactQuerySchema>;
