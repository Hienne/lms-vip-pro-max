import { Dialog } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { FlowModel } from '@lms/contracts';
import { NAPAS_FLOW } from '@lms/mocks';
import { of } from 'rxjs';
import { FlowCanvas } from '../../../../../shared/flow/flow-canvas/flow-canvas';
import { FLOW_WEBGL } from '../../../../../shared/flow/flow-support';
import { FlowEditor } from './flow-editor';

/** Stands in for the three.js canvas, which jsdom cannot draw. */
@Component({ selector: 'app-flow-canvas', template: '' })
class FakeCanvas {}

async function render(flow: FlowModel, wide = true) {
  TestBed.configureTestingModule({
    providers: [
      { provide: FLOW_WEBGL, useValue: true },
      { provide: Dialog, useValue: { open: () => ({ closed: of(true) }) } },
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

const buttons = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll('button')].filter((b) =>
    b.textContent?.includes(label),
  );

describe('FlowEditor', () => {
  it('starts an empty block with the starter hint and adds a Đối tượng from the palette', async () => {
    const { fixture, el, changes } = await render({
      version: 1,
      objects: [],
      steps: [],
    });
    expect(el.textContent).toContain(
      'Kéo một đối tượng từ bảng bên trái xuống sàn để bắt đầu.',
    );
    expect(el.textContent).toContain('0/30 đối tượng');
    buttons(el, 'Cơ sở dữ liệu')[0].click();
    await fixture.whenStable();
    expect(changes.at(-1)?.objects).toEqual([
      { id: 'o1', name: 'Cơ sở dữ liệu', kind: 'database', x: 0, z: 0 },
    ]);
    expect(el.textContent).toContain('1/30 đối tượng');
    expect(el.textContent).toContain('Đối tượng đang chọn');
  });

  it('lists the steps with their route and edits one in the form', async () => {
    const { fixture, el, changes } = await render(NAPAS_FLOW);
    expect(el.textContent).toContain('Bước chuyển (9/100)');
    expect(el.textContent).toContain('Core Banking → tự xử lý');
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

  it('below lg shows the notice and no scene, keeping list editing', async () => {
    const { el } = await render(NAPAS_FLOW, false);
    expect(el.textContent).toContain('Trình dựng 3D cần màn hình rộng hơn');
    expect(el.querySelector('app-flow-canvas')).toBeNull();
    expect(el.querySelectorAll('[aria-label="Sửa bước"]')).toHaveLength(9);
  });
});
