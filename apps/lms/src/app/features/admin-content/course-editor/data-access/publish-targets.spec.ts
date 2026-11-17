import type { TargetPick } from '../../../../shared/assignment-target/target-labels';
import {
  countsText,
  dateInput,
  namesPublishRow,
  refusedRows,
  rowIssue,
  toPublishCommand,
  type PublishRow,
  type PublishTargets,
} from './publish-targets';

const org = (orgId: number): TargetPick => ({
  targetType: 'org',
  orgId,
  includeDescendants: true,
  label: 'Ban',
});

const row = (id: number, extra: Partial<PublishRow> = {}): PublishRow => ({
  id,
  pick: org(1),
  startDate: '2026-11-04',
  dueDate: '',
  ...extra,
});

const targets = (
  rows: PublishRow[],
  extra: Partial<PublishTargets> = {},
): PublishTargets => ({
  rows,
  reminderEnabled: true,
  shareOrgIds: [],
  ...extra,
});

describe('publish targets', () => {
  it('formats a date as the date input reads it', () => {
    expect(dateInput(new Date(2026, 10, 4, 23, 30).getTime())).toBe(
      '2026-11-04',
    );
  });

  describe('what a row check finds', () => {
    it('accepts a row with no due date, with a due date on the start day, and after it', () => {
      expect(rowIssue(row(0), 0)).toBeUndefined();
      expect(rowIssue(row(0, { dueDate: '2026-11-04' }), 0)).toBeUndefined();
      expect(rowIssue(row(0, { dueDate: '2026-12-04' }), 0)).toBeUndefined();
    });

    it('says which line has a due date before the start', () => {
      expect(rowIssue(row(0, { dueDate: '2026-11-03' }), 1)).toBe(
        'Dòng 2: hạn phải sau ngày bắt đầu.',
      );
    });

    it('asks for a start date and for a target', () => {
      expect(rowIssue(row(0, { startDate: '' }), 0)).toBe(
        'Dòng 1: chọn ngày bắt đầu.',
      );
      expect(
        rowIssue(
          row(0, { pick: { targetType: 'team', label: '?' } as TargetPick }),
          2,
        ),
      ).toBe('Dòng 3: chọn đối tượng.');
    });
  });

  describe('the publish body', () => {
    it('is the version alone with nothing to assign or share', () => {
      expect(toPublishCommand(3, targets([]))).toEqual({ expectedVersion: 3 });
    });

    it('carries the review confirmation only when it is given', () => {
      expect(toPublishCommand(3, targets([]), true)).toEqual({
        expectedVersion: 3,
        reviewConfirmed: true,
      });
      expect(toPublishCommand(3, targets([]), false)).toEqual({
        expectedVersion: 3,
      });
    });

    it('carries a row without its label, with the dates as instants', () => {
      const body = toPublishCommand(
        3,
        targets([row(0, { dueDate: '2026-12-04' })], { shareOrgIds: [7] }),
      );
      expect(body.shareOrgIds).toEqual([7]);
      expect(body.assignments).toEqual([
        {
          startAt: new Date('2026-11-04T00:00:00').toISOString(),
          dueAt: new Date('2026-12-04T17:00:00').toISOString(),
          reminderEnabled: true,
          reminderDaysBefore: 3,
          target: { targetType: 'org', orgId: 1, includeDescendants: true },
        },
      ]);
    });

    it('leaves the due date out, and the reminder off, for a row without one', () => {
      const [only] = toPublishCommand(0, targets([row(0)])).assignments ?? [];
      expect(only).not.toHaveProperty('dueAt');
      expect(only.reminderEnabled).toBe(false);
    });

    it('turns every reminder off with the switch', () => {
      const body = toPublishCommand(
        0,
        targets([row(0, { dueDate: '2026-12-04' })], {
          reminderEnabled: false,
        }),
      );
      expect(body.assignments?.[0].reminderEnabled).toBe(false);
    });
  });

  describe('a refusal', () => {
    const sent = targets([row(10), row(11)], { shareOrgIds: [4, 5] });
    const errors = [
      { field: 'assignments[1]', code: 'X', message: 'Dòng hai' },
      { field: 'shareOrgIds[0]', code: 'Y', message: 'Đơn vị bốn' },
      { field: 'expectedVersion', code: 'Z', message: 'Khác' },
    ];

    it('is mapped back to the row and the unit it names, by id', () => {
      const refused = refusedRows(errors, sent);
      expect([...refused.rows]).toEqual([[11, 'Dòng hai']]);
      expect([...refused.shares]).toEqual([[4, 'Đơn vị bốn']]);
    });

    it('ignores a row index the publish did not send', () => {
      const refused = refusedRows(
        [{ field: 'assignments[9]', code: 'X', message: 'm' }],
        sent,
      );
      expect(refused.rows.size).toBe(0);
    });

    it('is told from a refusal of something else', () => {
      expect(namesPublishRow(errors)).toBe(true);
      expect(namesPublishRow([errors[2]])).toBe(false);
      expect(namesPublishRow(undefined)).toBe(false);
    });
  });

  it('words the counts as the confirmation does', () => {
    expect(countsText(2, 1)).toBe(
      '2 đối tượng được giao, 1 đơn vị được chia sẻ.',
    );
  });
});
