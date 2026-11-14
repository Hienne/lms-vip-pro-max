import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Button } from '../../atoms/button/button.directive';
import { Card } from '../../atoms/card/card.directive';
import { CardBody } from '../../atoms/card/card-body.directive';
import { IconButton } from '../../atoms/icon-button/icon-button.directive';
import { Icon } from '../../atoms/icon/icon';
import { Segmented } from '../../molecules/segmented/segmented';

interface TargetBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** A native modal keeps focus in the coach mark; the spotlight points to a visible page region. */
@Component({
  selector: 'ui-guided-tour',
  imports: [Button, Card, CardBody, IconButton, Icon, Segmented],
  template: `
    <dialog
      #dialog
      class="guided-tour"
      aria-labelledby="guided-tour-title"
      aria-describedby="guided-tour-description"
      (cancel)="$event.preventDefault(); dismissed.emit()"
    >
      @if (box(); as box) {
        <div
          class="guided-tour__spotlight"
          aria-hidden="true"
          [style.--tour-target-top.px]="box.top"
          [style.--tour-target-left.px]="box.left"
          [style.--tour-target-right.px]="box.right"
          [style.--tour-target-bottom.px]="box.bottom"
        ></div>
      } @else {
        <div class="guided-tour__shade" aria-hidden="true"></div>
      }
      <section
        uiCard
        class="guided-tour__panel"
        [class.guided-tour__panel--welcome]="welcome()"
      >
        <div uiCardBody class="guided-tour__body">
          <div class="guided-tour__heading">
            <h2 id="guided-tour-title">{{ title() }}</h2>
            <button
              uiIconButton
              type="button"
              label="Đóng hướng dẫn"
              (click)="dismissed.emit()"
            >
              <ui-icon name="x" />
            </button>
          </div>
          @if (!welcome()) {
            <p role="status">Bước {{ index() + 1 }} / {{ total() }}</p>
          }
          <p id="guided-tour-description">{{ description() }}</p>
          @if (welcome() && audiences().length > 1) {
            <ui-segmented
              label="Hướng dẫn theo vai trò"
              [options]="audiences()"
              [value]="audience()"
              (valueChange)="audienceChanged.emit($event)"
            />
          }
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
          <ng-content />
          <div class="guided-tour__actions">
            <button
              uiButton
              type="button"
              variant="ghost"
              (click)="dismissed.emit()"
            >
              Bỏ qua
            </button>
            @if (!welcome()) {
              <button
                uiButton
                type="button"
                [disabled]="index() === 0"
                (click)="previous.emit()"
              >
                Quay lại
              </button>
            }
            <button
              uiButton
              type="button"
              variant="primary"
              autofocus
              (click)="next.emit()"
            >
              {{
                welcome()
                  ? 'Bắt đầu hướng dẫn'
                  : index() + 1 === total()
                    ? 'Hoàn tất'
                    : 'Tiếp theo'
              }}
            </button>
          </div>
        </div>
      </section>
    </dialog>
  `,
})
export class GuidedTour {
  readonly active = input(false);
  readonly welcome = input(false);
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly target = input('');
  readonly index = input(0);
  readonly total = input(0);
  readonly error = input('');
  readonly audiences = input<readonly { value: string; label: string }[]>([]);
  readonly audience = input('');
  readonly audienceChanged = output<string>();
  readonly next = output<void>();
  readonly previous = output<void>();
  readonly dismissed = output<void>();
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly box = signal<TargetBox | null>(null, {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  constructor() {
    afterRenderEffect((cleanup) => {
      const active = this.active(),
        selector = this.target(),
        welcome = this.welcome();
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      untracked(() => {
        if (!active) {
          if (dialog.open) {
            if (typeof dialog.close === 'function') dialog.close();
            else dialog.removeAttribute('open');
          }
          this.box.set(null);
          return;
        }
        if (!dialog.open) {
          if (typeof dialog.showModal === 'function') dialog.showModal();
          else dialog.setAttribute('open', '');
        }
        if (welcome || !selector) {
          this.box.set(null);
          return;
        }
        let target: HTMLElement | undefined;
        let resize: ResizeObserver | undefined;
        const measure = () => {
          if (!target?.isConnected) return;
          const rect = target.getBoundingClientRect();
          this.box.set({
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          });
        };
        const locate = () => {
          target = Array.from(
            this.document.querySelectorAll<HTMLElement>(selector),
          ).find(
            (el) =>
              el.getClientRects().length &&
              this.document.defaultView?.getComputedStyle(el).visibility !==
                'hidden',
          );
          if (!target) return;
          target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
          measure();
          if (typeof ResizeObserver !== 'undefined') {
            resize = new ResizeObserver(measure);
            resize.observe(target);
          }
          observer.disconnect();
        };
        const observer = new MutationObserver(locate);
        observer.observe(this.document.body, {
          subtree: true,
          childList: true,
        });
        this.box.set(null);
        locate();
        const timeout = this.document.defaultView?.setTimeout(
          () => observer.disconnect(),
          5000,
        );
        this.document.defaultView?.addEventListener('resize', measure);
        this.document.addEventListener('scroll', measure, true);
        cleanup(() => {
          observer.disconnect();
          resize?.disconnect();
          this.document.defaultView?.clearTimeout(timeout);
          this.document.defaultView?.removeEventListener('resize', measure);
          this.document.removeEventListener('scroll', measure, true);
        });
      });
    });
  }
}
