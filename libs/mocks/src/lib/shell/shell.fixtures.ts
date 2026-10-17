import type { NavCounts } from '@lms/contracts';

// Ported from the seed (lms-mockup/src/data/seed.js): unread `notifications` per user and the
// feedback items still `new` (2 questions and 1 report) that people who can reply see in the inbox.
// Fixed results of the server's computation, never recomputed. Keys match the `profileFixtures` roles (the dev toolbar's mock roles).
export const navCountsFixtures: Readonly<Record<string, NavCounts>> = {
  learner: { notifications: 2, inbox: 0 },
  instructor: { notifications: 1, inbox: 3 },
  admin: { notifications: 1, inbox: 3 },
  'unit-admin': { notifications: 0, inbox: 3 },
  viewer: { notifications: 0, inbox: 0 },
};
