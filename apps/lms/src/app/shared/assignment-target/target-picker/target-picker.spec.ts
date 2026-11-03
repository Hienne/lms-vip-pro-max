import { organizationEndpoints, assignmentEndpoints } from '@lms/contracts';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';

/** The picker is exercised where it is hosted: the assign drawer of "Giao học & hạn". */
describe('TargetPicker', () => {
  const screen = setUpAdminScreen();

  async function openPicker(): Promise<HTMLElement> {
    await screen.open('/admin/assignments');
    await screen.click(screen.button('Giao khóa học'));
    return screen.drawer()!;
  }

  const type = (drawer: HTMLElement, label: string) =>
    screen.click(
      Array.from(drawer.querySelectorAll<HTMLElement>('[role="option"]')).find(
        (o) => o.textContent?.trim() === label,
      ),
    );

  it('adds a unit with its sub-units by default and clears the pick', async () => {
    const drawer = await openPicker();
    const add = screen.button('Thêm', drawer)!;
    expect(add.disabled).toBe(true);
    await screen.choose(
      screen.field('Đơn vị', drawer) as HTMLSelectElement,
      '1',
    );
    expect(add.disabled).toBe(false);
    await screen.click(add);
    expect(screen.text(drawer)).toContain('và đơn vị cấp dưới');
    expect(add.disabled).toBe(true);
  });

  it('forgets the pick when the type changes', async () => {
    const drawer = await openPicker();
    await screen.choose(
      screen.field('Đơn vị', drawer) as HTMLSelectElement,
      '1',
    );
    expect(screen.button('Thêm', drawer)!.disabled).toBe(false);
    await type(drawer, 'Phòng/nhóm');
    expect((screen.field('Đơn vị', drawer) as HTMLSelectElement).value).toBe(
      '',
    );
    expect(screen.button('Thêm', drawer)!.disabled).toBe(true);
  });

  it('offers the teams of the chosen org only once an org is chosen', async () => {
    const drawer = await openPicker();
    await type(drawer, 'Phòng/nhóm');
    expect(screen.field('Phòng/nhóm', drawer)).toBeDefined();
    expect(screen.callsTo(organizationEndpoints.listTeams)).toBe(0);
    await screen.choose(
      screen.field('Đơn vị', drawer) as HTMLSelectElement,
      '1',
    );
    expect(screen.lastCall(organizationEndpoints.listTeams)).toMatchObject({
      params: { orgId: '1' },
    });
    const team = screen.field('Phòng/nhóm', drawer) as HTMLSelectElement;
    expect(team.options.length).toBeGreaterThan(1);
    await screen.choose(team, team.options[1].value);
    await screen.click(screen.button('Thêm', drawer));
    expect(screen.text(drawer)).toContain(' · Ban Quản lý');
  });

  it('lists the learning groups of the caller’s org', async () => {
    const drawer = await openPicker();
    await type(drawer, 'Nhóm học tập');
    expect(screen.lastCall(assignmentEndpoints.listGroups)).toMatchObject({
      query: { ownerOrgId: '1' },
    });
    expect(screen.field('Nhóm học tập', drawer)).toBeDefined();
  });
});
