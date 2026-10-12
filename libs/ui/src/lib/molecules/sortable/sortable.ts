import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button.directive';

/** A move request: the item at `from` goes to `to` (both zero-based positions). */
export interface SortableMove {
  readonly from: number;
  readonly to: number;
}

export type SortableDirection = 'up' | 'down';

/** What the live announcement is built from. */
export interface SortableAnnouncement {
  readonly label: string;
  readonly direction: SortableDirection;
  /** One-based new position. */
  readonly position: number;
}

const announceInVietnamese = ({
  label,
  direction,
  position,
}: SortableAnnouncement): string =>
  `Đã chuyển ${label} ${direction === 'up' ? 'lên' : 'xuống'} vị trí ${position}`;

/**
 * A reorderable list (the mockup's `.sort-item` rows), built on the CDK drag-drop: drag an item by
 * its handle, or press its move up and down buttons. It never changes the list it renders: it
 * emits `moved` with `{ from, to }` and the caller applies it and re-renders. Every move is
 * announced through the `LiveAnnouncer`, and after a button move focus stays on the moved item's
 * button. Put `uiSortableList` on a container and a
 * `ui-sortable-item` for each row.
 */
@Directive({
  selector: '[uiSortableList]',
  hostDirectives: [CdkDropList],
  host: {
    class: 'sortable',
    role: 'list',
    '[attr.aria-label]': 'label()',
  },
})
export class SortableList {
  /** Accessible name of the list, e.g. "Bài học của chương". */
  readonly label = input.required<string>();
  readonly moveUpLabel = input('Chuyển lên');
  readonly moveDownLabel = input('Chuyển xuống');
  /** Builds the live announcement of a move. */
  readonly announcement =
    input<(move: SortableAnnouncement) => string>(announceInVietnamese);
  readonly moved = output<SortableMove>();

  readonly items = contentChildren(
    forwardRef(() => SortableItem),
    { descendants: true },
  );

  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);

  constructor() {
    inject(CdkDropList)
      .dropped.pipe(takeUntilDestroyed())
      .subscribe(({ previousIndex, currentIndex }) => {
        const item = this.items()[previousIndex];
        if (item) this.move(item, currentIndex);
      });
  }

  /** Moves `item` to `to`; `focusAfter` says which button keeps focus when a button was used. */
  move(item: SortableItem, to: number, focusAfter?: SortableDirection): void {
    const from = this.items().indexOf(item);
    if (from < 0 || to < 0 || to >= this.items().length || to === from) return;
    const direction: SortableDirection = to < from ? 'up' : 'down';
    this.moved.emit({ from, to });
    this.announcer.announce(
      this.announcement()({
        label: item.label(),
        direction,
        position: to + 1,
      }),
    );
    if (focusAfter) {
      afterNextRender(
        () => {
          if (this.items().indexOf(item) === to) item.focusMove(focusAfter);
        },
        { injector: this.injector },
      );
    }
  }
}

/** One row (`ui-sortable-item`) of a `uiSortableList`: drag handle, projected content and the two move buttons. */
@Component({
  selector: 'ui-sortable-item',
  imports: [CdkDragHandle, Icon, IconButton],
  hostDirectives: [CdkDrag],
  host: {
    class: 'sort-item',
    role: 'listitem',
    '[class.is-dragging]': 'dragging()',
  },
  template: `
    <span class="drag-handle" cdkDragHandle aria-hidden="true">
      <ui-icon name="grip-vertical" size="sm" />
    </span>
    <div class="sort-item__body"><ng-content /></div>
    <button
      #up
      uiIconButton
      size="sm"
      [label]="list.moveUpLabel()"
      [disabled]="index() <= 0"
      (click)="list.move(this, index() - 1, 'up')"
    >
      <ui-icon name="chevron-up" size="sm" />
    </button>
    <button
      #down
      uiIconButton
      size="sm"
      [label]="list.moveDownLabel()"
      [disabled]="index() >= list.items().length - 1"
      (click)="list.move(this, index() + 1, 'down')"
    >
      <ui-icon name="chevron-down" size="sm" />
    </button>
  `,
})
export class SortableItem {
  /** Name of the item, used in the live announcement. */
  readonly label = input.required<string>();

  protected readonly list = inject(SortableList);
  protected readonly dragging = signal(false);
  protected readonly index = computed(() => this.list.items().indexOf(this));

  private readonly buttons =
    viewChildren<ElementRef<HTMLButtonElement>>('up, down');

  constructor() {
    const drag = inject(CdkDrag);
    const destroyed = inject(DestroyRef);
    const started = drag.started.subscribe(() => this.dragging.set(true));
    const ended = drag.ended.subscribe(() => this.dragging.set(false));
    destroyed.onDestroy(() => {
      started.unsubscribe();
      ended.unsubscribe();
    });
  }

  /** Focuses the button that was used, or the other one when it is now disabled. */
  focusMove(preferred: SortableDirection): void {
    const [up, down] = this.buttons().map((button) => button.nativeElement);
    const [first, second] = preferred === 'up' ? [up, down] : [down, up];
    (first.disabled ? second : first).focus();
  }
}
