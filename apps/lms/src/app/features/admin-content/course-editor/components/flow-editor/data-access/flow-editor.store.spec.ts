import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { FLOW_LIMITS } from '@lms/contracts';
import { NAPAS_FLOW } from '@lms/mocks';
import { of } from 'rxjs';
import { FlowEditorStore } from './flow-editor.store';

function setup(answer = true) {
  const open = vi.fn(() => ({ closed: of(answer) }));
  TestBed.configureTestingModule({
    providers: [FlowEditorStore, { provide: Dialog, useValue: { open } }],
  });
  return { store: TestBed.inject(FlowEditorStore), open };
}

describe('FlowEditorStore', () => {
  it('adds by kind at the next free spot or at a cell, with default names, and selects it', () => {
    const { store } = setup();
    const a = store.addObject('system')!;
    const b = store.addObject('system')!;
    const c = store.addObject('customer', { x: 6, z: -3 })!;
    const [first, second, third] = store.objects$();
    expect(first).toMatchObject({
      id: a,
      name: 'Hệ thống nội bộ',
      x: 0,
      z: 0,
    });
    expect(second.name).toBe('Hệ thống nội bộ 2');
    expect([second.x, second.z]).not.toEqual([0, 0]);
    expect(third).toMatchObject({ id: c, name: 'Khách hàng', x: 6, z: -3 });
    expect(store.selectedId$()).toBe(c);
    expect(store.objectCount$()).toBe('3/30 đối tượng');
    expect(b).not.toBe(a);
  });

  it('refuses an occupied cell and the 31st Đối tượng', () => {
    const { store } = setup();
    store.addObject('queue', { x: 0, z: 0 });
    expect(store.addObject('queue', { x: 0, z: 0 })).toBeNull();
    for (let i = 1; i < FLOW_LIMITS.objects; i++) store.addObject('queue');
    expect(store.objects$()).toHaveLength(30);
    expect(store.addObject('queue')).toBeNull();
    expect(store.canAddObject$()).toBe(false);
  });

  it('moves, renames and changes kind; a move onto another Đối tượng is refused', () => {
    const { store } = setup();
    store.setFlow(NAPAS_FLOW);
    store.moveObject('kh', -9, 2);
    store.moveObject('app', 0, 0);
    store.renameObject('kh', 'Người gửi');
    store.setKind('gw', 'system');
    const byId = (id: string) => store.objects$().find((o) => o.id === id)!;
    expect(byId('kh')).toMatchObject({ x: -9, z: 2, name: 'Người gửi' });
    expect(byId('app')).toMatchObject({ x: -3, z: 0 });
    expect(byId('gw').kind).toBe('system');
  });

  it('deletes a Đối tượng without steps at once', () => {
    const { store, open } = setup();
    store.addObject('document');
    store.removeObject(store.objects$()[0].id);
    expect(store.objects$()).toHaveLength(0);
    expect(open).not.toHaveBeenCalled();
  });

  it('asks before deleting a Đối tượng with steps, and deletes them too on confirm', () => {
    const { store, open } = setup(true);
    store.setFlow(NAPAS_FLOW);
    store.removeObject('napas');
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Xóa “NAPAS”?',
          message: '2 bước chuyển có đối tượng này cũng sẽ bị xóa.',
          confirmLabel: 'Xóa đối tượng và 2 bước',
          tone: 'danger',
        }),
      }),
    );
    expect(store.objects$().some((o) => o.id === 'napas')).toBe(false);
    expect(store.steps$().map((s) => s.id)).not.toContain('s6');
    expect(store.steps$()).toHaveLength(7);
  });

  it('keeps everything when the delete is cancelled', () => {
    const { store } = setup(false);
    store.setFlow(NAPAS_FLOW);
    store.removeObject('napas');
    expect(store.flow$()).toBe(NAPAS_FLOW);
  });

  it('links to another Đối tượng and to itself, opening a fresh form; cancelling removes the fresh step', () => {
    const { store } = setup();
    store.setFlow(NAPAS_FLOW);
    const id = store.link('kh', 'core')!;
    expect(store.steps$().at(-1)).toMatchObject({
      id,
      from: 'kh',
      to: 'core',
      title: 'Khách hàng gửi cho Core Banking',
    });
    expect(store.editingStepId$()).toBe(id);
    expect(store.freshStepId$()).toBe(id);
    store.closeStep(false);
    expect(store.steps$()).toHaveLength(9);

    const own = store.link('core', null)!;
    store.updateStep(own, { title: 'Hạch toán', description: 'Ghi sổ' });
    store.closeStep(true);
    expect(store.steps$().at(-1)).toMatchObject({
      to: null,
      title: 'Hạch toán',
      description: 'Ghi sổ',
    });
    expect(store.freshStepId$()).toBeNull();
    expect(store.link('kh', 'kh')).toBeNull();
    expect(store.link('kh', 'ghost')).toBeNull();
  });

  it('reorders, edits and deletes steps; the 101st step is refused', () => {
    const { store } = setup();
    store.setFlow(NAPAS_FLOW);
    store.moveStep(8, 0);
    expect(store.steps$()[0].id).toBe('s9');
    store.moveStepBy('s9', 1);
    expect(
      store
        .steps$()
        .slice(0, 2)
        .map((s) => s.id),
    ).toEqual(['s1', 's9']);
    store.moveStepBy('s9', -1);
    store.updateStep('s1', { to: 'kh' });
    expect(store.steps$().find((s) => s.id === 's1')?.to).toBeNull();
    store.removeStep('s2');
    expect(store.steps$()).toHaveLength(8);
    while (store.canAddStep$()) store.link('kh', 'app');
    expect(store.steps$()).toHaveLength(100);
    expect(store.link('kh', 'app')).toBeNull();
    expect(store.stepCount$()).toBe('Bước chuyển (100/100)');
  });

  it('keeps the document it reported when the form hands the same one back', () => {
    const { store } = setup();
    store.addObject('customer');
    const reported = store.flow$();
    store.load(reported);
    expect(store.flow$()).toBe(reported);
    store.load(NAPAS_FLOW);
    expect(store.flow$()).toBe(NAPAS_FLOW);
  });
});
