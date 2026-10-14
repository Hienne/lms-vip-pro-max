import { inject, Pipe, type PipeTransform } from '@angular/core';
import { NOW } from './now';

/** Ports of the mockup's `fmt.*` helpers: `vi-VN`, and `—` where a value is empty. */
type DateInput = Date | string | number | null | undefined;

const EMPTY = '—';
const LOCALE = 'vi-VN';
const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86400;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const RELATIVE_LIMIT_DAYS = 30;
const DATE_OPTIONS = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
} as const;

const numberFormat = new Intl.NumberFormat(LOCALE);

function toTime(value: NonNullable<DateInput>): number {
  return new Date(value).getTime();
}

function formatDate(value: DateInput): string {
  return value
    ? new Date(value).toLocaleDateString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : EMPTY;
}

@Pipe({ name: 'fmtNum' })
export class FmtNumPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return numberFormat.format(Math.round(value || 0));
  }
}

@Pipe({ name: 'fmtPct' })
export class FmtPctPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return `${Math.round(value || 0)}%`;
  }
}

@Pipe({ name: 'fmtScore' })
export class FmtScorePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null
      ? EMPTY
      : (Math.round(value * 10) / 10).toLocaleString(LOCALE);
  }
}

@Pipe({ name: 'fmtDate' })
export class FmtDatePipe implements PipeTransform {
  transform(value: DateInput): string {
    return formatDate(value);
  }
}

@Pipe({ name: 'fmtDatetime' })
export class FmtDatetimePipe implements PipeTransform {
  transform(value: DateInput): string {
    return value
      ? new Date(value).toLocaleString(LOCALE, {
          ...DATE_OPTIONS,
          hour: '2-digit',
          minute: '2-digit',
        })
      : EMPTY;
  }
}

/** Seconds → `mm:ss`. */
@Pipe({ name: 'fmtTime' })
export class FmtTimePipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    const total = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(total / MINUTE_S);
    const s = total % MINUTE_S;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

@Pipe({ name: 'fmtMinutes' })
export class FmtMinutesPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const min = Math.round(value || 0);
    if (min < MINUTE_S) return `${min} phút`;
    const h = Math.floor(min / MINUTE_S);
    const m = min % MINUTE_S;
    return m ? `${h}g ${m}p` : `${h} giờ`;
  }
}

@Pipe({ name: 'fmtBytes' })
export class FmtBytesPipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    const b = bytes || 0;
    return b > BYTES_PER_MB
      ? `${(b / BYTES_PER_MB).toFixed(1)} MB`
      : `${Math.max(1, Math.round(b / BYTES_PER_KB))} KB`;
  }
}

/** Time since `value`, falling back to the date from 30 days on. Reads `NOW`. */
@Pipe({ name: 'fmtRelative' })
export class FmtRelativePipe implements PipeTransform {
  private readonly now = inject(NOW);

  transform(value: DateInput): string {
    if (!value) return EMPTY;
    const diff = (this.now() - toTime(value)) / 1000;
    if (diff < MINUTE_S) return 'vừa xong';
    if (diff < HOUR_S) return `${Math.floor(diff / MINUTE_S)} phút trước`;
    if (diff < DAY_S) return `${Math.floor(diff / HOUR_S)} giờ trước`;
    if (diff < DAY_S * RELATIVE_LIMIT_DAYS)
      return `${Math.floor(diff / DAY_S)} ngày trước`;
    return formatDate(value);
  }
}

/** Whole days until `value`, rounded up; negative once past; `null` when empty. Reads `NOW`. */
@Pipe({ name: 'fmtDaysLeft' })
export class FmtDaysLeftPipe implements PipeTransform {
  private readonly now = inject(NOW);

  transform(value: DateInput): number | null {
    if (!value) return null;
    return Math.ceil((toTime(value) - this.now()) / (DAY_S * 1000));
  }
}
