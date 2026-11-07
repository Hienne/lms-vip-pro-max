import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { backendRefusal, envelopeOk, seedMe } from '@lms/mocks';
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

const ME_URL = '/api/v1/auth/me';
const PASSWORD_URL = '/api/v1/auth/password';
const LEVEL_URL = '/api/v1/me/learning/level';
const BADGES_URL = '/api/v1/me/learning/badges';
const PREFERENCES_URL = '/api/v1/me/learning/preferences';

const BADGE = {
  badgeId: 1,
  name: 'Khóa học đầu tiên',
  description: 'Hoàn thành khóa học đầu tiên của bạn.',
  icon: 'graduation-cap',
  condition: 'Hoàn thành khóa học đầu tiên',
  earnedAt: '2026-11-03T04:12:00Z',
  retired: false,
  progress: null,
};

const BADGES = {
  earned: [BADGE],
  notEarned: [
    {
      badgeId: 2,
      name: 'Thành thạo Tiền gửi',
      description: 'Hoàn thành mọi khóa học của chương trình Tiền gửi.',
      icon: 'route',
      condition: 'Hoàn thành mọi khóa học của chương trình Tiền gửi',
      earnedAt: null,
      retired: false,
      progress: { done: 1, total: 4 },
    },
    {
      badgeId: 3,
      name: 'Huy hiệu lạ',
      description: 'Biểu tượng admin chọn mà ứng dụng chưa có.',
      icon: 'skateboard',
      condition: 'Hoàn thành 3 khóa học được giao trước hạn',
      earnedAt: null,
      retired: false,
      progress: null,
    },
  ],
};

const LEVEL = {
  level: 2,
  name: 'Giao dịch viên',
  xp: 300,
  xpToNext: 300,
  progressPercent: 25,
};

