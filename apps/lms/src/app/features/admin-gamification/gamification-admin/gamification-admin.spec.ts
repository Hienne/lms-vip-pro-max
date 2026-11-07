import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AdminBadge, CalendarDay, ConfigVersion } from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../core/http/http.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';

const ladder = [
  { level: 1, name: 'Giao dịch viên tập sự', minXp: 0 },
  { level: 2, name: 'Giao dịch viên', minXp: 200 },
  { level: 3, name: 'Chuyên viên', minXp: 600 },
];

const v2: ConfigVersion = {
  versionNo: 2,
  lessonXp: 8,
  quizPassXp: 40,
  firstTryBonusXp: 25,
  firstTryThresholdPercent: 80,
  communityXp: 12,
  communityDailyCap: 36,
  levels: ladder,
  createdBy: '000002',
  createdAt: '2026-11-07T10:35:48Z',
  current: true,
};
const v1: ConfigVersion = {
  ...v2,
  versionNo: 1,
  lessonXp: 5,
  createdBy: null,
  createdAt: null,
  current: false,
};

const year = new Date().getFullYear();
const days: CalendarDay[] = [
  { date: `${year}-01-01`, type: 'HOLIDAY', note: 'Tết Dương lịch' },
  { date: `${year}-02-14`, type: 'MAKEUP_WORKDAY', note: null },
];

const held: AdminBadge = {
  badgeId: 1,
  code: 'FIRST_COURSE',
  name: 'Khóa học đầu tiên',
  description: 'Hoàn thành khóa học đầu tiên của bạn.',
  icon: 'graduation-cap',
  ruleType: 'COURSES_COMPLETED',
  paramN: 1,
  paramProgramId: null,
  programName: null,
  condition: 'Hoàn thành khóa học đầu tiên',
  status: 'active',
  locked: true,
  holders: 42,
  backfillStatus: 'DONE',
  backfillTotal: 42,
  backfillDone: 42,
};
const fresh: AdminBadge = {
  ...held,
  badgeId: 2,
  code: 'COURSES_10',
  name: 'Mười khóa học',
  paramN: 10,
  condition: 'Hoàn thành 10 khóa học',
  locked: false,
  holders: 0,
  backfillStatus: 'RUNNING',
  backfillTotal: 120,
  backfillDone: 40,
};

const BADGES = '/api/v1/admin/learning/badges';
const CONFIG = '/api/v1/admin/learning/gamification/config';
const VERSIONS = `${CONFIG}/versions`;
const CALENDAR = `/api/v1/admin/learning/working-calendar/${year}`;

