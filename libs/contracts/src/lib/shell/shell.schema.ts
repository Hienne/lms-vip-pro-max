import { z } from 'zod';

/**
 * What the shell badges show, computed by the server for the signed-in user: unread notifications
 * (the bell) and new feedback items waiting for a reply (the inbox item; 0 for roles that cannot
 * reply). Mirrors `refreshBadges` in lms-mockup/src/core/shell.js.
 */
export const NavCountsSchema = z.object({
  notifications: z.number().int().nonnegative(),
  inbox: z.number().int().nonnegative(),
});
export type NavCounts = z.infer<typeof NavCountsSchema>;
