import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  email,
  form,
  FormField,
  required,
  type FieldTree,
} from '@angular/forms/signals';
import { Checkbox } from '../../atoms/checkbox/checkbox.directive';
import { Input } from '../../atoms/input/input.directive';
import { Select } from '../../atoms/select/select.directive';
import { Textarea } from '../../atoms/textarea/textarea.directive';
import { Field } from './field';

@Component({
  imports: [Field, Input, Select, Textarea, Checkbox, FormField],
  template: `
    <ui-field
      label="Tên khóa học"
      required
      hint="Tối đa 120 ký tự."
      [errors]="titleErrors()"
    >
      <input uiInput [formField]="f.title" />
    </ui-field>
    <ui-field label="Email" [errors]="emailErrors()">
      <input
        uiInput
        id="email-input"
        aria-describedby="outside"
        [formField]="f.email"
      />
    </ui-field>
    <ui-field label="Chương trình" [errors]="programErrors()">
      <select uiSelect [formField]="f.program">
        <option value="">— Chọn —</option>
        <option value="1">Nền tảng</option>
      </select>
    </ui-field>
    <ui-field label="Mô tả">
      <textarea uiTextarea [formField]="f.description"></textarea>
    </ui-field>
    <ui-field label="Trộn đáp án" [errors]="shuffleErrors()">
      <input type="checkbox" uiCheckbox [formField]="f.shuffle" />
    </ui-field>
  `,
})
class Host {
  readonly model = signal({
    title: '',
    email: 'sai-dinh-dang',
    program: '',
    description: '',
    shuffle: false,
  });
  readonly f = form(this.model, (p) => {
    required(p.title, { message: 'Tên khóa học là bắt buộc.' });
    email(p.email, { message: 'Email không đúng định dạng.' });
    required(p.program, { message: 'Chọn một chương trình.' });
    required(p.shuffle, { message: 'Cần bật tùy chọn này.' });
  });
  private messages<T>(field: FieldTree<T>) {
    return computed(() =>
      field().touched()
        ? field()
            .errors()
            .map((e) => e.message ?? '')
        : [],
    );
  }
  readonly titleErrors = this.messages(this.f.title);
  readonly emailErrors = this.messages(this.f.email);
  readonly programErrors = this.messages(this.f.program);
  readonly shuffleErrors = this.messages(this.f.shuffle);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const fields = Array.from(root.querySelectorAll('ui-field'));
  return { fixture, root, host: fixture.componentInstance, fields };
}

const ids = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
const controlOf = (field: Element) =>
  field.querySelector('input, select, textarea') as HTMLElement;

describe('Field', () => {
  it('shows a visible label associated with the control', async () => {
    const { fields } = await render();
    for (const field of fields) {
      const label = field.querySelector('label') as HTMLLabelElement;
      expect(label.textContent?.trim()).not.toBe('');
      expect(controlOf(field).id).not.toBe('');
      expect(label.htmlFor).toBe(controlOf(field).id);
    }
  });

  it('keeps an existing control id', async () => {
    const { fields } = await render();
    const label = fields[1].querySelector('label') as HTMLLabelElement;
    expect(label.htmlFor).toBe('email-input');
    expect(controlOf(fields[1]).id).toBe('email-input');
  });

  it('gives different fields different ids', async () => {
    const { fields } = await render();
    const all = fields.map((f) => controlOf(f).id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('marks required fields visually and to assistive tech', async () => {
    const { fields } = await render();
    expect(
      fields[0].querySelector('.field__req')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(controlOf(fields[0]).getAttribute('aria-required')).toBe('true');
    expect(fields[1].querySelector('.field__req')).toBeNull();
    expect(controlOf(fields[1]).hasAttribute('aria-required')).toBe(false);
  });

  it('describes the control by its hint', async () => {
    const { fields } = await render();
    const hint = fields[0].querySelector('.field__help') as HTMLElement;
    expect(hint.textContent).toContain('Tối đa 120 ký tự.');
    expect(ids(controlOf(fields[0]))).toEqual([hint.id]);
  });

  it('shows no errors and no aria-invalid while there are none', async () => {
    const { fields } = await render();
    expect(fields[0].querySelector('.field__error')).toBeNull();
    expect(controlOf(fields[0]).hasAttribute('aria-invalid')).toBe(false);
  });

  it('shows errors under the control, references them and flags the control invalid', async () => {
    const { fixture, fields, host } = await render();
    host.f.title().markAsTouched();
    await fixture.whenStable();
    const error = fields[0].querySelector('.field__error') as HTMLElement;
    const hint = fields[0].querySelector('.field__help') as HTMLElement;
    expect(error.textContent).toContain('Tên khóa học là bắt buộc.');
    expect(controlOf(fields[0]).getAttribute('aria-invalid')).toBe('true');
    expect(ids(controlOf(fields[0]))).toEqual([hint.id, error.id]);
  });

  it('removes the wiring again when the errors go away', async () => {
    const { fixture, fields, host } = await render();
    host.f.title().markAsTouched();
    await fixture.whenStable();
    host.model.update((m) => ({ ...m, title: 'Quy trình đối soát' }));
    await fixture.whenStable();
    const hint = fields[0].querySelector('.field__help') as HTMLElement;
    expect(fields[0].querySelector('.field__error')).toBeNull();
    expect(controlOf(fields[0]).hasAttribute('aria-invalid')).toBe(false);
    expect(ids(controlOf(fields[0]))).toEqual([hint.id]);
  });

  it('keeps describedby references the control already had', async () => {
    const { fixture, fields, host } = await render();
    host.f.email().markAsTouched();
    await fixture.whenStable();
    const error = fields[1].querySelector('.field__error') as HTMLElement;
    expect(ids(controlOf(fields[1]))).toEqual(['outside', error.id]);
  });

  it('wires select, textarea and checkbox atoms', async () => {
    const { fixture, fields, host } = await render();
    host.f.program().markAsTouched();
    host.f.shuffle().markAsTouched();
    await fixture.whenStable();
    for (const index of [2, 3, 4]) {
      const label = fields[index].querySelector('label') as HTMLLabelElement;
      expect(label.htmlFor).toBe(controlOf(fields[index]).id);
    }
    for (const index of [2, 4]) {
      const error = fields[index].querySelector('.field__error') as HTMLElement;
      expect(controlOf(fields[index]).getAttribute('aria-invalid')).toBe(
        'true',
      );
      expect(ids(controlOf(fields[index]))).toEqual([error.id]);
    }
    expect(controlOf(fields[3]).hasAttribute('aria-invalid')).toBe(false);
  });
});
