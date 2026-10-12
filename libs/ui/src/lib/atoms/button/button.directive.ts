import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-ghost'
  | 'on-dark';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * The look of a button on a native `<button>` or `<a>`; semantics stay native (`type`, `href`,
 * `routerLink`, `disabled`, events). Put an icon before or after the text in the markup:
 * `<button uiButton><ui-icon name="play" size="sm" /> Bắt đầu</button>`.
 *
 * - `busy` shows a spinner, sets `aria-busy` and swallows activation (the button keeps focus).
 * - `disabled` is native on a button and, on a link, `aria-disabled` with activation swallowed.
 * - `type` defaults to `button`, so a button in a form never submits by accident.
 */
@Directive({
  selector: 'button[uiButton], a[uiButton]',
  host: {
    class: 'btn',
    '[class]': 'modifiers()',
    '[attr.type]': 'isLink ? null : type()',
    '[attr.disabled]': '!isLink && disabled() ? "" : null',
    '[attr.aria-disabled]': 'linkDisabled() ? "true" : null',
    '[attr.aria-busy]': 'busy() ? "true" : null',
    '[attr.tabindex]': 'linkDisabled() ? "-1" : null',
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });
  readonly busy = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly type = input<ButtonType>('button');

  private readonly element =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly isLink = this.element.tagName === 'A';

  /** A link cannot be natively disabled: announce it instead. (Busy is announced by `aria-busy`.) */
  protected readonly linkDisabled = computed(
    () => this.isLink && this.disabled(),
  );

  protected readonly modifiers = computed(() =>
    [
      `btn--${this.variant()}`,
      this.size() === 'md' ? '' : `btn--${this.size()}`,
      this.block() ? 'btn--block' : '',
      this.busy() ? 'is-loading' : '',
    ].filter(Boolean),
  );

  constructor() {
    // Capture phase, so the guard runs before the consumer's own `(click)` handler.
    const guard = (event: Event) => {
      if (this.busy() || this.linkDisabled()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    this.element.addEventListener('click', guard, true);
    inject(DestroyRef).onDestroy(() =>
      this.element.removeEventListener('click', guard, true),
    );
  }
}
