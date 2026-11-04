import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Stepper, type StepperItem } from './stepper';

@Component({
  imports: [Stepper],
  template: `<ui-stepper
    label="Các bước tạo khóa học"
    [steps]="steps()"
    [linear]="linear()"
    [(selectedIndex)]="current"
  />`,
})
class Host {
  readonly steps = signal<readonly StepperItem[]>([
    { label: 'Thông tin', subtitle: 'Tên, mã, lĩnh vực' },
    { label: 'Nội dung' },
    { label: 'Bài thi' },
    { label: 'Xuất bản' },
  ]);
  readonly linear = signal(false);
  readonly current = signal(1);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const steps = () =>
    Array.from(root.querySelectorAll<HTMLElement>('.stepper__step'));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, root, steps, settle, host: fixture.componentInstance };
}

const text = (el: Element | null | undefined) =>
  el?.textContent?.replace(/\s+/g, ' ').trim();

describe('Stepper', () => {
  it('is a named ordered list with a title (and optional subtitle) per step', async () => {
    const { root, steps } = await render();
    expect(root.querySelector('ol.stepper')?.getAttribute('aria-label')).toBe(
      'Các bước tạo khóa học',
    );
    expect(
      steps().map((s) => text(s.querySelector('.stepper__title'))),
    ).toEqual(['Thông tin', 'Nội dung', 'Bài thi', 'Xuất bản']);
    expect(text(steps()[0].querySelector('.stepper__sub'))).toBe(
      'Tên, mã, lĩnh vực',
    );
    expect(steps()[1].querySelector('.stepper__sub')).toBeNull();
  });

  it('marks the current step with aria-current="step" and no other', async () => {
    const { steps } = await render();
    expect(steps().map((s) => s.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
      null,
    ]);
  });

  it('shows a check and "Đã hoàn thành" for done steps and numbers for the others', async () => {
    const { steps } = await render();
    expect(steps()[0].classList.contains('is-done')).toBe(true);
    expect(steps()[0].querySelector('.stepper__num ui-icon')).not.toBeNull();
    expect(text(steps()[0].querySelector('.sr-only'))).toBe('Đã hoàn thành');
    expect(text(steps()[1].querySelector('.stepper__num'))).toBe('2');
    expect(text(steps()[3].querySelector('.stepper__num'))).toBe('4');
    expect(steps()[2].classList.contains('is-done')).toBe(false);
  });

  it('marks the item of a done step so its connector turns primary, and adds no connector markup', async () => {
    const { root } = await render();
    const items = Array.from(root.querySelectorAll('li.stepper__item'));
    expect(items.map((li) => li.classList.contains('is-done'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    items.forEach((li) => expect(li.children).toHaveLength(1));
  });

  it('goes to a clicked step and reports it through selectedIndexChange', async () => {
    const { steps, settle, host } = await render();
    steps()[3].click();
    await settle();
    expect(host.current()).toBe(3);
    expect(steps()[3].getAttribute('aria-current')).toBe('step');
    expect(steps()[2].classList.contains('is-done')).toBe(true);
  });

  it('follows selectedIndex when it changes from outside', async () => {
    const { steps, settle, host } = await render();
    host.current.set(0);
    await settle();
    expect(steps().map((s) => s.getAttribute('aria-current'))).toEqual([
      'step',
      null,
      null,
      null,
    ]);
  });

  it('in linear mode blocks jumping past a step that is not completed', async () => {
    const { steps, settle, host } = await render();
    host.linear.set(true);
    await settle();
    steps()[3].click();
    await settle();
    expect(host.current()).toBe(1);
    expect(steps()[3].getAttribute('aria-disabled')).toBe('true');
  });

  it('in linear mode lets the learner go back and onto the next step once the current one is completed', async () => {
    const { steps, settle, host } = await render();
    host.linear.set(true);
    host.steps.update((all) =>
      all.map((s, i) => (i === 1 ? { ...s, completed: true } : s)),
    );
    await settle();
    steps()[2].click();
    await settle();
    expect(host.current()).toBe(2);
    steps()[0].click();
    await settle();
    expect(host.current()).toBe(0);
  });

  it('keeps one step in the tab order and moves focus with the arrow keys', async () => {
    const { steps, settle } = await render();
    expect(
      steps().filter((s) => s.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    steps()[1].focus();
    steps()[1].dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        keyCode: 39,
      }),
    );
    await settle();
    expect(document.activeElement).toBe(steps()[2]);
  });
});
