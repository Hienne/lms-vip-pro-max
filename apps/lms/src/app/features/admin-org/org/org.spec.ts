import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { identityEndpoints, organizationEndpoints } from '@lms/contracts';
import { backendRefusal, SEED_ORGS, SEED_TEAMS, SEED_USERS } from '@lms/mocks';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  ReplyGate,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import { SessionStore } from '../../../core/session/session.store';

const ROOT = SEED_ORGS[0];

describe('Org', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
  });
  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = '')),
  );

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  }

  async function open(username: string, userId: string) {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/org');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  function useDepartmentWithGroups(): void {
    const backend = TestBed.inject(MockBackend) as unknown as {
      orgs: { id: number; orgType: string }[];
    };
    const node = backend.orgs.find((org) => org.id === ROOT.id);
    if (!node) throw new Error('Missing department fixture');
    node.orgType = 'DEPARTMENT';
  }
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) =>
        b.textContent?.includes(label) ||
        b.getAttribute('aria-label')?.includes(label),
    ) as HTMLButtonElement;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const alertDialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');
  const cards = () => Array.from(el.querySelectorAll('article'));
  const card = (name: string) =>
    cards().find((a) => a.querySelector('strong')?.textContent === name) as
      | HTMLElement
      | undefined;
  const inputOf = (label: string) =>
    Array.from(dialog()?.querySelectorAll<HTMLElement>('ui-field') ?? [])
      .find((f) => f.querySelector('label')?.textContent?.includes(label))
      ?.querySelector('input, textarea') as HTMLInputElement;
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  async function type(field: HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function chooseTeamAction(team: HTMLElement, label: string) {
    button(team, 'Thao tác cho').click();
    await settle();
    const item = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((entry) => entry.textContent?.trim() === label);
    expect(item).toBeDefined();
    item?.click();
    await settle();
  }

  it('reads the roots from the tree endpoint and shows the first one with its facts', async () => {
    await open('super.admin', '000001');
    expect(calls(organizationEndpoints.orgTree)[0][1].query).toEqual({
      page: '0',
      size: '50',
    });
    expect(calls(organizationEndpoints.listOrgs)).toHaveLength(0);
    expect(el.querySelector('h1')?.textContent).toBe('Đơn vị, phòng & nhóm');
    expect(el.querySelector('[role="tree"]')).not.toBeNull();
    expect(text()).toContain(ROOT.name);
    expect(el.querySelector('h2')?.textContent).toBe(ROOT.name);
    expect(text()).toContain(ROOT.code);
    expect(text()).toContain('Quản trị viên:');
  });

  it('reads the panel of the picked org in one request: counts, administrators and teams', async () => {
    await open('super.admin', '000001');
    expect(calls(organizationEndpoints.orgContents)).toHaveLength(1);
    expect(calls(organizationEndpoints.orgContents)[0][1]).toMatchObject({
      params: { orgId: String(ROOT.id) },
      query: { page: '0', size: '10', sort: 'name,asc' },
    });
    expect(calls(organizationEndpoints.getOrg)).toHaveLength(0);
    expect(calls(organizationEndpoints.listTeams)).toHaveLength(0);
    const stats = Array.from(el.querySelectorAll('dl dd')).map((dd) =>
      dd.textContent?.trim(),
    );
    // Members are every seeded user of the org, as the mock counts them.
    const members = SEED_USERS.filter((u) => u.orgId === ROOT.id).length;
    expect(stats).toEqual([String(members)]);
    expect(text()).toContain('Quản trị viên: Quản trị Ban Demo');
  });

  it('pages the teams of the picked org and previews at most five members', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    expect(cards()).toHaveLength(10);
    expect(text()).toContain(`Nhóm trực thuộc (${SEED_TEAMS.length})`);
    button(el, '2').click();
    await settle();
    expect(
      calls(organizationEndpoints.orgContents).at(-1)?.[1].query,
    ).toMatchObject({ page: '1' });
    for (const team of cards()) {
      expect(team.querySelectorAll('ul a').length).toBeLessThanOrEqual(3);
    }
  });

  it('keeps the org header, its counts and the team total while the next team page is read', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    const firstPage = cards().map(
      (c) => c.querySelector('strong')?.textContent,
    );
    const hold = TestBed.inject(ReplyGate).hold(
      organizationEndpoints.orgContents,
    );
    button(el, '2').click();
    await settle();

    expect(hold.pending()).toBe(1);
    expect(button(el, 'Sửa')).toBeTruthy();
    expect(button(el, 'Tạm dừng')).toBeTruthy();
    expect(text()).toContain('Quản trị viên: Quản trị Ban Demo');
    expect(el.querySelectorAll('dl dd')).toHaveLength(2);
    expect(text()).toContain(`Nhóm trực thuộc (${SEED_TEAMS.length})`);

    hold.release();
    await settle();
    const secondPage = cards().map(
      (c) => c.querySelector('strong')?.textContent,
    );
    expect(secondPage).toHaveLength(Math.min(10, SEED_TEAMS.length - 10));
    expect(secondPage[0]).not.toBe(firstPage[0]);
    expect(text()).toContain(`Nhóm trực thuộc (${SEED_TEAMS.length})`);
  });

  it('links a team with more than three members to the users list filtered by that team', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    const more = el.querySelector<HTMLAnchorElement>('article p a');
    if (more) {
      expect(more.textContent).toContain('Xem tất cả');
      expect(more.getAttribute('href')).toMatch(/^\/admin\/users\?teamId=\d+$/);
    }
  });

  it('adds a team to a department, then shows it in the count', async () => {
    const departmentId = await addDepartment();
    await open('super.admin', '000001');
    expect(button(el, 'Thêm nhóm')).toBeUndefined();
    button(el, 'Phòng trống').click();
    await settle();
    button(el, 'Thêm nhóm').click();
    await settle();
    expect(dialog()?.textContent).toContain('Thêm nhóm');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(dialog()?.textContent).toContain('Nhập tên nhóm.');
    expect(calls(organizationEndpoints.createTeam)).toHaveLength(0);
    await type(inputOf('Tên nhóm'), '  Nhóm Mới ');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(organizationEndpoints.createTeam)[0][1]).toMatchObject({
      params: { orgId: String(departmentId) },
      body: { name: 'Nhóm Mới' },
    });
    expect(dialog()).toBeNull();
    expect(text()).toContain(`Nhóm trực thuộc (1)`);
    expect(document.body.textContent).toContain('Đã lưu');
  });

  it('renames a team and PATCHes only the name', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    const first = cards()[0];
    const name = first.querySelector('strong')?.textContent as string;
    await chooseTeamAction(first, 'Sửa nhóm');
    expect(inputOf('Tên nhóm').value).toBe(name);
    await type(inputOf('Tên nhóm'), 'AAA Tên đã đổi');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    const [, request] = calls(organizationEndpoints.updateTeam)[0];
    expect(Object.keys(request.body as object)).toEqual(['name']);
    expect(request.body).toEqual({ name: 'AAA Tên đã đổi' });
    expect(text()).toContain('AAA Tên đã đổi');
  });

  it('toasts the backend message when a team still has members and keeps it listed', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    const withMembers = cards().find(
      (c) => !c.textContent?.includes('Chưa có thành viên'),
    ) as HTMLElement;
    const name = withMembers.querySelector('strong')?.textContent as string;
    await chooseTeamAction(withMembers, 'Xóa nhóm');
    expect(calls(organizationEndpoints.deleteTeam)).toHaveLength(0);
    button(alertDialog() as HTMLElement, 'Xóa').click();
    await settle();
    expect(document.body.textContent).toContain(
      'Không thể xóa nhóm còn thành viên',
    );
    expect(text()).toContain(name);
  });

  it('deletes a team nobody uses after confirming', async () => {
    await addDepartment();
    await open('super.admin', '000001');
    button(el, 'Phòng trống').click();
    await settle();
    button(el, 'Thêm nhóm').click();
    await settle();
    await type(inputOf('Tên nhóm'), 'AAA Nhóm tạm');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    const temporary = card('AAA Nhóm tạm') as HTMLElement;
    await chooseTeamAction(temporary, 'Xóa nhóm');
    expect(calls(organizationEndpoints.deleteTeam)).toHaveLength(0);
    button(alertDialog() as HTMLElement, 'Xóa').click();
    await settle();
    expect(calls(organizationEndpoints.deleteTeam)).toHaveLength(1);
    expect(text()).toContain('Nhóm trực thuộc (0)');
  });

  it('edits the org with a PATCH of changed fields and lets a global admin pause it', async () => {
    await open('super.admin', '000001');
    button(el, 'Sửa').click();
    await settle();
    await type(inputOf('Tên'), 'Ban đã đổi tên');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(organizationEndpoints.updateOrg)[0][1]).toMatchObject({
      params: { orgId: String(ROOT.id) },
      body: { name: 'Ban đã đổi tên' },
    });
    expect(el.querySelector('h2')?.textContent).toBe('Ban đã đổi tên');

    button(el, 'Tạm dừng').click();
    await settle();
    button(alertDialog() as HTMLElement, 'Xác nhận')?.click();
    await settle();
  });

  it('adds a department under the root; the tree shows it once the root is opened', async () => {
    await open('super.admin', '000001');
    button(el, 'Thêm đơn vị / phòng').click();
    await settle();
    const type_ = Array.from(
      dialog()?.querySelectorAll<HTMLSelectElement>('select') ?? [],
    )[0];
    type_.value = 'DEPARTMENT';
    type_.dispatchEvent(new Event('input', { bubbles: true }));
    type_.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    await type(inputOf('Mã'), 'PHONG01');
    await type(inputOf('Tên'), 'Phòng Mới');
    button(dialog() as HTMLElement, 'Lưu').click();
    await settle();
    expect(calls(organizationEndpoints.createOrg)[0][1].body).toEqual({
      orgType: 'DEPARTMENT',
      parentId: ROOT.id,
      code: 'PHONG01',
      name: 'Phòng Mới',
      sortNo: 0,
    });
    expect(
      calls(organizationEndpoints.orgTree).some(
        ([, request]) => request.query['parentId'] === String(ROOT.id),
      ),
    ).toBe(true);
    expect(el.querySelector('[role="tree"]')?.textContent).toContain(
      'Phòng Mới',
    );
  });

  async function addDepartment(): Promise<number> {
    const token = signInToMockBackend('super.admin');
    const reply = TestBed.inject(MockBackend).handle(
      organizationEndpoints.createOrg,
      {
        token,
        params: {},
        query: {},
        body: {
          orgType: 'DEPARTMENT',
          parentId: ROOT.id,
          code: 'PHONG_TRONG',
          name: 'Phòng trống',
          sortNo: 0,
        },
      },
    );
    return (reply?.body.data as { id: number }).id;
  }
  /** The deepest item with that label: an item's text includes its children's. */
  const treeItem = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="treeitem"]'))
      .filter((item) => item.textContent?.includes(label))
      .at(-1) as HTMLElement;

  it('shows direct departments and selects one from the detail panel', async () => {
    const departmentId = await addDepartment();
    await open('super.admin', '000001');
    expect(text()).toContain('Đơn vị / phòng trực thuộc');
    const child = button(el, 'Phòng trống');
    expect(child).toBeTruthy();
    child.click();
    await settle();
    expect(el.querySelector('h2')?.textContent).toBe('Phòng trống');
    expect(calls(organizationEndpoints.orgContents).at(-1)?.[1].params).toEqual(
      { orgId: String(departmentId) },
    );
  });

  it('links each group name to the member list filtered by group', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    const link = card(SEED_TEAMS[0].name)?.querySelector('strong a');
    expect(link?.getAttribute('href')).toContain(`teamId=${SEED_TEAMS[0].id}`);
  });
  it('selects a group in the tree and reads its members', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    const team = SEED_TEAMS[0];
    expect(treeItem(team.name)).toBeTruthy();
    treeItem(team.name).click();
    await settle();
    expect(el.querySelector('h2')?.textContent).toBe(team.name);
    expect(calls(identityEndpoints.listUsers).at(-1)?.[1].query).toMatchObject({
      teamId: String(team.id),
      page: '0',
      size: '10',
    });
    expect(text()).toContain('Thành viên');
    expect(
      el.querySelector('section.org__team-members article ui-avatar'),
    ).toBeTruthy();
    expect(
      el
        .querySelector('section.org__team-members article a')
        ?.getAttribute('href'),
    ).toContain('/admin/users/');
  });

  it('switches from a selected group back to its department', async () => {
    useDepartmentWithGroups();
    await open('super.admin', '000001');
    treeItem(SEED_TEAMS[0].name).click();
    await settle();
    treeItem(ROOT.name).click();
    await settle();
    expect(el.querySelector('h2')?.textContent).toBe(ROOT.name);
    expect(text()).toContain('Nhóm trực thuộc');
  });
  it('drops a late team page when switching to another department', async () => {
    const firstId = await addDepartment();
    const token = signInToMockBackend('super.admin');
    const backend = TestBed.inject(MockBackend);
    const reply = backend.handle(organizationEndpoints.createOrg, {
      token,
      params: {},
      query: {},
      body: {
        orgType: 'DEPARTMENT',
        parentId: ROOT.id,
        code: 'PHONG_2',
        name: 'Phòng thứ hai',
        sortNo: 1,
      },
    });
    const secondId = (reply?.body.data as { id: number }).id;
    for (let i = 0; i < 11; i++) {
      backend.handle(organizationEndpoints.createTeam, {
        token,
        params: { orgId: String(firstId) },
        query: {},
        body: { name: `Nhóm ${i}` },
      });
    }
    await open('super.admin', '000001');
    button(el, 'Phòng trống').click();
    await settle();
    const hold = TestBed.inject(ReplyGate).hold(
      organizationEndpoints.orgContents,
    );
    button(el, '2').click();
    await settle();
    treeItem('Phòng thứ hai').click();
    await settle();
    hold.release();
    await settle();
    expect(calls(organizationEndpoints.orgContents).at(-1)?.[1].params).toEqual(
      { orgId: String(secondId) },
    );
    expect(el.querySelector('h2')?.textContent).toBe('Phòng thứ hai');
    expect(cards()).toHaveLength(0);
  });
  it('shows the panel error with a retry when the node is gone or out of scope', async () => {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((endpoint, request) =>
      endpoint === organizationEndpoints.orgContents
        ? backendRefusal('resourceNotFound')
        : MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    await open('super.admin', '000001');
    expect(text()).toContain('Không tìm thấy dữ liệu yêu cầu.');
    expect(cards()).toHaveLength(0);

    handle.mockImplementation((endpoint, request) =>
      MockBackend.prototype.handle.call(backend, endpoint, request),
    );
    button(el, 'Thử lại').click();
    await settle();
    expect(cards()).toHaveLength(0);
  });

  describe('import from file', () => {
    const pick = async (name: string) => {
      const input = dialog()?.querySelector<HTMLInputElement>(
        'input[type="file"]',
      ) as HTMLInputElement;
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File([new Uint8Array(10)], name)],
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    const openImport = async () => {
      button(el, 'Nhập từ tệp').click();
      await settle();
    };

    it('opens a drawer on the page instead of linking to /admin/import', async () => {
      await open('super.admin', '000001');
      expect(el.querySelector('a[href^="/admin/import"]')).toBeNull();
      await openImport();
      expect(dialog()?.textContent).toContain('Nhập từ tệp');
      expect(dialog()?.textContent).toContain('Tải mẫu Excel');
      expect(dialog()?.textContent).toContain(ROOT.code);
      expect(dialog()?.textContent).not.toContain('để trống sheet');
      expect(button(dialog() as HTMLElement, 'Nhập dữ liệu').disabled).toBe(
        true,
      );
    });

    it('checks a file, imports it, closes and reloads the tree and the panel', async () => {
      await open('super.admin', '000001');
      await openImport();
      await pick('don-vi.xlsx');
      expect(button(dialog() as HTMLElement, 'Nhập dữ liệu').disabled).toBe(
        true,
      );
      button(dialog() as HTMLElement, 'Kiểm tra').click();
      await settle();
      expect(dialog()?.textContent).toContain('Hợp lệ: 1 đơn vị/phòng, 1 nhóm');
      const treeReads = calls(organizationEndpoints.orgTree).length;
      const panelReads = calls(organizationEndpoints.orgContents).length;

      button(dialog() as HTMLElement, 'Nhập dữ liệu').click();
      await settle();
      expect(calls(organizationEndpoints.importOrgs)).toHaveLength(2);
      expect(dialog()).toBeNull();
      expect(document.body.textContent).toContain(
        'Đã nhập 1 đơn vị/phòng, 1 nhóm',
      );
      expect(calls(organizationEndpoints.orgTree).length).toBeGreaterThan(
        treeReads,
      );
      expect(calls(organizationEndpoints.orgContents).length).toBeGreaterThan(
        panelReads,
      );
      expect(
        el.querySelector('[role="treeitem"]')?.hasAttribute('aria-expanded'),
      ).toBe(true);
    });

    it('toasts an invalid file and keeps "Nhập dữ liệu" disabled', async () => {
      await open('super.admin', '000001');
      await openImport();
      await pick('du-lieu-loi.xlsx');
      button(dialog() as HTMLElement, 'Kiểm tra').click();
      await settle();
      expect(document.body.textContent).toContain(
        'Tệp nhập chưa hợp lệ. Vui lòng kiểm tra các lỗi chi tiết.',
      );
      expect(button(dialog() as HTMLElement, 'Nhập dữ liệu').disabled).toBe(
        true,
      );
    });

    it('refuses a non-xlsx file in the drawer without a request', async () => {
      await open('super.admin', '000001');
      await openImport();
      await pick('don-vi.csv');
      expect(dialog()?.textContent).toContain('Chỉ nhận tệp Excel .xlsx.');
      expect(button(dialog() as HTMLElement, 'Kiểm tra').disabled).toBe(true);
      expect(calls(organizationEndpoints.importOrgs)).toHaveLength(0);
    });

    it('tells an org administrator to import teams only', async () => {
      await open('quantri.ban', '000003');
      await openImport();
      expect(dialog()?.textContent).toContain(
        'Bạn chỉ nhập được nhóm trong phạm vi quản lý; để trống sheet Organizations.',
      );
    });

    it('closes on Escape, forgets the file and returns focus to the button', async () => {
      await open('super.admin', '000001');
      const trigger = button(el, 'Nhập từ tệp');
      trigger.focus();
      await openImport();
      await pick('don-vi.xlsx');
      dialog()?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
        }),
      );
      await settle();
      await vi.waitFor(() => expect(dialog()).toBeNull());
      expect(document.activeElement).toBe(trigger);
      await openImport();
      expect(dialog()?.textContent).not.toContain('don-vi.xlsx');
    });
  });

  it('keeps create and pause for global administrators: an org admin gets neither', async () => {
    await open('quantri.ban', '000003');
    expect(button(el, 'Thêm đơn vị / phòng')).toBeUndefined();
    expect(button(el, 'Tạm dừng')).toBeUndefined();
    expect(button(el, 'Sửa')).toBeTruthy();
  });
});
