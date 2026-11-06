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

  /** The assign drawer, or null while it is closed. */
  const editor = () =>
    document
      .querySelector('app-assign-form')
      ?.closest<HTMLElement>('[role="dialog"]') ?? null;

  /** Opens the assign drawer and adds org 1 with its subtree as the target. */
  async function startAssigning(): Promise<HTMLElement> {
    await screen.open('/admin/assignments');
    await screen.click(screen.button('Giao khóa học'));
    const drawer = editor()!;
    expect(drawer).not.toBeNull();
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
    expect(screen.text()).toContain('Chưa có lượt giao');
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

    const drawer = editor()!;
    expect(drawer).not.toBeNull();
    expect((screen.field('Khóa học', drawer) as HTMLSelectElement).value).toBe(
      linked,
    );
    expect(courseSelect().value).toBe(linked);
  });

  it('assigns the published revision to the chosen targets, then closes and lists it', async () => {
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

    expect(editor()).toBeNull();
    expect(screen.drawer()).toBeNull();
    expect(rows()[0]).toContain('Cán bộ mới quý IV');
    expect(rows()[0]).toContain('Đang hiệu lực');
    const firstRow = screen.el.querySelector('tbody tr')!;
    const date = (iso: string) =>
      new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    const time = screen.text(
      firstRow.querySelector('[data-label="Thời gian"]')!,
    );
    expect(time.match(/\d{2}\/\d{2}\/\d{4}/g)).toEqual([
      date(body.startAt),
      date(body.dueAt!),
    ]);
  });

  it('needs a target and a due date after the start', async () => {
    await screen.open('/admin/assignments');
    await screen.click(screen.button('Giao khóa học'));
    const drawer = editor()!;
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
    expect(editor()).not.toBeNull();

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

  it('lists the chosen targets and drops one on request', async () => {
    const drawer = await startAssigning();
    const course = screen.field('Khóa học', drawer) as HTMLSelectElement;
    expect(course.options[1].text).toContain(' · ');
    expect(screen.text(drawer)).toContain('và đơn vị cấp dưới');
    await screen.type(
      screen.field('Tên đợt giao', drawer) as HTMLInputElement,
      'Đào tạo tháng 11',
    );
    await screen.click(
      drawer.querySelector<HTMLButtonElement>('.assign-form__target button')!,
    );
    expect(drawer.querySelector('.assign-form__target')).toBeNull();
    expect(screen.text(drawer)).toContain('Học viên được xác định lúc giao');
    expect(
      screen.page<{ hasUnsavedChanges(): boolean }>().hasUnsavedChanges(),
    ).toBe(true);
  });

  it('retries loading courses in the editor without losing the draft', async () => {
    const backend = TestBed.inject(MockBackend);
    const original: MockBackend['handle'] = (endpoint, request) =>
      MockBackend.prototype.handle.call(backend, endpoint, request);
    screen.calls.mockImplementation((endpoint, request) =>
      endpoint === courseEndpoints.instructorCourses
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    await screen.open('/admin/assignments?course=1');
    expect(screen.text(editor()!)).toContain('Không tải được khóa học');
    await screen.type(
      screen.field('Tên đợt giao', editor()!) as HTMLInputElement,
      'Bản nháp cần giữ',
    );
    screen.calls.mockImplementation(original);
    await screen.click(screen.button('Thử lại', editor()!));
    expect(screen.text(editor()!)).not.toContain('Không tải được khóa học');
    expect(
      (screen.field('Tên đợt giao', editor()!) as HTMLInputElement).value,
    ).toBe('Bản nháp cần giữ');
    expect(
      (screen.field('Khóa học', editor()!) as HTMLSelectElement).options.length,
    ).toBeGreaterThan(1);
  });

  it('returns to the list on cancel without creating an assignment', async () => {
    await startAssigning();
    await screen.click(screen.button('Hủy', editor()!));
    expect(editor()).toBeNull();
    expect(courseSelect()).not.toBeNull();
    expect(screen.callsTo(assignmentEndpoints.assignCourse)).toBe(0);
    expect(
      screen.page<{ hasUnsavedChanges(): boolean }>().hasUnsavedChanges(),
    ).toBe(false);
    expect(screen.el.querySelectorAll('h1')).toHaveLength(1);
  });

  it('revokes one learner with a reason', async () => {
    const drawer = await startAssigning();
    await submit(drawer);
    await screen.click(
      screen.el.querySelector<HTMLButtonElement>('tbody tr button')!,
    );
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
