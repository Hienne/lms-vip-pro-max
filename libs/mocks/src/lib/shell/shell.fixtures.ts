import type { NavCounts } from '@lms/contracts';

// Ported from the seed (lms-mockup/src/data/seed.js): unread `notifications` per user and the
// feedback items still `new` (2 questions and 1 report) that people who can reply see in the
// inbox. Fixed results of the server's computation, never recomputed. Keyed by the backend role
// code of the signed-in demo user (see `FakeBackend`).
export const navCountsFixtures: Readonly<Record<string, NavCounts>> = {
  LEARNER: { notifications: 2, inbox: 0 },
  INSTRUCTOR: { notifications: 1, inbox: 3 },
  ADMIN: { notifications: 1, inbox: 3 },
  SUPER_ADMIN: { notifications: 1, inbox: 3 },
  REPORT_VIEWER: { notifications: 0, inbox: 0 },
};
