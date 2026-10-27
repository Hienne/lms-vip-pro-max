import { z } from 'zod';

const percent = z.number().min(0).max(100);
const count = z.number().int().nonnegative();
const date = z.iso.datetime({ offset: true });
export const DashboardCourseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  programId: z.string().nullable(),
  domainName: z.string(),
  required: z.boolean(),
  assigned: z.boolean(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'failed']),
  pct: percent,
  done: count,
  total: count,
  dueAt: date.nullable(),
  overdue: z.boolean(),
  lastAccessAt: date.nullable(),
});
export const LearningDashboardSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    title: z.string().nullable(),
  }),
  counts: z.object({
    assigned: count,
    notStarted: count,
    inProgress: count,
    completed: count,
    required: count,
    overdue: count,
    failed: count,
  }),
  completionPct: percent,
  lastScore: z
    .object({
      quizId: z.string(),
      quizTitle: z.string(),
      score: percent,
      passed: z.boolean(),
      at: date,
    })
    .nullable(),
  bestScore: percent.nullable(),
  passedQuizzes: count,
  totalQuizzes: count,
  cards: z.array(DashboardCourseSchema),
  deadlines: z.array(DashboardCourseSchema),
  continueTarget: z
    .object({
      courseId: z.string(),
      courseTitle: z.string(),
      lessonId: z.string(),
      lessonTitle: z.string(),
      where: z.string(),
      anchor: z
        .discriminatedUnion('type', [
          z.object({
            type: z.literal('pdf'),
            page: z.number().int().positive(),
          }),
          z.object({
            type: z.literal('video'),
            seconds: z.number().nonnegative(),
          }),
        ])
        .nullable(),
    })
    .nullable(),
  competency: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      value: percent.nullable(),
      answered: count,
    }),
  ),
  points: z.object({ total: count }),
  streak: count,
  journey: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      pct: percent,
      courses: count,
    }),
  ),
  serverNow: date,
});
export type LearningDashboard = z.infer<typeof LearningDashboardSchema>;
export type DashboardCourse = z.infer<typeof DashboardCourseSchema>;
