import {
  publishRowOf,
  type FieldError,
  type PublishAssignment,
  type PublishCourseCommand,
} from '@lms/contracts';
import {
  toTargetInput,
  type TargetPick,
} from '../../../../shared/assignment-target/target-labels';

/** The reminder the mockup's step 4 switch turns on: days before the due date. */
export const REMIND_DAYS = 3;

/** A due date ends at the close of the working day, as on the assignments screen. */
const DUE_TIME = 'T17:00:00';

/** One assignment row of step 4: a picked target with its own dates (`yyyy-mm-dd`). */
export interface PublishRow {
  readonly id: number;
  readonly pick: TargetPick;
  readonly startDate: string;
  /** Empty when the assignment has no due date. */
  readonly dueDate: string;
  /** The server's refusal of this row, until the row changes or the next publish. */
  readonly error?: string;
}

/** What a publish carries beyond the draft, as it stood when the author confirmed. */
export interface PublishTargets {
  readonly rows: readonly PublishRow[];
  readonly reminderEnabled: boolean;
  readonly shareOrgIds: readonly number[];
}

/** A local date as the date input's value. */
export function dateInput(time: number): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const toInstant = (date: string, time: string): string =>
  new Date(`${date}${time}`).toISOString();

/** True when the pick names the id its type needs. */
const hasTarget = ({ pick }: PublishRow): boolean => {
  switch (pick.targetType) {
    case 'user':
      return !!pick.userId;
    case 'team':
      return !!pick.teamId;
    case 'org':
      return !!pick.orgId;
    case 'learning_group':
      return !!pick.groupId;
  }
};

/**
 * What a form can know about a row: a target, a start and a due date that is not before it. The
 * server decides the rest (scope, learners, limits).
 */
export function rowIssue(row: PublishRow, index: number): string | undefined {
  const line = `Dòng ${index + 1}`;
  if (!hasTarget(row)) return `${line}: chọn đối tượng.`;
  if (!row.startDate) return `${line}: chọn ngày bắt đầu.`;
  if (row.dueDate && row.dueDate < row.startDate) {
    return `${line}: hạn phải sau ngày bắt đầu.`;
  }
  return undefined;
}

function toPublishAssignment(
  row: PublishRow,
  reminderEnabled: boolean,
): PublishAssignment {
  return {
    startAt: toInstant(row.startDate, 'T00:00:00'),
    ...(row.dueDate ? { dueAt: toInstant(row.dueDate, DUE_TIME) } : {}),
    // A reminder counts down to a due date; without one there is nothing to remind of.
    reminderEnabled: reminderEnabled && !!row.dueDate,
    reminderDaysBefore: REMIND_DAYS,
    target: toTargetInput(row.pick),
  };
}

/** The publish body: `{ expectedVersion }` alone when there is nothing to assign or share. */
export function toPublishCommand(
  expectedVersion: number,
  { rows, reminderEnabled, shareOrgIds }: PublishTargets,
): PublishCourseCommand {
  return {
    expectedVersion,
    ...(rows.length
      ? {
          assignments: rows.map((row) =>
            toPublishAssignment(row, reminderEnabled),
          ),
        }
      : {}),
    ...(shareOrgIds.length ? { shareOrgIds: [...shareOrgIds] } : {}),
  };
}

/** The refused rows and shares an answer names, by the row id and the org id it was sent for. */
export function refusedRows(
  errors: readonly FieldError[],
  targets: PublishTargets,
): { rows: Map<number, string>; shares: Map<number, string> } {
  const rows = new Map<number, string>();
  const shares = new Map<number, string>();
  for (const { field, message } of errors) {
    const at = publishRowOf(field);
    if (!at) continue;
    if (at.kind === 'assignments') {
      const row = targets.rows[at.index];
      if (row) rows.set(row.id, message);
    } else {
      const orgId = targets.shareOrgIds[at.index];
      if (orgId !== undefined) shares.set(orgId, message);
    }
  }
  return { rows, shares };
}

/** True when an answer's per-field errors name a row or a share of the publish. */
export const namesPublishRow = (errors: readonly FieldError[] | undefined) =>
  !!errors?.some(({ field }) => publishRowOf(field));

/** "{n} đối tượng được giao, {m} đơn vị được chia sẻ." */
export const countsText = (assigned: number, shared: number): string =>
  `${assigned} đối tượng được giao, ${shared} đơn vị được chia sẻ.`;
