import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  AdminBadgeSchema,
  CalendarYearSchema,
  ConfigVersionSchema,
  ImpactQuerySchema,
  ImpactReportSchema,
  SaveBadgeCommandSchema,
  SaveCalendarYearCommandSchema,
  SaveGamificationConfigCommandSchema,
} from './gamification.schema';

const badgeParams = z.object({ badgeId: z.number().int() });
const yearParams = z.object({ year: z.number().int() });

/**
 * Gamification administration (group A): the XP weights, the level ladder and the working calendar. Every
 * endpoint is for system admins only; anyone else is refused with `CORE-ACCESS_DENIED`.
 */
export const gamificationEndpoints = {
  /** The version in force: XP weights, first-try threshold, community daily cap and the level ladder. */
  config: defineEndpoint({
    method: 'get',
    path: '/api/v1/admin/learning/gamification/config',
    response: ConfigVersionSchema,
  }),
  /** Every saved version, newest first, with who saved it and when. */
  configVersions: defineEndpoint({
    method: 'get',
    path: '/api/v1/admin/learning/gamification/config/versions',
    response: z.array(ConfigVersionSchema),
  }),
  /**
   * Adds the next version, which applies from the save onwards and leaves past XP as it was. A ladder whose
   * first level is not 0 XP, whose thresholds do not strictly rise or that has an empty name is
   * `CORE-VALIDATION_FAILED`; levels learners already reached are kept.
   */
  saveConfig: defineEndpoint({
    method: 'post',
    path: '/api/v1/admin/learning/gamification/config',
    body: SaveGamificationConfigCommandSchema,
    response: ConfigVersionSchema,
  }),
  /** The exception days (holidays and make-up working days) of one year. */
  calendar: defineEndpoint({
    method: 'get',
    path: '/api/v1/admin/learning/working-calendar/{year}',
    params: yearParams,
    response: CalendarYearSchema,
  }),
  /**
   * Replaces every exception day of the year. A date outside the year, an unknown type or a repeated date is
   * `CORE-VALIDATION_FAILED`. Streaks use the new calendar from the next evaluation.
   */
  saveCalendar: defineEndpoint({
    method: 'put',
    path: '/api/v1/admin/learning/working-calendar/{year}',
    params: yearParams,
    body: SaveCalendarYearCommandSchema,
    response: CalendarYearSchema,
  }),
  /** Every badge, retired ones too, with holders, rule lock and the progress of the background award. */
  badges: defineEndpoint({
    method: 'get',
    path: '/api/v1/admin/learning/badges',
    response: z.array(AdminBadgeSchema),
  }),
  /**
   * Saves at once; people who already qualify are awarded in the background, silently, and the badge's
   * `backfillStatus`/`backfillDone` show the progress. A bad rule is `CORE-VALIDATION_FAILED`.
   */
  createBadge: defineEndpoint({
    method: 'post',
    path: '/api/v1/admin/learning/badges',
    body: SaveBadgeCommandSchema,
    response: AdminBadgeSchema,
  }),
  /** Edits a badge. Changing the rule of a badge anyone holds is `CORE-VALIDATION_FAILED` (`LOCKED`). */
  updateBadge: defineEndpoint({
    method: 'put',
    path: '/api/v1/admin/learning/badges/{badgeId}',
    params: badgeParams,
    body: SaveBadgeCommandSchema,
    response: AdminBadgeSchema,
  }),
  /** Stops awarding the badge; everyone who holds it keeps it. Repeating the call changes nothing. */
  retireBadge: defineEndpoint({
    method: 'post',
    path: '/api/v1/admin/learning/badges/{badgeId}/retire',
    params: badgeParams,
    response: AdminBadgeSchema,
  }),
  /**
   * The impact report: aggregates for the learners in the caller's scope (system admin, unit admin,
   * instructor, report viewer; anyone else is `CORE-ACCESS_DENIED`). The server decides the scope, so a unit
   * outside it simply gives no learners. No per-person rows.
   */
  impact: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/learning/gamification-impact',
    query: ImpactQuerySchema,
    response: ImpactReportSchema,
  }),
  /** The same figures as `impact`, one row each, as a CSV. */
  exportImpact: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/learning/gamification-impact/export',
    query: ImpactQuerySchema,
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
} as const;
