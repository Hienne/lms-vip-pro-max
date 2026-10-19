import { FocusTrapFactory, type FocusTrap } from '@angular/cdk/a11y';
import {
  Overlay,
  type ConnectedPosition,
  type OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  ApplicationRef,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  inject,
  input,
  signal,
  type TemplateRef,
} from '@angular/core';

/** Gap between the trigger and the panel (`--spacing-2`). */
const GAP = 8;
/** Minimum distance from the viewport edge: the phone page gutter (`--spacing-4`). */
const VIEWPORT_MARGIN = 16;

/** Below the trigger with the end edges aligned, then the other corners, so it stays on screen. */
const POSITIONS: ConnectedPosition[] = [
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top',
    offsetY: GAP,
  },
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: GAP,
  },
  {
    originX: 'end',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'bottom',
    offsetY: -GAP,
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -GAP,
  },
];

let nextId = 0;

/** What the trigger hands its panel. */
interface PopoverSource {
  readonly template: TemplateRef<unknown>;
  readonly label: string;
  readonly id: string;
}
const POPOVER_SOURCE = new InjectionToken<PopoverSource>('POPOVER_SOURCE');

/** The panel itself; rendered by `uiPopover` inside a CDK overlay, never used directly. */
@Component({
  selector: 'ui-popover-panel',
  imports: [NgTemplateOutlet],
  host: {
    class: 'popover',
    role: 'dialog',
    tabindex: '-1',
    '[id]': 'source.id',
    '[attr.aria-label]': 'source.label',
  },
  template: `<ng-container [ngTemplateOutlet]="source.template" />`,
})
export class PopoverPanel {
  protected readonly source = inject(POPOVER_SOURCE);
}

/**
 * Opens the template it is given in a non-modal panel (`role="dialog"`) anchored below the host
 * button. A click on the host toggles it; Escape closes it and gives focus back to the host; a click
 * outside closes it. While open, focus starts on the first control inside and Tab cycles within the
 * panel. `popoverLabel` names the dialog. `@angular/aria` has no popover pattern, so the CDK overlay
 * and focus trap carry the behaviour.
 *
 * ```html
 * <button uiIconButton label="Tùy chỉnh giao diện" popoverLabel="Tùy chỉnh giao diện" [uiPopover]="panel">…</button>
 * <ng-template #panel>…</ng-template>
 * ```
 */
@Directive({
  selector: 'button[uiPopover]',
  exportAs: 'uiPopover',
  host: {
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'open()',
    '[attr.aria-controls]': 'open() ? id : null',
    '(click)': 'toggle()',
  },
})
export class Popover {
  readonly template = input.required<TemplateRef<unknown>>({
    alias: 'uiPopover',
  });
  /** Accessible name of the panel, e.g. "Tùy chỉnh giao diện". */
  readonly popoverLabel = input.required<string>();

  private readonly overlay = inject(Overlay);
  private readonly focusTraps = inject(FocusTrapFactory);
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  private readonly host = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  protected readonly id = `ui-popover-${nextId++}`;
  /** Whether the panel is showing. */
  readonly open = signal(false);

  private overlayRef: OverlayRef | undefined;
  private focusTrap: FocusTrap | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.detach();
      this.overlayRef?.dispose();
    });
  }

  toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  /** Closes the panel; focus goes back to the trigger when it was inside the panel. */
  close(): void {
    if (!this.open()) return;
    const panel = this.overlayRef?.overlayElement;
    const focusWasInside = !!panel?.contains(document.activeElement);
    this.detach();
    if (focusWasInside) this.host.nativeElement.focus();
  }

  private show(): void {
    const ref = (this.overlayRef ??= this.createOverlay());
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: POPOVER_SOURCE,
          useValue: {
            template: this.template(),
            label: this.popoverLabel(),
            id: this.id,
          } satisfies PopoverSource,
        },
      ],
    });
    ref
      .attach(new ComponentPortal(PopoverPanel, null, injector))
      .changeDetectorRef.detectChanges();
    const trap = (this.focusTrap = this.focusTraps.create(ref.overlayElement));
    this.open.set(true);
    // Once rendering settles (a listbox inside sets its roving tabindex in a second pass): the
    // first control inside, or the panel itself when it has none (like CDK Dialog).
    void this.appRef.whenStable().then(() => {
      if (this.focusTrap !== trap) return;
      if (!trap.focusFirstTabbableElement())
        ref.overlayElement.querySelector<HTMLElement>('.popover')?.focus();
    });
  }

  private detach(): void {
    this.focusTrap?.destroy();
    this.focusTrap = undefined;
    this.overlayRef?.detach();
    this.open.set(false);
  }

  private createOverlay(): OverlayRef {
    const ref = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.host)
        .withPositions(POSITIONS)
        .withPush(true)
        .withViewportMargin(VIEWPORT_MARGIN),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    ref.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    ref.outsidePointerEvents().subscribe((event) => {
      // The trigger's own click toggles; everything else outside closes.
      const target = event.target as Node | null;
      if (!target || !this.host.nativeElement.contains(target)) this.close();
    });
    return ref;
  }
}
