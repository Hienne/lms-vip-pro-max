import {
  CalendarDayInputSchema,
  type CalendarDay,
  type CalendarDayType,
  type SaveCalendarYearCommand,
} from '@lms/contracts';
import { z } from 'zod';

/** One exception day as typed. */
export interface CalendarFormRow {
  date: string;
  type: CalendarDayType;
  note: string;
}

export interface CalendarFormValue {
  days: CalendarFormRow[];
}

export const CALENDAR_TYPE_LABEL: Record<CalendarDayType, string> = {
  HOLIDAY: 'Ngày nghỉ',
  MAKEUP_WORKDAY: 'Ngày làm bù',
};

export function toCalendarFormValue(
  days: readonly CalendarDay[] | undefined,
): CalendarFormValue {
  return {
    days: (days ?? []).map((day) => ({
      date: day.date,
      type: day.type,
      note: day.note ?? '',
    })),
  };
}

/** The days as the contract's command: a blank note is sent as `null`. */
export function toCalendarCommand(
  value: CalendarFormValue,
): SaveCalendarYearCommand {
  return {
    days: value.days.map((day) => ({
      date: day.date,
      type: day.type,
      note: day.note.trim() === '' ? null : day.note.trim(),
    })),
  };
}

/**
 * The calendar form's rules for one year, with the server's messages: a date in the year, no date twice, a note
 * of at most 200 characters.
 */
export function calendarFormSchema(year: number) {
  return z
    .object({
      days: z.array(
        z.object({ date: z.string(), type: z.string(), note: z.string() }),
      ),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>();
      value.days.forEach((day, index) => {
        const at = (field: string) => ['days', index, field];
        if (!CalendarDayInputSchema.shape.date.safeParse(day.date).success) {
          ctx.addIssue({
            code: 'custom',
            path: at('date'),
            message: 'Chọn ngày.',
          });
        } else if (Number(day.date.slice(0, 4)) !== year) {
          ctx.addIssue({
            code: 'custom',
            path: at('date'),
            message: `Ngày phải thuộc năm ${year}.`,
          });
        } else if (seen.has(day.date)) {
          ctx.addIssue({
            code: 'custom',
            path: at('date'),
            message: 'Ngày này đã có trong lịch.',
          });
        }
        seen.add(day.date);
        if (day.note.trim().length > 200) {
          ctx.addIssue({
            code: 'custom',
            path: at('note'),
            message: 'Ghi chú không quá 200 ký tự.',
          });
        }
      });
    });
}
