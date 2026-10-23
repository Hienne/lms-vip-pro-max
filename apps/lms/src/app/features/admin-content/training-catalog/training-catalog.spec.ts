import { trainingCatalogEndpoints } from '@lms/contracts';
import { setUpAdminScreen } from '../admin-content.testing';

describe('TrainingCatalog', () => {
  const screen = setUpAdminScreen();
  const rows = () =>
    Array.from(screen.el.querySelectorAll('tbody tr')).map((r) =>
      screen.text(r),
    );
  const tab = (name: string) =>
    Array.from(screen.el.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (t) => t.textContent?.includes(name),
    );

  it('lists the fields of the caller org with their state', async () => {
    await screen.open('/admin/catalog');

    expect(screen.lastCall(trainingCatalogEndpoints.listFields)?.query).toEqual(
      { ownerOrgId: '1', size: '100' },
    );
    expect(rows()).toHaveLength(4);
    expect(rows()[0]).toContain('Nghiệp vụ Core Banking');
    expect(rows()[0]).toContain('Đã xuất bản');
  });

  it('lists the modules of one field at a time', async () => {
    await screen.open('/admin/catalog');
    await screen.click(tab('Phân hệ'));

    expect(rows().map((r) => r.split(' ')[0])).toContain('Tổng');
    expect(rows()).toHaveLength(4);

    const field = screen.el.querySelector<HTMLSelectElement>(
      '.training-catalog__filter select',
    )!;
    await screen.choose(field, '3');

    expect(
      screen.lastCall(trainingCatalogEndpoints.listModules)?.query,
    ).toEqual({ fieldId: '3', size: '100' });
    expect(rows().join()).toContain('Vận hành EOD');
  });

  it('adds a program after checking the form, under the owner org', async () => {
    await screen.open('/admin/catalog');
    await screen.click(tab('Chương trình'));
    await screen.click(screen.button('Thêm chương trình'));

    const drawer = screen.drawer()!;
    await screen.click(screen.button('Lưu', drawer));
    expect(screen.text(drawer)).toContain('Nhập mã.');
    expect(screen.callsTo(trainingCatalogEndpoints.createProgram)).toBe(0);

    await screen.type(
      screen.field('Mã', drawer) as HTMLInputElement,
      ' VH-02 ',
    );
    await screen.type(
      screen.field('Tên', drawer) as HTMLInputElement,
      'Vận hành nâng cao',
    );
    await screen.choose(
      screen.field('Lĩnh vực', drawer) as HTMLSelectElement,
      '3',
    );
    await screen.click(screen.button('Lưu', drawer));

    expect(
      screen.lastCall(trainingCatalogEndpoints.createProgram)?.body,
    ).toEqual({
      ownerOrgId: 1,
      fieldId: 3,
      code: 'VH-02',
      name: 'Vận hành nâng cao',
      status: 'draft',
    });
    expect(screen.drawer()).toBeNull();
    expect(rows().join()).toContain('Vận hành nâng cao');
    expect(screen.text(document.body)).toContain('Đã thêm chương trình');
  });

  it('edits a field with the version it read, and keeps its order', async () => {
    await screen.open('/admin/catalog');
    await screen.click(screen.button('Sửa Công nghệ & hạ tầng'));

    const drawer = screen.drawer()!;
    expect(screen.text(drawer)).toContain('Sửa lĩnh vực CN');
    await screen.choose(
      screen.field('Trạng thái', drawer) as HTMLSelectElement,
      'paused',
    );
    await screen.click(screen.button('Lưu', drawer));

    const call = screen.lastCall(trainingCatalogEndpoints.updateField);
    expect(call?.params).toEqual({ id: '2' });
    expect(call?.query).toEqual({ expectedVersion: '0' });
    expect(call?.body).toMatchObject({
      code: 'CN',
      status: 'paused',
      sortNo: 2,
    });
    expect(rows()[1]).toContain('Tạm dừng');
  });
});