describe('Profile', () => {
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
  beforeEach(() => {
    level = LEVEL;
    badges = BADGES;
  });
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = ''));
    backend.verify();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  /** The level the server answers a learner; null once to answer with a refusal. */
  let level: object | null = LEVEL;
  /** The badges the server answers a learner; null to answer with a refusal. */
  let badges: object | null = BADGES;
  /** Whether the learner shows on leaderboards, as the server last answered. */
  let showOnLeaderboard = true;

  async function open(userId = '000005', change?: object) {
    fakeSession().user.set({ ...seedProfile(userId), ...change });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/profile');
    await settle();
    for (const request of backend.match(LEVEL_URL)) {
      if (level) request.flush(envelopeOk(level));
      else
        request.flush(backendRefusal('accessDenied').body, {
          status: 403,
          statusText: 'Forbidden',
        });
    }
    for (const request of backend.match(BADGES_URL)) {
      if (badges) request.flush(envelopeOk(badges));
      else
        request.flush(backendRefusal('accessDenied').body, {
          status: 403,
          statusText: 'Forbidden',
        });
    }
    await answerPreferences();
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function answerPreferences() {
    await settle();
    for (const request of backend.match(
      (r) => r.url === PREFERENCES_URL && r.method === 'GET',
    )) {
      request.flush(envelopeOk({ showOnLeaderboard }));
    }
    await settle();
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const input = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('ui-field'))
      .find((f) => f.textContent?.includes(label))
      ?.querySelector<HTMLInputElement>('input') as HTMLInputElement;

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  const submitOf = (title: string) =>
    Array.from(el.querySelectorAll('section'))
      .find((s) => s.textContent?.includes(title))
      ?.querySelector<HTMLButtonElement>('button[type="submit"]');

  it('shows who is signed in, with the organisation, the grants and the screens the backend opens', async () => {
    await open('000005');
    const user = seedProfile('000005');
    expect(el.querySelector('h1')?.textContent).toBe('Hồ sơ cá nhân');
    expect(text()).toContain(user.fullName);
    expect(text()).toContain('Mã cán bộ 000005');
    expect(text()).toContain(user.org?.name);
    expect(text()).toContain('Giảng viên · Đơn vị');
    expect(text()).toContain('Học viên · Cá nhân');
    expect(text()).toContain('Báo cáo');
    expect(input('Họ và tên').value).toBe(user.fullName);
  });

  it('shows the learner level with its XP, the XP still needed and the note that levels unlock nothing', async () => {
    await open('000004');
    const section = el.querySelector('.profile__level') as HTMLElement;
    expect(section.textContent).toContain('Cấp độ');
    expect(section.textContent).toContain('Giao dịch viên');
    expect(section.textContent).toContain('300 XP');
    expect(section.textContent).toContain('Còn 300 XP để lên cấp kế tiếp');
    expect(section.textContent).toContain('không mở thêm quyền');
    expect(
      section
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('25');
  });

  it('shows no bar at the top level', async () => {
    level = {
      ...LEVEL,
      level: 6,
      name: 'Chuyên gia Core Banking',
      xp: 7200,
      xpToNext: null,
      progressPercent: null,
    };
    await open('000004');
    const section = el.querySelector('.profile__level') as HTMLElement;
    expect(section.textContent).toContain('Chuyên gia Core Banking');
    expect(section.textContent).toContain('cấp cao nhất');
    expect(section.querySelector('[role="progressbar"]')).toBeNull();
  });

  describe('the badge grid', () => {
    const names = (label: string) =>
      Array.from(el.querySelectorAll(`[aria-label="${label}"] li`)).map((li) =>
        li.textContent?.replace(/\s+/g, ' ').trim(),
      );

    it('lists the earned badges, then the ones not yet earned with their condition', async () => {
      await open('000004');
      expect(names('Huy hiệu đã đạt')).toEqual([
        'Khóa học đầu tiênHoàn thành khóa học đầu tiên của bạn.Đạt ngày 03/11/2026',
      ]);
      const pending = names('Huy hiệu chưa đạt');
      expect(pending).toHaveLength(2);
      expect(pending[0]).toContain(
        'Hoàn thành mọi khóa học của chương trình Tiền gửi',
      );
      expect(pending[1]).toContain('Hoàn thành 3 khóa học được giao trước hạn');
    });

    it('shows "x/y khóa" on a programme badge only, and no percentage bar', async () => {
      await open('000004');
      expect(names('Huy hiệu chưa đạt')[0]).toContain('1/4 khóa');
      expect(names('Huy hiệu chưa đạt')[1]).not.toContain('khóa ·');
      expect(el.querySelector('.profile__badges ui-progress')).toBeNull();
      expect(text()).not.toMatch(/\d+% /);
    });

    it('dims the badges not yet earned and not the earned ones', async () => {
      await open('000004');
      expect(el.querySelectorAll('.profile__badge--pending')).toHaveLength(2);
      expect(el.querySelectorAll('.profile__badge')).toHaveLength(3);
    });

    it('shows a Lucide icon for each badge, with a fallback for one the app does not bundle', async () => {
      await open('000004');
      const icons = Array.from(el.querySelectorAll('.profile__badges ui-icon'));
      expect(icons).toHaveLength(3);
      expect(icons.every((icon) => icon.querySelector('svg'))).toBe(true);
    });

    it('marks a retired badge a learner kept', async () => {
      badges = { earned: [{ ...BADGE, retired: true }], notEarned: [] };
      await open('000004');
      expect(text()).toContain('Huy hiệu đã ngừng cấp');
      expect(el.querySelector('[aria-label="Huy hiệu chưa đạt"]')).toBeNull();
    });

    it('says so when nothing is earned yet', async () => {
      badges = { earned: [], notEarned: BADGES.notEarned };
      await open('000004');
      expect(text()).toContain('Bạn chưa đạt huy hiệu nào.');
    });

    it('shows no badges to someone who is not a learner and asks for none', async () => {
      await open('000001');
      expect(el.querySelector('.profile__badges')).toBeNull();
    });
  });

  describe('the leaderboard choice', () => {
    const toggle = () =>
      el.querySelector<HTMLInputElement>('.profile__preferences input')!;

    beforeEach(() => (showOnLeaderboard = true));

    it('shows a switch that is on by default, with what turning it off does', async () => {
      await open('000004');
      expect(toggle().checked).toBe(true);
      expect(toggle().getAttribute('role')).toBe('switch');
      expect(text()).toContain('thứ hạng của họ khép lại');
      expect(text()).toContain('XP của bạn vẫn được tính vào đơn vị');
    });

    it('PUTs the choice, then shows what the server now holds', async () => {
      await open('000004');
      toggle().click();
      await settle();
      const put = backend.expectOne(
        (r) => r.url === PREFERENCES_URL && r.method === 'PUT',
      );
      expect(put.request.body).toEqual({ showOnLeaderboard: false });
      showOnLeaderboard = false;
      put.flush(envelopeOk({ showOnLeaderboard: false }));
      await answerPreferences();
      expect(toggle().checked).toBe(false);
    });

    it('keeps the state after a reload', async () => {
      showOnLeaderboard = false;
      await open('000004');
      expect(toggle().checked).toBe(false);
    });

    it('is not shown to someone who is not a learner', async () => {
      await open('000001');
      expect(el.querySelector('.profile__preferences')).toBeNull();
    });
  });

  it('shows no level to someone who is not a learner and asks for none', async () => {
    const admin = { ...seedProfile('000001') };
    await open('000001');
    expect(el.querySelector('.profile__level')).toBeNull();
    expect(admin.userId).toBe('000001');
  });

  it('keeps Save disabled until a field changes', async () => {
    await open();
    const save = submitOf('Thông tin cá nhân');
    expect(save?.disabled).toBe(true);
    await type(input('Chức danh'), 'Trưởng nhóm');
    expect(save?.disabled).toBe(false);
    await type(input('Chức danh'), seedProfile('000005').positionName ?? '');
    expect(save?.disabled).toBe(true);
  });

  it('PATCHes only the changed fields, then takes the answered /me as the signed-in user', async () => {
    await open();
    await type(input('Họ và tên'), '  Phạm Trang  ');
    submitOf('Thông tin cá nhân')?.click();
    await settle();
    const patch = backend.expectOne(ME_URL);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ fullName: 'Phạm Trang' });
    const me = seedMe('000005');
    patch.flush(
      envelopeOk({ ...me, user: { ...me.user, fullName: 'Phạm Trang' } }),
    );
    await settle();
    expect(fakeSession().apply).toHaveBeenCalledOnce();
    expect(input('Họ và tên').value).toBe('Phạm Trang');
    expect(document.body.textContent).toContain('Đã lưu hồ sơ');
  });

  it('clears an emptied optional field with null', async () => {
    await open();
    await type(input('Email'), '');
    submitOf('Thông tin cá nhân')?.click();
    await settle();
    const patch = backend.expectOne(ME_URL);
    expect(patch.request.body).toEqual({ email: null });
    patch.flush(envelopeOk(seedMe('000005')));
    await settle();
  });

  it.each([
    ['Họ và tên', '', 'Nhập họ và tên.'],
    ['Email', 'khong-phai-email', 'Email không hợp lệ.'],
    ['Họ và tên', 'a'.repeat(256), 'Họ tên tối đa 255 ký tự.'],
  ])(
    'refuses %s "%s" before calling the server',
    async (label, value, message) => {
      await open();
      await type(input(label), value);
      submitOf('Thông tin cá nhân')?.click();
      await settle();
      backend.expectNone(ME_URL);
      expect(text()).toContain(message);
    },
  );

  it('toasts the backend message when a profile save is refused, and keeps the form', async () => {
    await open();
    await type(input('Họ và tên'), 'Phạm Trang');
    submitOf('Thông tin cá nhân')?.click();
    await settle();
    const { body } = backendRefusal('validationFailed');
    backend.expectOne(ME_URL).flush(body);
    await settle();
    expect(document.body.textContent).toContain('Thông tin chưa hợp lệ');
    expect(document.body.textContent).toContain(
      'Dữ liệu đầu vào không hợp lệ.',
    );
    expect(document.body.textContent).not.toContain('Đã lưu hồ sơ');
    expect(input('Họ và tên').value).toBe('Phạm Trang');
  });

  it('shows an SSO account read-only: the source system owns its fields', async () => {
    await open('000007', { authProvider: 'SSO' });
    expect(text()).toContain('Tài khoản SSO được đồng bộ');
    expect(input('Họ và tên').readOnly).toBe(true);
    expect(submitOf('Thông tin cá nhân')).toBeFalsy();
    expect(text()).toContain('Tài khoản SSO đổi mật khẩu ở hệ thống nguồn.');
  });

  describe('password', () => {
    async function fill(current: string, next: string, again: string) {
      await type(input('Mật khẩu hiện tại'), current);
      await type(input('Mật khẩu mới'), next);
      await type(input('Nhập lại mật khẩu mới'), again);
    }

    it('checks the rules locally before calling the server', async () => {
      await open();
      await fill('Demo@123', 'Moi@456', 'Moi@457');
      submitOf('Đổi mật khẩu')?.click();
      await settle();
      backend.expectNone(PASSWORD_URL);
      expect(text()).toContain('Mật khẩu nhập lại không khớp.');

      await fill('Demo@123', 'abc', 'abc');
      submitOf('Đổi mật khẩu')?.click();
      await settle();
      backend.expectNone(PASSWORD_URL);
      expect(text()).toContain('Mật khẩu mới tối thiểu 6 ký tự.');

      await fill('Demo@123', 'Demo@123', 'Demo@123');
      submitOf('Đổi mật khẩu')?.click();
      await settle();
      backend.expectNone(PASSWORD_URL);
      expect(text()).toContain('Mật khẩu mới phải khác mật khẩu hiện tại.');
    });

    it('PUTs the two passwords, clears the token and returns to the login page', async () => {
      await open();
      await fill('Demo@123', 'Moi@456', 'Moi@456');
      submitOf('Đổi mật khẩu')?.click();
      await settle();
      const put = backend.expectOne(PASSWORD_URL);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({
        currentPassword: 'Demo@123',
        newPassword: 'Moi@456',
      });
      put.flush(envelopeOk(null));
      await settle();
      expect(fakeSession().expire).toHaveBeenCalledOnce();
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url.startsWith('/login')).toBe(true),
      );
      expect(document.body.textContent).toContain('Đã đổi mật khẩu');
    });

    it('toasts the backend message when the current password is wrong, and keeps the fields', async () => {
      await open();
      await fill('sai-mat-khau', 'Moi@456', 'Moi@456');
      submitOf('Đổi mật khẩu')?.click();
      await settle();
      const { status, body } = backendRefusal('currentPasswordIncorrect');
      backend
        .expectOne(PASSWORD_URL)
        .flush(body, { status, statusText: 'Bad Request' });
      await settle();
      expect(document.body.textContent).toContain(
        backendRefusal('currentPasswordIncorrect').body.messageTitle,
      );
      expect(fakeSession().expire).not.toHaveBeenCalled();
      expect(input('Mật khẩu hiện tại').value).toBe('sai-mat-khau');
      expect(input('Mật khẩu mới').value).toBe('Moi@456');
    });
  });
});
