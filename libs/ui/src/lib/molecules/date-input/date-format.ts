/** Date and date-time text for a Vietnamese UI: `dd/mm/yyyy` and `dd/mm/yyyy hh:mm`. */
export type DateInputKind = 'date' | 'datetime';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Formats the model value (`yyyy-MM-dd` or `yyyy-MM-ddTHH:mm`) for display; unknown text is returned unchanged. */
export function formatDateInput(value: string, kind: DateInputKind): string {
  if (!value) return '';
  const full = DATETIME.exec(value);
  const day = full ?? DATE.exec(value);
  if (!day) return value;
  const text = `${day[3]}/${day[2]}/${day[1]}`;
  if (kind === 'date') return text;
  return `${text} ${full ? `${full[4]}:${full[5]}` : '00:00'}`;
}

const TYPED =
  /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T]+(\d{1,2})[:h.](\d{2}))?$/;

/**
 * Parses what a person typed into the model value, or `null` when it is not a real date (month 13,
 * 30 February, hour 24). A date-time with no time means 00:00; a date ignores any time typed.
 */
export function parseDateInput(
  text: string,
  kind: DateInputKind,
): string | null {
  const match = TYPED.exec(text.trim());
  if (!match) return null;
  const [day, month, year] = [match[1], match[2], match[3]].map(Number);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  const date = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return kind === 'date' ? date : `${date}T${pad(hour)}:${pad(minute)}`;
}
