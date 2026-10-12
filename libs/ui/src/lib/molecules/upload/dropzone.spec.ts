import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Dropzone } from './dropzone.directive';

@Component({
  imports: [Dropzone],
  template: `<label
    uiDropzone
    accept=".pdf"
    multiple
    (files)="received.push($event)"
  >
    Kéo thả hoặc chọn tệp
    <input type="file" hidden />
  </label>`,
})
class Host {
  readonly received: File[][] = [];
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const zone = root.querySelector('label') as HTMLElement;
  const input = root.querySelector('input') as HTMLInputElement;
  return { fixture, zone, input, host: fixture.componentInstance };
}

const pdf = () => new File(['x'], 'so-tay.pdf', { type: 'application/pdf' });

function dragEvent(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

describe('Dropzone', () => {
  it('is a focusable button-like zone that passes accept and multiple to the file input', () => {
    const { zone, input } = render();
    expect(zone.classList.contains('dropzone')).toBe(true);
    expect(zone.getAttribute('tabindex')).toBe('0');
    expect(input.accept).toBe('.pdf');
    expect(input.multiple).toBe(true);
  });

  it('marks the zone while a drag is over it and clears the mark on leave and drop', () => {
    const { fixture, zone } = render();
    zone.dispatchEvent(dragEvent('dragover'));
    fixture.detectChanges();
    expect(zone.classList.contains('is-over')).toBe(true);
    zone.dispatchEvent(dragEvent('dragleave'));
    fixture.detectChanges();
    expect(zone.classList.contains('is-over')).toBe(false);
    zone.dispatchEvent(dragEvent('dragover'));
    zone.dispatchEvent(dragEvent('drop', [pdf()]));
    fixture.detectChanges();
    expect(zone.classList.contains('is-over')).toBe(false);
  });

  it('keeps the mark while the pointer moves onto an element inside the zone', () => {
    const { fixture, zone, input } = render();
    zone.dispatchEvent(dragEvent('dragover'));
    const leave = dragEvent('dragleave');
    Object.defineProperty(leave, 'relatedTarget', { value: input });
    zone.dispatchEvent(leave);
    fixture.detectChanges();
    expect(zone.classList.contains('is-over')).toBe(true);
  });

  it('emits dropped files and prevents the browser from opening them', () => {
    const { zone, host } = render();
    const file = pdf();
    const drop = dragEvent('drop', [file]);
    zone.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(host.received).toEqual([[file]]);
  });

  it('emits the files chosen in the picker through the same output, then resets the input', () => {
    const { input, host } = render();
    const file = pdf();
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(host.received).toEqual([[file]]);
    expect(input.value).toBe('');
  });

  it('opens the picker from the keyboard with Enter or Space', () => {
    const { zone, input } = render();
    const open = vi.spyOn(input, 'click');
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      zone.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys and empty selections', () => {
    const { zone, input, host } = render();
    const open = vi.spyOn(input, 'click');
    zone.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(open).not.toHaveBeenCalled();
    expect(host.received).toEqual([]);
  });
});
