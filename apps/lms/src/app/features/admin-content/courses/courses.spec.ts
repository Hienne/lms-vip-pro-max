import { courseEndpoints } from '@lms/contracts';
import { setUpAdminScreen } from '../admin-content.testing';

describe('Courses', () => {
  const screen = setUpAdminScreen();
  const rows = () =>
    Array.from(screen.el.querySelectorAll('tbody tr')).map((r) =>
      screen.text(r),
    );
  const row = (title: string) =>
    Array.from(screen.el.querySelectorAll<HTMLElement>('tbody tr')).find((r) =>
      r.textContent?.includes(title),
    )!;
  const menuItem = (label: string) =>
    Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((i) => i.textContent?.includes(label));

  it('lists the courses the caller manages, newest first, with their state', async () => {
    await screen.open('/admin/courses');

    expect(screen.lastCall(courseEndpoints.instructorCourses)?.query).toEqual({
      page: '0',
      size: '10',
      sort: 'updateTime,desc',
    });
    expect(rows()).toHaveLength(6);
    expect(screen.text(row('An toàn thông tin cho cán bộ CNTT'))).toContain(
      'Nháp',
    );
    expect(screen.text(row('Tổng quan hệ thống Core Banking'))).toContain(
      'Đã xuất bản',
    );
    expect(screen.text()).toContain('6 khóa học');
  });

  it('filters by state on the server', async () => {
    await screen.open('/admin/courses');
    await screen.choose(
      screen.el.querySelector<HTMLSelectElement>(
        'select[aria-label="Trạng thái"]',
      )!,
      'draft',
    );

    expect(
      screen.lastCall(courseEndpoints.instructorCourses)?.query,
    ).toMatchObject({ state: 'draft', page: '0' });
    expect(rows()).toHaveLength(1);
  });

  it('pauses a course after confirming, with the course version', async () => {
    await screen.open('/admin/courses');
    await screen.click(
      screen.button('Thêm thao tác cho Tổng quan hệ thống Core Banking'),
    );
    await screen.click(menuItem('Tạm dừng'));

    expect(screen.text(screen.alertDialog()!)).toContain('Tạm dừng');
    await screen.click(screen.button('Tạm dừng', screen.alertDialog()!));

    expect(screen.lastCall(courseEndpoints.changeState)?.body).toEqual({
      expectedVersion: 0,
      status: 'paused',
    });
    expect(screen.text(row('Tổng quan hệ thống Core Banking'))).toContain(
      'Tạm dừng',
    );
  });

  it('copies a course under a new code', async () => {
    await screen.open('/admin/courses');
    await screen.click(screen.button('Thêm thao tác cho Phân hệ Tiền gửi'));
    await screen.click(menuItem('Sao chép'));

    const drawer = screen.drawer()!;
    const code = screen.field('Mã khóa học mới', drawer) as HTMLInputElement;
    expect(code.value).toBe('NV-102-COPY');
    await screen.click(screen.button('Sao chép', drawer));

    expect(screen.lastCall(courseEndpoints.copyCourse)?.body).toEqual({
      code: 'NV-102-COPY',
    });
    expect(screen.drawer()).toBeNull();
    expect(rows()).toHaveLength(7);
  });
});
