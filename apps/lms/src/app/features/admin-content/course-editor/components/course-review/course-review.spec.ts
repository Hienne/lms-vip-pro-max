import { TestBed } from '@angular/core/testing';
import {
  assignmentEndpoints,
  courseEndpoints,
  organizationEndpoints,
  type AnyEndpoint,
  type Page,
  type OrganizationInfo,
  type CourseShare,
} from '@lms/contracts';
import { envelopeError, type FakeReply, type FakeRequest } from '@lms/mocks';
import { setUpAdminScreen } from '../../../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../../../core/dev/mock-api/mock-api.interceptor';
import { Sha256Hasher } from '../../data-access/sha256-hasher';
import { FakeHasher } from '../../data-access/fake-hasher.testing';
import { dateInput } from '../../data-access/publish-targets';

/** Step 4 of the editor: who the course is assigned to and shared with, as it is published. */
describe('CourseReview step 4: assignment rows and shares', () => {
  const screen = setUpAdminScreen([
    { provide: Sha256Hasher, useValue: new FakeHasher() },
  ]);
  const original = (endpoint: AnyEndpoint, request: FakeRequest): FakeReply =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint,
      request,
    ) as FakeReply;
  const today = () => dateInput(Date.now());

  async function openStep4(url = '/admin/courses/6/edit') {
    await screen.open(url);
    await screen.click(
      Array.from(
        screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
      ).find((s) => s.textContent?.includes('Đối tượng & xuất bản')),
    );
  }

  /** Picks unit 1 with its sub-units in the picker and adds it as a row. */
  async function addUnitRow() {
    await screen.choose(
      screen.field('Đơn vị', screen.el) as HTMLSelectElement,
      '1',
    );
    await screen.click(screen.button('Thêm đối tượng'));
  }

  const rowInputs = (label: string) =>
    Array.from(
      screen.el.querySelectorAll<HTMLInputElement>(
        `.assign-rows__row input[aria-label^="${label}"]`,
      ),
    );
  const rows = () =>
    Array.from(screen.el.querySelectorAll('.assign-rows__row'));
  const publish = async () => {
    await screen.click(screen.button('Xuất bản khóa học'));
    const dialog = screen.alertDialog();
    if (dialog) await screen.click(screen.button('Xuất bản', dialog));
  };

  /** Two more units, one of them already shared, beside the owner unit 1. */
  function moreUnits() {
    screen.calls.mockImplementation((endpoint, request) => {
      const reply = original(endpoint, request);
      if (endpoint === organizationEndpoints.listOrgs) {
        const page = reply.body.data as Page<OrganizationInfo>;
        const unit = page.items[0];
        return {
          ...reply,
          body: {
            ...reply.body,
            data: {
              ...page,
              items: [
                ...page.items,
                { ...unit, id: 2, code: 'U2', name: 'Chi nhánh Hà Nội' },
                { ...unit, id: 3, code: 'U3', name: 'Chi nhánh Đà Nẵng' },
                {
                  ...unit,
                  id: 4,
                  code: 'U4',
                  name: 'Đơn vị đã đóng',
                  status: 'inactive',
                },
              ],
            },
          },
        };
      }
      if (endpoint === courseEndpoints.shares) {
        const share: CourseShare = {
          id: 1,
          courseId: 6,
          orgId: 3,
          includeDescendants: true,
          canAssign: true,
          canSelfEnroll: false,
          status: 'active',
          rowVersion: 0,
        };
        return { ...reply, body: { ...reply.body, data: [share] } };
      }
      return reply;
    });
  }

  describe('the rows', () => {
    it('starts empty, with the line that says it can wait', async () => {
      await openStep4();
      expect(screen.text()).toContain('Giao khóa học');
      expect(screen.text()).toContain(
        'Chưa thêm đối tượng. Có thể giao sau khi xuất bản.',
      );
      expect(rows()).toHaveLength(0);
    });

    it('adds a picked target as a row starting today with no due date, and removes it', async () => {
      await openStep4();
      await addUnitRow();

      expect(rows()).toHaveLength(1);
      expect(screen.text(rows()[0])).toContain('và đơn vị cấp dưới');
      expect(rowInputs('Bắt đầu')[0].value).toBe(today());
      expect(rowInputs('Hạn hoàn thành')[0].value).toBe('');
      expect(screen.text()).not.toContain('Chưa thêm đối tượng');

      await screen.click(screen.button('Xóa dòng'));
      expect(rows()).toHaveLength(0);
      expect(screen.text()).toContain('Chưa thêm đối tượng');
    });

    it('keeps one row for the same target picked twice', async () => {
      await openStep4();
      await addUnitRow();
      await addUnitRow();
      expect(rows()).toHaveLength(1);
    });

    it('names the line whose due date is before the start, and sends nothing', async () => {
      await openStep4();
      await addUnitRow();
      await screen.type(rowInputs('Bắt đầu')[0], '2026-11-10');
      await screen.type(rowInputs('Hạn hoàn thành')[0], '2026-11-01');

      expect(screen.text(rows()[0])).toContain(
        'Dòng 1: hạn phải sau ngày bắt đầu.',
      );
      await screen.click(screen.button('Xuất bản khóa học'));
      expect(screen.alertDialog()).toBeNull();
      expect(screen.callsTo(courseEndpoints.publish)).toBe(0);

      await screen.type(rowInputs('Hạn hoàn thành')[0], '2026-11-30');
      expect(screen.text(rows()[0])).not.toContain('Dòng 1');
    });
  });

  describe('the previous assignments', () => {
    it('counts the assignments already made and links to the screen that manages them', async () => {
      screen.calls.mockImplementation((endpoint, request) => {
        const reply = original(endpoint, request);
        return endpoint === assignmentEndpoints.courseAssignments
          ? {
              ...reply,
              body: {
                ...reply.body,
                data: {
                  items: [],
                  page: 0,
                  size: 1,
                  totalElements: 2,
                  totalPages: 2,
                },
              },
            }
          : reply;
      });
      await openStep4();
      expect(screen.text()).toContain('Đã giao trước đó: 2 đợt — quản lý tại');
      expect(
        screen.el
          .querySelector('.assign-rows__previous a')
          ?.getAttribute('href'),
      ).toBe('/admin/assignments');
    });

    it('says nothing when there is none', async () => {
      await openStep4();
      expect(screen.text()).not.toContain('Đã giao trước đó');
    });
  });

  describe('the reminder', () => {
    it('is on by default and applies to every row with a due date', async () => {
      await openStep4();
      const toggle = screen.el.querySelector<HTMLInputElement>(
        '.assign-rows__toggle input',
      )!;
      expect(toggle.checked).toBe(true);
      expect(screen.text()).toContain('Tự động nhắc học viên trước hạn 3 ngày');
      await addUnitRow();
      await screen.type(rowInputs('Hạn hoàn thành')[0], '2099-01-01');
      await publish();
      expect(screen.lastCall(courseEndpoints.publish)?.body).toMatchObject({
        assignments: [{ reminderEnabled: true, reminderDaysBefore: 3 }],
      });
    });

    it('can be turned off', async () => {
      await openStep4();
      await addUnitRow();
      await screen.type(rowInputs('Hạn hoàn thành')[0], '2099-01-01');
      await screen.click(
        screen.el.querySelector<HTMLElement>('.assign-rows__toggle input')!,
      );
      await publish();
      expect(screen.lastCall(courseEndpoints.publish)?.body).toMatchObject({
        assignments: [{ reminderEnabled: false }],
      });
    });
  });

  describe('the shares', () => {
    const units = () =>
      Array.from(
        screen.el.querySelectorAll<HTMLElement>('.share-units__unit'),
      ).map((li) => {
        const input = li.querySelector<HTMLInputElement>('input')!;
        return {
          text: screen.text(li).trim(),
          checked: input.checked,
          disabled: input.disabled,
        };
      });

    it('shows the owner unit and the shared units ticked and locked, and leaves out a closed unit', async () => {
      moreUnits();
      await openStep4();
      expect(screen.text()).toContain(
        'Đơn vị được chia sẻ có thể giao khóa cho học viên của mình nhưng không sửa nội dung.',
      );
      expect(units()).toEqual([
        {
          text: expect.stringContaining('(đơn vị sở hữu)'),
          checked: true,
          disabled: true,
        },
        { text: 'Chi nhánh Hà Nội', checked: false, disabled: false },
        {
          text: 'Chi nhánh Đà Nẵng (đã chia sẻ)',
          checked: true,
          disabled: true,
        },
      ]);
    });

    it('sends the ticked units with the publish, and only those', async () => {
      moreUnits();
      await openStep4();
      const hanoi = screen.el.querySelectorAll<HTMLInputElement>(
        '.share-units__unit input',
      )[1];
      await screen.click(hanoi);
      expect(units()[1].checked).toBe(true);
      await publish();
      expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
        expectedVersion: 1,
        shareOrgIds: [2],
      });
    });
  });

  describe('the publish', () => {
    it('sends the rows and shares, the confirmation says how many, and success clears them', async () => {
      moreUnits();
      // The extra units exist only in the list above, so the backend must not look them up.
      const listed = screen.calls.getMockImplementation()!;
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.publish
          ? original(endpoint, {
              ...request,
              body: { ...(request.body as object), shareOrgIds: undefined },
            })
          : listed(endpoint, request),
      );
      await openStep4();
      await addUnitRow();
      await screen.type(rowInputs('Bắt đầu')[0], '2099-01-01');
      await screen.type(rowInputs('Hạn hoàn thành')[0], '2099-02-01');
      await screen.click(
        screen.el.querySelectorAll<HTMLInputElement>(
          '.share-units__unit input',
        )[1],
      );

      await screen.click(screen.button('Xuất bản khóa học'));
      expect(screen.text(screen.alertDialog()!)).toContain(
        '1 đối tượng được giao, 1 đơn vị được chia sẻ.',
      );
      await screen.click(screen.button('Xuất bản', screen.alertDialog()!));

      expect(screen.lastCall(courseEndpoints.publish)?.body).toEqual({
        expectedVersion: 1,
        assignments: [
          {
            startAt: new Date('2099-01-01T00:00:00').toISOString(),
            dueAt: new Date('2099-02-01T17:00:00').toISOString(),
            reminderEnabled: true,
            reminderDaysBefore: 3,
            target: { targetType: 'org', orgId: 1, includeDescendants: true },
          },
        ],
        shareOrgIds: [2],
      });
      await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
      expect(screen.text(document.body)).toContain(
        '1 đối tượng được giao, 1 đơn vị được chia sẻ.',
      );
    });

    it('keeps the confirmation as it was when there is nothing to assign or share', async () => {
      await openStep4();
      await screen.click(screen.button('Xuất bản khóa học'));
      expect(screen.text(screen.alertDialog()!)).not.toContain(
        'đối tượng được giao',
      );
    });

    it('marks the row and the unit a refusal names with the server’s message, and keeps step 4', async () => {
      moreUnits();
      await openStep4();
      await addUnitRow();
      await screen.choose(
        screen.field('Đơn vị', screen.el) as HTMLSelectElement,
        '2',
      );
      await screen.click(screen.button('Thêm đối tượng'));
      await screen.click(
        screen.el.querySelectorAll<HTMLInputElement>(
          '.share-units__unit input',
        )[1],
      );
      const inner = screen.calls.getMockImplementation()!;
      screen.calls.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.publish
          ? {
              status: 200,
              body: envelopeError(
                'CORE-VALIDATION_FAILED',
                'Thông tin chưa hợp lệ',
                'Dữ liệu đầu vào không hợp lệ.',
                [
                  {
                    field: 'assignments[1]',
                    code: 'LEARNING-EMPTY_TARGET',
                    message:
                      'Đối tượng giao không có học viên hợp lệ hoặc vượt giới hạn 500 người.',
                  },
                  {
                    field: 'shareOrgIds[0]',
                    code: 'LEARNING-INVALID_REFERENCE',
                    message:
                      'ID tham chiếu không tồn tại hoặc không đúng quan hệ.',
                  },
                ],
              ),
            }
          : inner(endpoint, request),
      );
      await publish();

      expect(screen.text(rows()[1])).toContain(
        'Đối tượng giao không có học viên hợp lệ',
      );
      expect(screen.text(rows()[0])).not.toContain('Đối tượng giao không có');
      expect(
        screen.text(
          screen.el.querySelectorAll<HTMLElement>('.share-units__unit')[1],
        ),
      ).toContain('ID tham chiếu không tồn tại');
      expect(screen.el.querySelector('.course-editor__notice')).toBeNull();
      expect(screen.url()).toBe('/admin/courses/6/edit');

      // Changing the row takes its mark off; the rows are still there to send again.
      await screen.type(rowInputs('Hạn hoàn thành')[1], '2099-03-01');
      expect(screen.text(rows()[1])).not.toContain('Đối tượng giao không có');
      expect(rows()).toHaveLength(2);
    });
  });

  describe('create mode', () => {
    it('offers the same step, without the previous assignments, and sends the rows after the create', async () => {
      await screen.open('/admin/courses/new');
      await screen.type(
        screen.field('Mã khóa học') as HTMLInputElement,
        'PT-NEW-1',
      );
      await screen.type(
        screen.field('Tên khóa học') as HTMLInputElement,
        'Khóa giao khi tạo',
      );
      await screen.choose(
        screen.field('Chương trình') as HTMLSelectElement,
        '1',
      );
      await screen.click(
        Array.from(
          screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
        ).find((s) => s.textContent?.includes('Nội dung khóa học')),
      );
      await screen.click(screen.button('Thêm chương'));
      await screen.click(screen.button('Thêm bài học'));
      const drawer = screen.drawer()!;
      await screen.type(
        screen.field('Tên bài học', drawer) as HTMLInputElement,
        'Bài đầu tiên',
      );
      await screen.click(screen.button('Văn bản / Markdown', drawer));
      await screen.click(screen.button('Áp dụng', drawer));
      await screen.click(
        Array.from(
          screen.el.querySelectorAll<HTMLElement>('.stepper__step'),
        ).find((s) => s.textContent?.includes('Đối tượng & xuất bản')),
      );
      expect(screen.callsTo(courseEndpoints.shares)).toBe(0);
      expect(screen.callsTo(assignmentEndpoints.courseAssignments)).toBe(0);
      expect(screen.text()).not.toContain('Đã giao trước đó');
      expect(
        screen.el.querySelectorAll('.share-units__unit input:disabled'),
      ).toHaveLength(1);

      await addUnitRow();
      await publish();

      expect(screen.callsTo(courseEndpoints.createCourse)).toBe(1);
      expect(screen.lastCall(courseEndpoints.publish)?.body).toMatchObject({
        expectedVersion: 1,
        assignments: [{ target: { targetType: 'org', orgId: 1 } }],
      });
      await vi.waitFor(() => expect(screen.url()).toBe('/admin/courses'));
    });
  });
});
