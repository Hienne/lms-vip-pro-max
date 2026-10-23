import {
  Overlay,
  type ConnectedPosition,
  type OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  InjectionToken,
  inject,
  input,
  type Signal,
  signal,
  TemplateRef,
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

/** Plain text, or a template for a tooltip with structure (a title over a quote, say). */
export type TooltipContent = string | TemplateRef<unknown>;

/** What the directive hands its bubble: the live content and the id the trigger points at. */
interface TooltipSource {
  readonly text: Signal<string>;
  readonly template: Signal<TemplateRef<unknown> | null>;
  readonly id: string;
}
const TOOLTIP_SOURCE = new InjectionToken<TooltipSource>('TOOLTIP_SOURCE');

/** The bubble itself; rendered by `uiTooltip` inside a CDK overlay, never used directly. */
@Component({
  selector: 'ui-tooltip',
  imports: [NgTemplateOutlet],
  host: {
    class: 'ui-tooltip',
    role: 'tooltip',
    '[id]': 'source.id',
    '[class.ui-tooltip--rich]': '!!source.template()',
    '[hidden]': '!source.text() && !source.template()',
  },
  template: `@if (source.template(); as template) {
      <ng-container [ngTemplateOutlet]="template" />
    } @else {
      {{ source.text() }}
    }`,
})
export class TooltipBubble {
  protected readonly source = inject(TOOLTIP_SOURCE);
}

/**
 * Shows its content in a small bubble next to the host on hover and keyboard focus, after a short
 * delay. It hides on leave, blur and Escape, and the host gets `aria-describedby` to the bubble
 * (`role="tooltip"`) only while it is visible. An empty text shows nothing.
 *
 * The content is a string, or a template for a richer bubble (wider, on the surface colour); a
 * template must hold text only, since the bubble takes no pointer or focus. `uiTooltipToggle` also
 * shows and hides it on a click or tap of the host, for a trigger whose only job is the tooltip:
 * touch screens have no hover.
 *
 * `<button uiIconButton ... />` already uses it for its label; elsewhere:
 * `<button uiTooltip="Xóa khóa học">...</button>`,
 * `<button uiBadge [uiTooltip]="details" uiTooltipToggle>1</button>`
 */
@Directive({
  selector: '[uiTooltip]',
  host: {
    '(mouseenter)': 'schedule()',
    '(mouseleave)': 'hide()',
    '(focus)': 'schedule()',
    '(blur)': 'hide()',
    '(click)': 'toggle()',
    '(keydown.escape)': 'hide()',
    '[attr.aria-describedby]': 'visible() && hasContent() ? id : null',
  },
})
export class Tooltip {
  readonly content = input<TooltipContent>('', { alias: 'uiTooltip' });
  /**
   * A click or tap on the host shows the bubble at once and keeps it; the next one hides it. A
   * bubble that hover already opened is kept by the click, not closed under the pointer.
   */
  readonly uiTooltipToggle = input(false, { transform: booleanAttribute });

  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly id = `ui-tooltip-${nextId++}`;
  protected readonly visible = signal(false);

  private readonly text = computed(() => {
    const content = this.content();
    return typeof content === 'string' ? content : '';
  });
  private readonly template = computed(() => {
    const content = this.content();
    return content instanceof TemplateRef ? content : null;
  });
  protected readonly hasContent = computed(
    () => !!this.text() || !!this.template(),
  );

  private timer: ReturnType<typeof setTimeout> | undefined;
  private overlayRef: OverlayRef | undefined;
  /** Opened or kept by a click, so the next click closes it. */
  private pinned = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.hide();
      this.overlayRef?.dispose();
    });
  }

  protected schedule(): void {
    clearTimeout(this.timer);
    if (this.visible() || !this.hasContent()) return;
    this.timer = setTimeout(() => this.show(), SHOW_DELAY_MS);
  }

  protected hide(): void {
    clearTimeout(this.timer);
    this.overlayRef?.detach();
    this.visible.set(false);
    this.pinned = false;
  }

  protected toggle(): void {
    if (!this.uiTooltipToggle()) return;
    if (this.pinned) {
      this.hide();
      return;
    }
    if (!this.visible()) this.show();
    this.pinned = true;
  }

  private show(): void {
    clearTimeout(this.timer);
    if (!this.hasContent()) return;
    const ref = (this.overlayRef ??= this.createOverlay());
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: TOOLTIP_SOURCE,
          useValue: {
            text: this.text,
            template: this.template,
            id: this.id,
          } satisfies TooltipSource,
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