describe('GamificationAdmin', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  /** The catalogue read the badge form's programme picker waits on; the answer does not matter here. */
  function flushPrograms() {
    backend
      .match((r) => r.url.includes('/training-catalog/programs'))
      .forEach((r) =>
        r.flush(
          envelopeOk({
            items: [],
            page: 0,
            size: 100,
            totalElements: 0,
            totalPages: 0,
          }),
        ),
      );
  }

  async function open(
    calendar: CalendarDay[] = days,
    badges: AdminBadge[] = [held, fresh],
  ) {
    fakeSession().user.set(seedProfile('000002'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/gamification');
    await settle();
    backend.expectOne(CONFIG).flush(envelopeOk(v2));
    backend.expectOne(VERSIONS).flush(envelopeOk([v2, v1]));
    backend.expectOne(CALENDAR).flush(envelopeOk(calendar));
    backend.expectOne(BADGES).flush(envelopeOk(badges));
    flushPrograms();
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) =>
        b.textContent?.includes(label) ||
        b.getAttribute('aria-label')?.includes(label),
    );
  const tab = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
      t.textContent?.includes(label),
    );
  const field = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('ui-field'))
      .find((f) => f.querySelector('label')?.textContent?.includes(label))
      ?.querySelector('input, select') as HTMLInputElement;
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

  async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  it('starts the form from the version in force, with its ladder', async () => {
    await open();
    expect(el.querySelector('h1')?.textContent).toBe('Cấu hình gamification');
    expect(field('Hoàn thành bài học').value).toBe('8');
    expect(field('Ngưỡng điểm để được thưởng').value).toBe('80');
    expect(field('Tên cấp 2').value).toBe('Giao dịch viên');
    expect(field('Từ XP (cấp 3)').value).toBe('600');
  });

  it('saves the weights and the ladder as one new version', async () => {
    await open();
    await type(field('Hoàn thành bài học'), '9');
    await type(field('Tên cấp 3'), 'Chuyên viên chính');
    button('Lưu phiên bản mới')?.click();
    await settle();

    const request = backend.expectOne(CONFIG);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      lessonXp: 9,
      quizPassXp: 40,
      firstTryBonusXp: 25,
      firstTryThresholdPercent: 80,
      communityXp: 12,
      communityDailyCap: 36,
      levels: [
        { name: 'Giao dịch viên tập sự', minXp: 0 },
        { name: 'Giao dịch viên', minXp: 200 },
        { name: 'Chuyên viên chính', minXp: 600 },
      ],
    });
    request.flush(envelopeOk({ ...v2, versionNo: 3, lessonXp: 9 }));
    await settle();
    // The accepted save reloads what the server now holds.
    backend.expectOne(CONFIG).flush(envelopeOk({ ...v2, versionNo: 3 }));
    backend.expectOne(VERSIONS).flush(envelopeOk([v2, v1]));
    await settle();
  });

  it('shows the same messages as the server and sends nothing for a bad ladder', async () => {
    await open();
    await type(field('Từ XP (cấp 1)'), '5');
    await type(field('Từ XP (cap 2)'.replace('cap', 'cấp')), '5');
    await type(field('Hoàn thành bài học'), '');
    button('Lưu phiên bản mới')?.click();
    await settle();

    backend.expectNone(CONFIG);
    expect(text()).toContain('Cấp đầu tiên phải từ 0 XP.');
    expect(text()).toContain('Ngưỡng XP phải lớn hơn cấp trước.');
    expect(text()).toContain('Nhập số XP cho bài học.');
  });

  it('asks for a name on every level before sending', async () => {
    await open();
    await type(field('Tên cấp 3'), ' ');
    button('Lưu phiên bản mới')?.click();
    await settle();

    backend.expectNone(CONFIG);
    expect(text()).toContain('Cần nhập tên cấp.');
  });

  it('adds and removes ladder levels, keeping at least one', async () => {
    await open();
    button('Thêm cấp')?.click();
    await settle();
    expect(field('Tên cấp 4')).toBeTruthy();
    expect(field('Từ XP (cấp 4)').value).toBe('700');
    button('Xóa cấp 4')?.click();
    await settle();
    expect(field('Tên cấp 4')).toBeUndefined();
  });

  it('lists every version with its author and marks the one in force', async () => {
    await open();
    tab('Lịch sử phiên bản')?.click();
    await settle();
    const rows = el.querySelectorAll('[uiTabPanel="history"] tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Đang áp dụng');
    expect(rows[0].textContent).toContain('000002');
    expect(rows[1].textContent).toContain('Mặc định của hệ thống');
  });

  it('replaces the year’s days with the edited list', async () => {
    await open();
    tab('Lịch nghỉ')?.click();
    await settle();
    expect(text()).toContain(`Năm ${year}`);
    expect(field('Ngày 1').value).toBe(`${year}-01-01`);
    expect(field('Ghi chú 1').value).toBe('Tết Dương lịch');
    expect(field('Loại ngày 2').value).toBe('MAKEUP_WORKDAY');

    button('Xóa ngày 1')?.click();
    await settle();
    button('Thêm ngày')?.click();
    await settle();
    await type(field('Ngày 2'), `${year}-09-02`);
    await type(field('Ghi chú 2'), 'Quốc khánh');
    button(`Lưu lịch năm ${year}`)?.click();
    await settle();

    const request = backend.expectOne(CALENDAR);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      days: [
        { date: `${year}-02-14`, type: 'MAKEUP_WORKDAY', note: null },
        { date: `${year}-09-02`, type: 'HOLIDAY', note: 'Quốc khánh' },
      ],
    });
    request.flush(envelopeOk([]));
    await settle();
    backend.expectOne(CALENDAR).flush(envelopeOk([]));
    await settle();
  });

  it('refuses a date outside the year or twice in the calendar before sending', async () => {
    await open();
    tab('Lịch nghỉ')?.click();
    await settle();
    await type(field('Ngày 1'), `${year + 1}-01-01`);
    await type(field('Ngày 2'), `${year}-01-05`);
    button('Thêm ngày')?.click();
    await settle();
    await type(field('Ngày 3'), `${year}-01-05`);
    button(`Lưu lịch năm ${year}`)?.click();
    await settle();
    backend.expectNone(CALENDAR);
    expect(text()).toContain(`Ngày phải thuộc năm ${year}.`);
    expect(text()).toContain('Ngày này đã có trong lịch.');
  });

  it('steps to another year and reads that year’s calendar', async () => {
    await open();
    tab('Lịch nghỉ')?.click();
    await settle();
    button('Năm sau')?.click();
    await settle();
    backend
      .expectOne(`/api/v1/admin/learning/working-calendar/${year + 1}`)
      .flush(envelopeOk([]));
    await settle();
    expect(text()).toContain(`Năm ${year + 1}`);
  });

  it('tells a caller who is not a system admin that it is refused, without a retry', async () => {
    fakeSession().user.set(seedProfile('000002'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/gamification');
    await settle();
    const denied = backendRefusal('accessDenied');
    backend
      .expectOne(CONFIG)
      .flush(denied.body, { status: denied.status, statusText: 'Forbidden' });
    backend.expectOne(VERSIONS).flush(envelopeOk([]));
    backend.expectOne(CALENDAR).flush(envelopeOk([]));
    backend.expectOne(BADGES).flush(envelopeOk([]));
    flushPrograms();
    await settle();
    el = harness.routeNativeElement as HTMLElement;
    expect(text()).toContain('Không tải được cấu hình');
    expect(el.querySelector('form')).toBeNull();
  });

  describe('badges', () => {
    /** A field of the badge form, by its exact label (the tabs all render at once). */
    const badgeField = (label: string) =>
      Array.from(el.querySelectorAll<HTMLElement>('app-badge-admin ui-field'))
        .find(
          (f) =>
            f.querySelector('label')?.textContent?.replace('*', '').trim() ===
            label,
        )
        ?.querySelector('input, select') as HTMLInputElement | undefined;
    const rows = () =>
      Array.from(el.querySelectorAll('app-badge-admin tbody tr'));
    const answer = (label: string) =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[role="alertdialog"] button',
        ),
      )
        .find((b) => b.textContent?.trim() === label)
        ?.click();

    it('lists badges with holders and the progress of the background award', async () => {
      await open();
      tab('Huy hiệu')?.click();
      await settle();
      expect(rows()).toHaveLength(2);
      expect(rows()[0].textContent).toContain('42');
      expect(rows()[0].textContent).toContain('Đã xong');
      expect(rows()[1].textContent).toContain('40/120 người');
    });

    it('reads the list again while a badge is still being awarded', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      try {
        await open();
        tab('Huy hiệu')?.click();
        await settle();
        vi.advanceTimersByTime(2100);
        await settle();
        backend.expectOne(BADGES).flush(
          envelopeOk([
            held,
            {
              ...fresh,
              holders: 120,
              backfillDone: 120,
              backfillStatus: 'DONE',
            },
          ]),
        );
        await settle();
        expect(rows()[1].textContent).toContain('Đã xong (120 người)');
      } finally {
        vi.useRealTimers();
      }
    });

    it('creates a badge and the list shows it at once', async () => {
      await open();
      tab('Huy hiệu')?.click();
      await settle();
      button('Tạo huy hiệu')?.click();
      await settle();
      await type(badgeField('Tên huy hiệu')!, 'Đúng hẹn');
      await type(badgeField('Mô tả')!, 'Hoàn thành đúng hạn.');
      await type(badgeField('N')!, '3');
      button('Tạo huy hiệu')?.click();
      await settle();

      const request = backend.expectOne(BADGES);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        name: 'Đúng hẹn',
        description: 'Hoàn thành đúng hạn.',
        icon: 'award',
        ruleType: 'COURSES_COMPLETED',
        paramN: 3,
        paramProgramId: null,
      });
      request.flush(
        envelopeOk({ ...fresh, badgeId: 3, name: 'Đúng hẹn', paramN: 3 }),
      );
      await settle();
      backend.expectOne(BADGES).flush(envelopeOk([held, fresh]));
      await settle();
      expect(rows()).toHaveLength(2);
    });

    it('sends nothing for a badge without a name or with N out of range', async () => {
      await open();
      tab('Huy hiệu')?.click();
      await settle();
      button('Tạo huy hiệu')?.click();
      await settle();
      await type(badgeField('N')!, '0');
      button('Tạo huy hiệu')?.click();
      await settle();
      backend.expectNone(BADGES);
      expect(text()).toContain('Cần nhập tên huy hiệu.');
      expect(text()).toContain('Ngưỡng từ 1 đến 1000.');
    });

    it('shows the rule of a held badge read-only', async () => {
      await open();
      tab('Huy hiệu')?.click();
      await settle();
      button('Sửa')?.click();
      await settle();
      expect(badgeField('Luật nhận')).toBeUndefined();
      expect(badgeField('N')).toBeUndefined();
      expect(text()).toContain('luật nhận không đổi được');
      expect(badgeField('Tên huy hiệu')?.value).toBe('Khóa học đầu tiên');
    });

    it('asks before retiring and says holders keep the badge', async () => {
      await open();
      tab('Huy hiệu')?.click();
      await settle();
      button('Ngừng dùng')?.click();
      await settle();
      const dialog = document.querySelector('[role="alertdialog"]');
      expect(dialog?.textContent).toContain(
        '42 người đã nhận vẫn giữ huy hiệu',
      );
      answer('Ngừng dùng');
      await settle();

      const request = backend.expectOne(`${BADGES}/1/retire`);
      expect(request.request.method).toBe('POST');
      request.flush(envelopeOk({ ...held, status: 'retired' }));
      await settle();
      backend
        .expectOne(BADGES)
        .flush(envelopeOk([{ ...held, status: 'retired' }, fresh]));
      await settle();
      expect(rows()[0].textContent).toContain('Đã ngừng dùng');
    });
  });
});
