import {
  afterNextRender,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
} from '@angular/core';

/** One line of the summary: the message and the `id` of the control it is about. */
export interface ErrorSummaryItem {
  readonly controlId: string;
  readonly message: string;
}

/**
 * The list of everything wrong in a form, shown after a submit attempt. It is an alert and takes
 * focus once, when it appears, so render it with `@if` in response to a submit. Later changes to
 * `items` (the user fixing fields) do not move focus. Each message is a link that focuses its
 * control.
 */
@Component({
  selector: 'ui-error-summary',
  host: { class: 'error-summary', role: 'alert', tabindex: '-1' },
  template: `
    <strong>{{ heading() }}</strong>
    <ul>
      @for (item of items(); track $index) {
        <li>
          <a
            [attr.href]="'#' + item.controlId"
            (click)="focusControl($event, item.controlId)"
            >{{ item.message }}</a
          >
        </li>
      }
    </ul>
  `,
})
export class ErrorSummary {
  readonly items = input.required<readonly ErrorSummaryItem[]>();
  readonly heading = input('Vui lòng sửa các lỗi sau:');

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.host.nativeElement.focus());
  }

  protected focusControl(event: Event, controlId: string): void {
    event.preventDefault();
    this.document.getElementById(controlId)?.focus();
  }
}
