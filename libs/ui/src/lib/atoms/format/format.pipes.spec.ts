import { TestBed } from '@angular/core/testing';
import {
  FmtBytesPipe,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtDaysLeftPipe,
  FmtMinutesPipe,
  FmtNumPipe,
  FmtPctPipe,
  FmtRelativePipe,
  FmtScorePipe,
  FmtTimePipe,
} from './format.pipes';
import { NOW } from './now';

// Local-time constructors keep the expectations independent of the machine's time zone.
const FIXED_NOW = new Date(2026, 9, 13, 12, 0, 0).getTime();
const ago = (ms: number) => new Date(FIXED_NOW - ms);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pipe<T>(type: new () => T): T {
  TestBed.configureTestingModule({
    providers: [{ provide: NOW, useValue: () => FIXED_NOW }, type, FmtDatePipe],
  });
  return TestBed.inject(type);
}

describe('fmtNum', () => {
  it.each([
    [1234567, '1.234.567'],
    [1234.5, '1.235'],
    [0, '0'],
    [null, '0'],
    [undefined, '0'],
  ])('%s → %s', (value, text) => {
    expect(pipe(FmtNumPipe).transform(value)).toBe(text);
  });
});

describe('fmtPct', () => {
  it.each([
    [72.4, '72%'],
    [72.5, '73%'],
    [0, '0%'],
    [null, '0%'],
  ])('%s → %s', (value, text) => {
    expect(pipe(FmtPctPipe).transform(value)).toBe(text);
  });
});

describe('fmtScore', () => {
  it.each([
    [8.55, '8,6'],
    [8, '8'],
    [0, '0'],
    [null, '—'],
    [undefined, '—'],
  ])('%s → %s', (value, text) => {
    expect(pipe(FmtScorePipe).transform(value)).toBe(text);
  });
});

describe('fmtDate', () => {
  it('formats dd/mm/yyyy from a Date, a timestamp and an ISO string', () => {
    const date = new Date(2026, 2, 5, 9, 7);
    const p = pipe(FmtDatePipe);
    expect(p.transform(date)).toBe('05/03/2026');
    expect(p.transform(date.getTime())).toBe('05/03/2026');
    expect(p.transform(date.toISOString())).toBe('05/03/2026');
  });

  it.each([null, undefined, ''])('empty %j → —', (value) => {
    expect(pipe(FmtDatePipe).transform(value)).toBe('—');
  });
});

describe('fmtDatetime', () => {
  it('formats date and 24h time', () => {
    expect(pipe(FmtDatetimePipe).transform(new Date(2026, 2, 5, 9, 7))).toBe(
      '09:07 05/03/2026',
    );
  });

  it.each([null, undefined, ''])('empty %j → —', (value) => {
    expect(pipe(FmtDatetimePipe).transform(value)).toBe('—');
  });
});

describe('fmtTime', () => {
  it.each([
    [0, '00:00'],
    [59, '00:59'],
    [61, '01:01'],
    [3600, '60:00'],
    [59.6, '01:00'],
    [-5, '00:00'],
    [null, '00:00'],
  ])('%s s → %s', (value, text) => {
    expect(pipe(FmtTimePipe).transform(value)).toBe(text);
  });
});

describe('fmtMinutes', () => {
  it.each([
    [0, '0 phút'],
    [null, '0 phút'],
    [59, '59 phút'],
    [59.6, '1 giờ'],
    [60, '1 giờ'],
    [90, '1g 30p'],
    [125, '2g 5p'],
    [180, '3 giờ'],
  ])('%s → %s', (value, text) => {
    expect(pipe(FmtMinutesPipe).transform(value)).toBe(text);
  });
});

describe('fmtBytes', () => {
  it.each([
    [0, '1 KB'],
    [null, '1 KB'],
    [100, '1 KB'],
    [1536, '2 KB'],
    [1048576, '1024 KB'],
    [1048577, '1.0 MB'],
    [5 * 1048576, '5.0 MB'],
    [1572864 + 1, '1.5 MB'],
  ])('%s → %s', (value, text) => {
    expect(pipe(FmtBytesPipe).transform(value)).toBe(text);
  });
});

describe('fmtRelative', () => {
  it.each([
    [ago(0), 'vừa xong'],
    [ago(59 * SECOND), 'vừa xong'],
    [ago(60 * SECOND), '1 phút trước'],
    [ago(59 * MINUTE + 59 * SECOND), '59 phút trước'],
    [ago(HOUR), '1 giờ trước'],
    [ago(23 * HOUR + 59 * MINUTE), '23 giờ trước'],
    [ago(DAY), '1 ngày trước'],
    [ago(29 * DAY), '29 ngày trước'],
  ])('%s → %s', (value, text) => {
    expect(pipe(FmtRelativePipe).transform(value)).toBe(text);
  });

  it('falls back to the date at 30 days', () => {
    const thirtyDaysAgo = ago(30 * DAY);
    const p = pipe(FmtRelativePipe);
    expect(p.transform(thirtyDaysAgo)).toBe(
      TestBed.inject(FmtDatePipe).transform(thirtyDaysAgo),
    );
    expect(p.transform(thirtyDaysAgo)).toBe('13/09/2026');
  });

  it.each([null, undefined, ''])('empty %j → —', (value) => {
    expect(pipe(FmtRelativePipe).transform(value)).toBe('—');
  });

  it('reads the injected clock', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NOW, useValue: () => FIXED_NOW + 2 * HOUR },
        FmtRelativePipe,
      ],
    });
    expect(TestBed.inject(FmtRelativePipe).transform(new Date(FIXED_NOW))).toBe(
      '2 giờ trước',
    );
  });
});

describe('fmtDaysLeft', () => {
  it.each([
    [new Date(FIXED_NOW), 0],
    [new Date(FIXED_NOW + 1), 1],
    [new Date(FIXED_NOW + DAY), 1],
    [new Date(FIXED_NOW + DAY + 1), 2],
    [new Date(FIXED_NOW + 7 * DAY), 7],
    [new Date(FIXED_NOW - DAY), -1],
  ])('%s → %s', (value, days) => {
    expect(pipe(FmtDaysLeftPipe).transform(value)).toBe(days);
  });

  it.each([null, undefined, ''])('empty %j → null', (value) => {
    expect(pipe(FmtDaysLeftPipe).transform(value)).toBeNull();
  });
});

describe('NOW', () => {
  it('defaults to Date.now', () => {
    TestBed.configureTestingModule({});
    const before = Date.now();
    const value = TestBed.inject(NOW)();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(Date.now());
  });
});
