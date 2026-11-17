import {
  Overlay,
  type ConnectedPosition,
  type OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  InjectionToken,
  inject,
  input,
  type Signal,
  signal,
} from '@angular/core';

/** Pause before the bubble appears, so a pointer passing over a control does not flash it. */
const SHOW_DELAY_MS = 300;
/** Gap between the trigger and the bubble, and minimum distance from the viewport edge. */
const GAP = 8;
const VIEWPORT_MARGIN = 8;

/** Above the trigger first, then below, then beside it, so the bubble always stays on screen. */
const POSITIONS: ConnectedPosition[] = [
  {
    originX: 'center',
    originY: 'top',
    overlayX: 'center',
    overlayY: 'bottom',
    offsetY: -GAP,
  },
  {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: GAP,
  },
  {
    originX: 'end',
    originY: 'center',
    overlayX: 'start',
    overlayY: 'center',
    offsetX: GAP,
  },
  {
    originX: 'start',
    originY: 'center',
    overlayX: 'end',
    overlayY: 'center',
    offsetX: -GAP,
  },
];

let nextId = 0;

/** What the directive hands its bubble: the live text and the id the trigger points at. */
interface TooltipSource {
  readonly text: Signal<string>;
  readonly id: string;
}
const TOOLTIP_SOURCE = new InjectionToken<TooltipSource>('TOOLTIP_SOURCE');

/** The bubble itself; rendered by `uiTooltip` inside a CDK overlay, never used directly. */
@Component({
  selector: 'ui-tooltip',
  host: {
    class: 'ui-tooltip',
    role: 'tooltip',
    '[id]': 'source.id',
    '[hidden]': '!source.text()',
  },
  template: `{{ source.text() }}`,
})
export class TooltipBubble {
  protected readonly source = inject(TOOLTIP_SOURCE);
}

/**
 * Shows `text` in a small bubble next to the host on hover and keyboard focus, after a short
 * delay. It hides on leave, blur and Escape, and the host gets `aria-describedby` to the bubble
 * (`role="tooltip"`) only while it is visible. An empty text shows nothing.
 *
 * `<button uiIconButton ... />` already uses it for its label; elsewhere:
 * `<button uiTooltip="Xóa khóa học">...</button>`
 */
@Directive({
  selector: '[uiTooltip]',
  host: {
    '(mouseenter)': 'schedule()',
    '(mouseleave)': 'hide()',
    '(focus)': 'schedule()',
    '(blur)': 'hide()',
    '(keydown.escape)': 'hide()',
    '[attr.aria-describedby]': 'visible() && text() ? id : null',
  },
})
export class Tooltip {
  readonly text = input('', { alias: 'uiTooltip' });
  readonly tooltipDisabled = input(false);

  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly id = `ui-tooltip-${nextId++}`;
  protected readonly visible = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private overlayRef: OverlayRef | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.hide();
      this.overlayRef?.dispose();
    });
  }

  protected schedule(): void {
    clearTimeout(this.timer);
    if (this.tooltipDisabled() || this.visible() || !this.text()) return;
    this.timer = setTimeout(() => this.show(), SHOW_DELAY_MS);
  }

  protected hide(): void {
    clearTimeout(this.timer);
    this.overlayRef?.detach();
    this.visible.set(false);
  }

  private show(): void {
    if (this.tooltipDisabled() || !this.text()) return;
    const ref = (this.overlayRef ??= this.createOverlay());
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: TOOLTIP_SOURCE,
          useValue: { text: this.text, id: this.id } satisfies TooltipSource,
        },
      ],
    });
    ref
      .attach(new ComponentPortal(TooltipBubble, null, injector))
      .changeDetectorRef.detectChanges();
    this.visible.set(true);
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
      if (event.key === 'Escape') this.hide();
    });
    return ref;
  }
}
