import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { courseEndpoints } from '@lms/contracts';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';

describe('CourseNew', () => {
  const screen = setUpAdminScreen();

  it('checks the form, creates the course under the caller org and opens the editor', async () => {
    await screen.open('/admin/courses/new');
    await screen.click(screen.button('Tạo và soạn nội dung'));

    expect(screen.text()).toContain('Nhập tên khóa học.');
    expect(screen.callsTo(courseEndpoints.createCourse)).toBe(0);

    await screen.type(
      screen.field('Tên khóa học') as HTMLInputElement,
      ' Đối soát cuối ngày ',
    );
    await screen.type(
      screen.field('Mã khóa học') as HTMLInputElement,
      'VH-302',
    );
    await screen.click(screen.button('Tạo và soạn nội dung'));

    expect(screen.lastCall(courseEndpoints.createCourse)?.body).toEqual({
      ownerOrgId: 1,
      code: 'VH-302',
      title: 'Đối soát cuối ngày',
    });
    // The editor is a lazy route, so reaching it loads and renders the whole editor. Wait for the
    // router to finish instead of polling a clock: `vi.waitFor` gives up after 1 s, which a busy
    // machine exceeds.
    await TestBed.inject(ApplicationRef).whenStable();
    expect(screen.url()).toMatch(/^\/admin\/courses\/\d+\/edit$/);
  });

  it('shows the refusal when the code is taken', async () => {
    await screen.open('/admin/courses/new');
    await screen.type(
      screen.field('Tên khóa học') as HTMLInputElement,
      'Trùng',
    );
    await screen.type(
      screen.field('Mã khóa học') as HTMLInputElement,
      'NV-101',
    );
    await screen.click(screen.button('Tạo và soạn nội dung'));

    expect(screen.url()).toBe('/admin/courses/new');
    expect(screen.el.querySelector('ui-alert')).not.toBeNull();
  });
});
