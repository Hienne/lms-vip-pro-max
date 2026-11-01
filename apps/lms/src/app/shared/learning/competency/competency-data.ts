import type { MyCompetency } from '@lms/contracts';
import type { RadarDatum } from '@lms/ui';

/** A competency the server gave a percent for. */
export type MyCompetencyWithData = MyCompetency & { readonly percent: number };

/**
 * One radar axis per competency the server returned, at the server's percent. A null percent stays
 * null so the chart shows it as no data; the app never computes a percent.
 */
export function toRadarData(rows: readonly MyCompetency[]): RadarDatum[] {
  return rows.map(({ name, percent }) => ({ name, value: percent }));
}

/** The rows the server sent a percent for. */
export function withData(
  rows: readonly MyCompetency[],
): MyCompetencyWithData[] {
  return rows.filter(
    (row): row is MyCompetencyWithData => row.percent !== null,
  );
}
