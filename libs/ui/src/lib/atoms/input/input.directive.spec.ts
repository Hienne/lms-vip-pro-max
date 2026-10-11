import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ControlSize } from '../control-size';
import { Input } from './input.directive';

@Component({
  imports: [Input],
  template: `<input
    uiInput
    type="email"
    name="email"
    placeholder="Email"
    required
    [size]="size()"
    [disabled]="disabled()"
    [attr.aria-invalid]="invalid() ? 'true' : null"
  />`,
})
class Host {
  readonly size = signal<ControlSize>('md');
  readonly disabled = signal(false);
  readonly invalid = signal(false);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const input = (fixture.nativeElement as HTMLElement).querySelector(
    'input',
  ) as HTMLInputElement;
  return { fixture, input, host: fixture.componentInstance };
}

describe('Input', () => {
  it('is a native input that keeps its own attributes', () => {
    const { input } = render();
    expect(input.classList.contains('input')).toBe(true);
    expect(input.type).toBe('email');
    expect(input.name).toBe('email');
    expect(input.placeholder).toBe('Email');
    expect(input.required).toBe(true);
  });

  it('is the 40px control by default and the 32px one with size="sm"', () => {
    const { fixture, input, host } = render();
    expect(input.classList.contains('input--sm')).toBe(false);
    host.size.set('sm');
    fixture.detectChanges();
    expect(input.classList.contains('input--sm')).toBe(true);
  });

  it('is disabled natively', () => {
    const { fixture, input, host } = render();
    host.disabled.set(true);
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });

  it('is styled invalid from aria-invalid alone, with no class to set', () => {
    const { fixture, input, host } = render();
    host.invalid.set(true);
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.className).toBe('input');
    const controlStyles = readFileSync(
      join(import.meta.dirname, '../../../styles/components/_control.scss'),
      'utf8',
    );
    expect(controlStyles).toMatch(
      /&\[aria-invalid='true'\]\s*\{\s*border-color: var\(--color-danger\)/,
    );
  });
});
