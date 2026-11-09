import type { HeatmapDay, MyStreak, WeeklyActivity } from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import { learnerPointsFixtures } from './learning.fixtures';
import type { LearningDirectory } from './learning.backend';
import { refuse } from './learning-reply';

/** The Monday 25 weeks before the mock's "today", Tuesday 2026-10-27 (the date the page specs pin). */
const FIRST_DAY = Date.UTC(2026, 4, 4);
const TODAY = Date.UTC(2026, 9, 27);
const DAY_MS = 24 * 60 * 60 * 1000;
/** The bank holiday inside the window. */
const HOLIDAY = '2026-09-02';

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * One fixed 26-week heatmap: a learner who studies most working days, never on holidays, and once on a
 * Saturday. Which days qualify and which are rest days is the server's rule; the mock only returns a
 * fixed result of it (`docs/conventions/contracts-and-mocks.md`, "Fixtures").
 */
function heatmap(): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  for (let at = FIRST_DAY, index = 0; at <= TODAY; at += DAY_MS, index++) {
    const date = new Date(at);
    const iso = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const restDay = weekend || iso === HOLIDAY;
    const lessons = restDay ? (index === 54 ? 1 : 0) : (index * 7) % 5;
    const quizzes = restDay ? 0 : index % 9 === 0 ? 1 : 0;
    days.push({ date: iso, lessons, quizzes, restDay });
  }
  return days;
}

/** The heatmap cut into Monday-to-Sunday weeks, the last `count` of them, as days with any activity. */
function weeks(count: number): WeeklyActivity['weeks'] {
  const days = heatmap();
  const result: WeeklyActivity['weeks'] = [];
  for (let start = 0; start < days.length; start += 7) {
    const week = days.slice(start, start + 7);
    const end = new Date(Date.parse(week[0].date) + 6 * DAY_MS);
    result.push({
      weekStart: week[0].date,
      weekEnd: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
      activeDays: week.filter((day) => day.lessons + day.quizzes > 0).length,
    });
  }
  return result.slice(-count);
}

/** `GET /streak` and `GET /dashboard/activity/weekly`: a learner's fixed streak, heatmap and weeks; anyone else is refused. */
export class LearnerStreak {
  constructor(private readonly directory: LearningDirectory) {}

  streak(request: FakeRequest): MyStreak {
    const userId = this.directory.callerId(request);
    if (!(userId in learnerPointsFixtures)) return refuse('accessDenied');
    return { currentStreak: 3, longestStreak: 8, days: heatmap() };
  }

  weekly(request: FakeRequest): WeeklyActivity {
    const userId = this.directory.callerId(request);
    if (!(userId in learnerPointsFixtures)) return refuse('accessDenied');
    const count = Number(request.query['weeks'] ?? 8);
    return { timeZone: 'Asia/Ho_Chi_Minh', weeks: weeks(count) };
  }
}
