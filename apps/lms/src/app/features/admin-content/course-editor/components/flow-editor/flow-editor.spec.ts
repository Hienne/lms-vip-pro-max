import { Dialog } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { FlowModel } from '@lms/contracts';
import { NAPAS_FLOW } from '@lms/mocks';
import { of } from 'rxjs';
import { FlowCanvas } from '../../../../../shared/flow/flow-canvas/flow-canvas';
import {
  FLOW_REDUCED_MOTION,
  FLOW_WEBGL,
} from '../../../../../shared/flow/flow-support';
import { FlowEditor } from './flow-editor';

/** Stands in for the three.js canvas, which jsdom cannot draw. */
@Component({ selector: 'app-flow-canvas', template: '' })
class FakeCanvas {}

async function render(flow: FlowModel, wide = true) {
  TestBed.configureTestingModule({
    providers: [
      { provide: FLOW_WEBGL, useValue: true },
      { provide: FLOW_REDUCED_MOTION, useValue: false },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: wide, breakpoints: {} }) },
      },
    ],
  });
  TestBed.overrideComponent(FlowEditor, {
    remove: { imports: [FlowCanvas] },
    add: { imports: [FakeCanvas] },
  });
  const fixture = TestBed.createComponent(FlowEditor);
  const changes: FlowModel[] = [];
  fixture.componentRef.setInput('flow', flow);
  fixture.componentInstance.flowChange.subscribe((f) => changes.push(f));
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement, changes };
}

const buttons = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('button')].filter((b) =>
    b.textContent?.includes(label),
  );

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

afterEach(() => {
  TestBed.inject(Dialog).closeAll();
  document.querySelector('.cdk-overlay-container')?.remove();
});

describe('FlowEditor', () => {
  it('shows a summary in the drawer and builds in the full-screen dialog', async () => {
    const { fixture, el, changes } = await render({
      version: 1,
      objects: [],
      steps: [],
    });
    expect(el.textContent).toContain('0 đối tượng · 0 bước chuyển');
    expect(el.querySelector('app-flow-canvas')).toBeNull();
    expect(dialog()).toBeNull();

    buttons(el, 'Mở trình dựng 3D')[0].click();
    await fixture.whenStable();
    const builder = dialog()!;
    expect(builder.textContent).toContain('Trình dựng Mô phỏng luồng');
    expect(document.querySelector('.drawer-pane--full')).not.toBeNull();
    expect(builder.querySelector('app-flow-canvas')).not.toBeNull();
    expect(builder.textContent).toContain(
      'Kéo một đối tượng từ bảng bên trái xuống sàn để bắt đầu.',
    );
    expect(builder.textContent).toContain(
      'Bấm vào một đối tượng trên sàn để đổi tên, đổi loại hoặc xóa.',
    );
    expect(builder.querySelector('app-flow-player-bar')).not.toBeNull();
    expect(builder.textContent).toContain(
      'Nối hai đối tượng để có bước chuyển đầu tiên.',
    );

    buttons(builder, 'Cơ sở dữ liệu')[0].click();
    await fixture.whenStable();
    expect(changes.at(-1)?.objects).toEqual([
      { id: 'o1', name: 'Cơ sở dữ liệu', kind: 'database', x: 0, z: 0 },
    ]);
    expect(builder.textContent).toContain('1/30 đối tượng');
    expect(buttons(builder, 'Bỏ chọn')).toHaveLength(1);

    buttons(builder, 'Xong')[0].click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(el.textContent).toContain('1 đối tượng · 0 bước chuyển');
  });

  it('lists the steps with their route in the summary', async () => {
    const { el } = await render(NAPAS_FLOW);
    expect(el.textContent).toContain(
      `${NAPAS_FLOW.objects.length} đối tượng · 9 bước chuyển`,
    );
    expect(el.textContent).toContain('Core Banking → tự xử lý');
  });

  it('below lg shows the notice and edits the lists in place, with no scene', async () => {
    const { fixture, el, changes } = await render(NAPAS_FLOW, false);
    expect(el.textContent).toContain('Trình dựng 3D cần màn hình rộng hơn');
    expect(el.querySelector('app-flow-canvas')).toBeNull();
    expect(buttons(el, 'Mở trình dựng 3D')).toHaveLength(0);
    expect(el.textContent).toContain('Bước chuyển (9/100)');

    el.querySelector<HTMLButtonElement>('[aria-label="Sửa bước"]')!.click();
    await fixture.whenStable();
    const title = el.querySelector<HTMLInputElement>(
      'app-flow-step-form input',
    )!;
    title.value = 'Khách hàng mở ứng dụng';
    title.dispatchEvent(new Event('input'));
    buttons(el, 'Lưu bước')[0].click();
    await fixture.whenStable();
    expect(changes.at(-1)?.steps[0].title).toBe('Khách hàng mở ứng dụng');
    expect(el.querySelector('app-flow-step-form')).toBeNull();
  });
});
