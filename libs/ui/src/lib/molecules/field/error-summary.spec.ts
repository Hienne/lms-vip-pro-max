import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  form,
  FormField,
  required,
  submit,
  type FieldTree,
} from '@angular/forms/signals';
import { Input } from '../../atoms/input/input.directive';
import { ErrorSummary, type ErrorSummaryItem } from './error-summary';
import { Field } from './field';

@Component({
  imports: [ErrorSummary, Field, Input, FormField],
  template: `
    <form (submit)="onSubmit($event)">
      @if (items().length > 0) {
        <ui-error-summary [items]="items()" />
      }
      <ui-field label="Tên khóa học" [errors]="messages(f.title)">
        <input uiInput id="title" [formField]="f.title" />
      </ui-field>
      <ui-field label="Email" [errors]="messages(f.email)">
        <input uiInput id="email" [formField]="f.email" />
      </ui-field>
      <button type="submit">Lưu</button>
    </form>
  `,
})
class Host {
  readonly model = signal({ title: '', email: '' });
  readonly f = form(this.model, (p) => {
    required(p.title, { message: 'Tên khóa học là bắt buộc.' });
    required(p.email, { message: 'Email là bắt buộc.' });
  });
  readonly submitted = signal(false);
  readonly items = computed<ErrorSummaryItem[]>(() =>
    this.submitted()
      ? [
          ...this.f
            .title()
            .errors()
            .map((e) => ({
              controlId: 'title',
              message: e.message ?? '',
            })),
          ...this.f
            .email()
            .errors()
            .map((e) => ({
              controlId: 'email',
              message: e.message ?? '',
            })),
        ]
      : [],
  );
  messages(field: FieldTree<string>) {
    return this.submitted()
      ? field()
          .errors()
          .map((e) => e.message ?? '')
      : [];
  }
  onSubmit(event: Event) {
    event.preventDefault();
    void submit(this.f, async () => undefined);
    this.submitted.set(true);
  }
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  document.body.append(fixture.nativeElement);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const submitForm = async () => {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, root, host: fixture.componentInstance, submitForm };
}

describe('ErrorSummary', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is absent until there are errors, then lists them under a heading', async () => {
    const { root, submitForm } = await render();
    expect(root.querySelector('ui-error-summary')).toBeNull();
    await submitForm();
    const summary = root.querySelector('ui-error-summary') as HTMLElement;
    expect(summary.querySelector('strong')?.textContent).toBe(
      'Vui lòng sửa các lỗi sau:',
    );
    const links = Array.from(summary.querySelectorAll('li a'));
    expect(links.map((a) => a.textContent)).toEqual([
      'Tên khóa học là bắt buộc.',
      'Email là bắt buộc.',
    ]);
  });

  it('announces itself as an alert', async () => {
    const { root, submitForm } = await render();
    await submitForm();
    expect(root.querySelector('ui-error-summary')?.getAttribute('role')).toBe(
      'alert',
    );
  });

  it('receives focus when shown', async () => {
    const { root, submitForm } = await render();
    await submitForm();
    expect(document.activeElement).toBe(root.querySelector('ui-error-summary'));
  });

  it('does not take focus again when the list of errors changes', async () => {
    const { fixture, root, host, submitForm } = await render();
    await submitForm();
    (root.querySelector('#title') as HTMLElement).focus();
    host.model.update((m) => ({ ...m, title: 'Quy trình đối soát' }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('#title'));
  });

  it('links to the matching control and focuses it on click', async () => {
    const { root, submitForm } = await render();
    await submitForm();
    const links = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('ui-error-summary a'),
    );
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#title',
      '#email',
    ]);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    links[1].dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('#email'));
  });

  it('uses a custom heading', async () => {
    @Component({
      imports: [ErrorSummary],
      template: `<ui-error-summary
        heading="Có 1 lỗi"
        [items]="[{ controlId: 'x', message: 'Sai' }]"
      />`,
    })
    class Custom {}
    const fixture = TestBed.createComponent(Custom);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('strong').textContent).toBe(
      'Có 1 lỗi',
    );
  });
});
