import { TestBed } from '@angular/core/testing';
import {
  assignmentEndpoints,
  courseEndpoints,
  type AssignCourseCommand,
} from '@lms/contracts';
import { backendRefusal, seedCourseDetails } from '@lms/mocks';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';

describe('Assignments', () => {
  const screen = setUpAdminScreen();
  const rows = () =>
    Array.from(screen.el.querySelectorAll('tbody tr')).map((r) =>
      screen.text(r),
    );
  const courseSelect = () =>
    screen.el.querySelector<HTMLSelectElement>('.assignments__filter select')!;
  const option = (label: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (o) => o.textContent?.includes(label),
    );

  /** Opens the assign drawer and adds org 1 with its subtree as the target. */
  async function startAssigning(): Promise<HTMLElement> {
    await screen.open('/admin/assignments');
    await screen.click(screen.button('Giao khóa học'));
    const drawer = screen.drawer()!;
    await screen.choose(
      screen.field('Đơn vị', drawer) as HTMLSelectElement,
      '1',
    );
    await screen.click(screen.button('Thêm', drawer));
    return drawer;
  }

  const submit = (drawer: HTMLElement) =>
    screen.click(
      drawer.querySelector<HTMLButtonElement>('ui-form-actions [type=submit]')!,
    );

  it('lists the assignments of the first published course for the caller’s org', async () => {
    await screen.open('/admin/assignments');

    const courseId = Number(courseSelect().value);
    expect(courseId).toBeGreaterThan(0);
    expect(
      screen.lastCall(assignmentEndpoints.courseAssignments),
    ).toMatchObject({
      params: { courseId: String(courseId) },
      query: { assigningOrgId: '1', page: '0', size: '10' },
    });
    expect(screen.text()).toContain('Khóa học này chưa được giao');
    expect(Array.from(courseSelect().options).every((o) => o.text.trim())).toBe(
      true,
    );
  });

  it('opens the assign drawer on the course a link names', async () => {
    const published = seedCourseDetails().filter(
      (d) => d.course.publishedRevisionId,
    );
    const linked = String(published[published.length - 1].course.id);
    await screen.open(`/admin/assignments?course=${linked}`);

    const drawer = screen.drawer()!;
    expect(screen.text(drawer)).toContain('Giao khóa học');
    expect((screen.field('Khóa học', drawer) as HTMLSelectElement).value).toBe(
      linked,
    );
    expect(courseSelect().value).toBe(linked);
  });

  it('assigns the published revision to the chosen targets, then shows who it reached', async () => {
    const drawer = await startAssigning();
    await screen.click(option('Nhóm học tập'));
    await screen.choose(
      screen.field('Nhóm học tập', drawer) as HTMLSelectElement,
      '1',
    );
    await screen.click(screen.button('Thêm', drawer));
    await screen.type(
      screen.field('Tên đợt giao', drawer) as HTMLInputElement,
      'Cán bộ mới quý IV',
    );
    expect(screen.text(drawer)).toContain('Cán bộ mới 2026');
    await submit(drawer);

    const body = screen.lastCall(assignmentEndpoints.assignCourse)
      ?.body as AssignCourseCommand;
    const course = screen.lastCall(courseEndpoints.getCourse);
    expect(course).toBeDefined();
    expect(body).toMatchObject({
      assigningOrgId: 1,
      title: 'Cán bộ mới quý IV',
      requirement: 'mandatory',
      enrollmentMode: 'continue',
      reminderEnabled: true,
      reminderDaysBefore: 3,
      targets: [
        { targetType: 'org', orgId: 1, includeDescendants: true },
        { targetType: 'learning_group', groupId: 1 },
      ],
    });
    expect(body.revisionId).toBeGreaterThan(0);
    expect(body.idempotencyKey).toMatch(/^assign-/);
    expect(Date.parse(body.dueAt!)).toBeGreaterThan(Date.parse(body.startAt));

    const detail = screen.drawer()!;
    expect(screen.text(detail)).toContain('Cán bộ mới quý IV');
    expect(screen.text(detail)).toContain('Đối tượng (2)');
    expect(screen.text(detail)).toContain('Học viên tiền gửi Demo');
    expect(rows()[0]).toContain('Cán bộ mới quý IV');
    expect(rows()[0]).toContain('Đang hiệu lực');
  });

  it('needs a target and a due date after the start', async () => {
    await screen.open('/admin/assignments');
    await screen.click(screen.button('Giao khóa học'));
    const drawer = screen.drawer()!;
    const start = screen.field('Ngày bắt đầu', drawer) as HTMLInputElement;
    await screen.type(
      screen.field('Hạn hoàn thành', drawer) as HTMLInputElement,
      '2020-01-01',
    );
    await submit(drawer);

    expect(screen.text(drawer)).toContain('Thêm ít nhất một đối tượng.');
    expect(screen.text(drawer)).toContain('Hạn phải sau ngày bắt đầu.');
    expect(start.value).not.toBe('');
    expect(screen.callsTo(assignmentEndpoints.assignCourse)).toBe(0);
  });

  it('sends the same idempotency key when a failed assign is retried', async () => {
    const backend = TestBed.inject(MockBackend);
    const original: MockBackend['handle'] = (endpoint, request) =>
      MockBackend.prototype.handle.call(backend, endpoint, request);
    screen.calls.mockImplementation((endpoint, request) =>
      endpoint === assignmentEndpoints.assignCourse
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    const drawer = await startAssigning();
    await submit(drawer);
    const first = (
      screen.lastCall(assignmentEndpoints.assignCourse)
        ?.body as AssignCourseCommand
    ).idempotencyKey;
    expect(screen.drawer()).not.toBeNull();

    screen.calls.mockImplementation(original);
    await submit(drawer);

    expect(screen.callsTo(assignmentEndpoints.assignCourse)).toBe(2);
    expect(
      (
        screen.lastCall(assignmentEndpoints.assignCourse)
          ?.body as AssignCourseCommand
      ).idempotencyKey,
    ).toBe(first);
  });

  it('revokes one learner with a reason', async () => {
    const drawer = await startAssigning();
    await submit(drawer);
    const detail = screen.drawer()!;
    await screen.click(screen.button('Thu hồi Học viên tiền gửi Demo', detail));
    await screen.click(
      detail.querySelector<HTMLButtonElement>('form [type=submit]')!,
    );
    expect(screen.text(detail)).toContain('Nhập lý do thu hồi.');
    expect(screen.callsTo(assignmentEndpoints.revokeRecipient)).toBe(0);

    await screen.type(
      screen.field('Lý do thu hồi', detail) as HTMLTextAreaElement,
      'Chuyển công tác',
    );
    await screen.click(
      detail.querySelector<HTMLButtonElement>('form [type=submit]')!,
    );

    expect(screen.lastCall(assignmentEndpoints.revokeRecipient)?.body).toEqual({
      reason: 'Chuyển công tác',
    });
    expect(screen.text(detail)).toContain('Đã thu hồi');
    expect(screen.text(detail)).toContain('Chuyển công tác');
  });

  it('creates a learning group, then saves its members with the group version', async () => {
    await screen.open('/admin/assignments');
    await screen.click(
      screen.el.querySelectorAll<HTMLElement>('[role="tab"]')[1],
    );
    expect(rows()[0]).toContain('Cán bộ mới 2026');

    await screen.click(screen.button('Tạo nhóm'));
    let drawer = screen.drawer()!;
    await screen.type(
      screen.field('Mã nhóm', drawer) as HTMLInputElement,
      'KT-01',
    );
    await screen.type(
      screen.field('Tên nhóm', drawer) as HTMLInputElement,
      'Kế toán giao dịch',
    );
    await submit(drawer);

    expect(screen.lastCall(assignmentEndpoints.createGroup)?.body).toEqual({
      ownerOrgId: 1,
      code: 'KT-01',
      name: 'Kế toán giao dịch',
    });
    drawer = screen.drawer()!;
    expect(screen.text(drawer)).toContain('Thành viên · Kế toán giao dịch');
    expect(screen.text(drawer)).toContain('Nhóm chưa có thành viên.');

    await screen.choose(
      screen.field('Thêm thành viên', drawer) as HTMLSelectElement,
      '000004',
    );
    await screen.click(screen.button('Thêm', drawer));
    expect(screen.text(drawer)).toContain('Học viên tiền gửi Demo');
    await submit(drawer);

    expect(screen.lastCall(assignmentEndpoints.replaceMembers)?.body).toEqual({
      expectedVersion: 0,
      userIds: ['000004'],
    });
    expect(screen.drawer()).toBeNull();
    expect(rows().some((r) => r.includes('Kế toán giao dịch'))).toBe(true);
  });
});
