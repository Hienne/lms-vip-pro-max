import { TestBed } from '@angular/core/testing';
import {
  courseEndpoints,
  organizationEndpoints,
  type AnyEndpoint,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '@lms/mocks';
import { MockBackend } from '../../../../../core/dev/mock-api/mock-api.interceptor';
import { setUpAdminScreen } from '../../../../../core/dev/mock-api/admin-screen.testing';

const org = (id: number, name: string) => ({
  id,
  parentId: id === 1 ? null : 1,
  orgType: 'UNIT',
  code: `U${id}`,
  name,
  status: 'active',
  sortNo: id,
  memberCount: 0,
  teamCount: 0,
});
const ORGS = [
  org(1, 'Ban Quản lý và phát triển Core Banking'),
  org(2, 'Chi nhánh Hà Nội'),
  org(3, 'Chi nhánh Đà Nẵng'),
  org(4, 'Chi nhánh Huế'),
];

describe('CourseShares', () => {
  const screen = setUpAdminScreen();

  /** The seeded backend has one unit only, so the unit list is stood in for. */
  beforeEach(() => {
    const backend = TestBed.inject(MockBackend);
    const original = (e: AnyEndpoint, r: FakeRequest): FakeReply =>
      MockBackend.prototype.handle.call(backend, e, r) as FakeReply;
    screen.calls.mockImplementation((endpoint, request) => {
      if (endpoint !== organizationEndpoints.listOrgs) {
        return original(endpoint, request);
      }
      const q = (request.query['q'] ?? '').toLowerCase();
      const items = ORGS.filter((o) => !q || o.name.toLowerCase().includes(q));
      return {
        status: 200,
        body: {
          responseId: 'r',
          timestamp: '2026-10-27T10:00:00',
          status: 'SUCCESS',
          messageCode: 'CORE-OK',
          message: 'OK',
          messageTitle: 'OK',
          data: {
            items,
            page: 0,
            size: Number(request.query['size']),
            totalElements: items.length,
            totalPages: 1,
          },
        },
      } as FakeReply;
    });
  });

  const menuItem = (label: string) =>
    Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((i) => i.textContent?.includes(label));
  const key = (target: HTMLElement, name: string) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true }),
    );
  const pause = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function openShares(title = 'Phân hệ Tiền gửi') {
    await screen.open('/admin/courses');
    await screen.click(screen.button(`Thêm thao tác cho ${title}`));
    await screen.click(menuItem('Chia sẻ cho đơn vị'));
    await screen.settle();
    return screen.drawer()!;
  }
  const switchOf = (label: string, root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLLabelElement>('label'))
      .find((l) => l.textContent?.includes(label))
      ?.querySelector<HTMLInputElement>('input[type=checkbox]') as
      | HTMLInputElement
      | undefined;

  /** Adds the unit by keyboard: types to search, moves to the match and presses Enter. */
  async function addByKeyboard(
    drawer: HTMLElement,
    query: string,
    on: readonly string[] = [],
  ) {
    await screen.click(screen.button('Thêm đơn vị', drawer));
    const box = screen.field('Đơn vị', drawer) as HTMLInputElement;
    box.focus();
    await screen.type(box, query);
    await pause(350);
    await screen.settle();
    key(box, 'ArrowDown');
    await screen.settle();
    key(box, 'Enter');
    await screen.settle();
    for (const label of on) await screen.click(switchOf(label, drawer)!);
    await screen.click(screen.button('Chia sẻ', drawer));
  }

  it('shows the note, the owner unit and an empty line for a course nobody shares', async () => {
    const drawer = await openShares();

    expect(screen.text(drawer)).toContain('Chia sẻ khóa học');
    expect(screen.text(drawer)).toContain(
      'Đơn vị được chia sẻ có thể sử dụng khóa học nhưng không sửa được nội dung.',
    );
    expect(screen.text(drawer)).toContain(
      'Đơn vị sở hữu: Ban Quản lý và phát triển Core Banking',
    );
    expect(screen.text(drawer)).toContain(
      'Khóa học chưa được chia sẻ với đơn vị nào.',
    );
    expect(screen.text(drawer)).not.toContain('Đã thu hồi');
    expect(screen.button('Thêm đơn vị', drawer)).toBeTruthy();
  });

  it('opens the add form with the switches at off, on and off', async () => {
    const drawer = await openShares();
    await screen.click(screen.button('Thêm đơn vị', drawer));

    expect(screen.field('Đơn vị', drawer)).toBeTruthy();
    expect(switchOf('Gồm cả đơn vị con', drawer)?.checked).toBe(false);
    expect(switchOf('Được giao khóa học cho học viên', drawer)?.checked).toBe(
      true,
    );
    expect(switchOf('Học viên được tự đăng ký', drawer)?.checked).toBe(false);
    expect(
      switchOf('Học viên được tự đăng ký', drawer)?.getAttribute('role'),
    ).toBe('switch');
    expect(screen.button('Chia sẻ', drawer)?.disabled).toBe(true);
    const listed = Array.from(
      drawer.querySelectorAll<HTMLElement>('[role="option"]'),
    ).map((o) => o.querySelector('.org-picker__name')?.textContent);
    expect(listed).toEqual([
      'Chi nhánh Hà Nội',
      'Chi nhánh Đà Nẵng',
      'Chi nhánh Huế',
    ]);
  });

  it('adds a unit using the keyboard and lists it with its rights as text', async () => {
    const drawer = await openShares();
    await addByKeyboard(drawer, 'Huế', ['Học viên được tự đăng ký']);

    expect(screen.lastCall(courseEndpoints.share)).toMatchObject({
      params: { courseId: '5' },
      body: {
        orgId: 4,
        includeDescendants: false,
        canAssign: true,
        canSelfEnroll: true,
        active: true,
      },
    });
    expect(screen.text(drawer)).toContain('Chi nhánh Huế');
    expect(screen.text(drawer)).toContain(
      'Được giao học · Học viên tự đăng ký',
    );
    expect(screen.text(document.body)).toContain('Đã cập nhật chia sẻ');
    expect(screen.field('Đơn vị', drawer)).toBeUndefined();
  });

  it('changes the rights of a unit inline and revokes it after the confirm', async () => {
    const drawer = await openShares();
    await addByKeyboard(drawer, 'Hà Nội');
    expect(screen.text(drawer)).toContain('Chi nhánh Hà Nội');

    await screen.click(
      screen.button('Thêm thao tác cho Chi nhánh Hà Nội', drawer),
    );
    await screen.click(menuItem('Sửa quyền'));
    await screen.click(switchOf('Gồm cả đơn vị con', drawer)!);
    await screen.click(screen.button('Lưu', drawer));
    expect(screen.lastCall(courseEndpoints.share)?.body).toEqual({
      orgId: 2,
      includeDescendants: true,
      canAssign: true,
      canSelfEnroll: false,
      active: true,
    });
    expect(screen.text(drawer)).toContain('Gồm đơn vị con · Được giao học');

    await screen.click(
      screen.button('Thêm thao tác cho Chi nhánh Hà Nội', drawer),
    );
    await screen.click(menuItem('Thu hồi'));
    const confirm = screen.alertDialog()!;
    expect(screen.text(confirm)).toContain(
      'Thu hồi chia sẻ với Chi nhánh Hà Nội?',
    );
    expect(screen.text(confirm)).toContain(
      'Đơn vị này không giao thêm được khóa học. Các lượt giao đã có vẫn giữ nguyên.',
    );
    await screen.click(screen.button('Thu hồi', confirm));

    expect(screen.lastCall(courseEndpoints.share)?.body).toMatchObject({
      orgId: 2,
      active: false,
    });
    expect(screen.text(drawer)).toContain('Đã thu hồi');
    expect(screen.text(drawer)).toContain('Thu hồi');
    expect(screen.text(drawer)).not.toContain(
      'Khóa học chưa được chia sẻ với đơn vị nào.',
    );

    await screen.click(
      screen.button('Thêm thao tác cho Chi nhánh Hà Nội', drawer),
    );
    await screen.click(menuItem('Chia sẻ lại'));
    expect(screen.lastCall(courseEndpoints.share)?.body).toMatchObject({
      orgId: 2,
      includeDescendants: true,
      active: true,
    });
    expect(screen.text(drawer)).not.toContain('Đã thu hồi');
  });

  it('does not offer the owner unit, so a course is never shared with its own unit', async () => {
    const drawer = await openShares();
    await screen.click(screen.button('Thêm đơn vị', drawer));
    const box = screen.field('Đơn vị', drawer) as HTMLInputElement;
    box.focus();
    await screen.type(box, 'Ban Quản lý');
    await pause(350);
    await screen.settle();
    key(box, 'ArrowDown');
    key(box, 'Enter');
    await screen.settle();

    // The owner is not offered, so the form cannot be sent for it.
    expect(screen.button('Chia sẻ', drawer)?.disabled).toBe(true);
    expect(screen.text(drawer)).toContain('Không có đơn vị phù hợp.');
  });
});
