import { NgTemplateOutlet } from '@angular/common';
import { Tree as AriaTree, TreeItem, TreeItemGroup } from '@angular/aria/tree';
import {
  booleanAttribute,
  Component,
  computed,
  input,
  model,
  TemplateRef,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export interface TreeNode<T = unknown> {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  /** Caller data, handed back to the `trailing` template. */
  readonly data?: T;
  readonly children?: readonly TreeNode<T>[];
}

/** Context of the `trailing` template: the node it is rendered for. */
export interface TreeTrailingContext<T = unknown> {
  readonly $implicit: TreeNode<T>;
}

/**
 * Hierarchy browser (the mockup's `.tree`), built on the `@angular/aria` tree: Up, Down, Left,
 * Right, Home and End follow the WAI-ARIA tree pattern, items expose `aria-level`,
 * `aria-expanded` and `aria-selected`. The tree keeps no state of its own: `expanded` (ids of the
 * open nodes) and `selected` (one id) are two-way models the route store owns. `trailing` is a
 * template shown at the end of every node row, e.g. a publish status badge.
 */
@Component({
  selector: 'ui-tree',
  imports: [AriaTree, TreeItem, TreeItemGroup, NgTemplateOutlet, Icon],
  templateUrl: './tree.html',
})
export class Tree<T = unknown> {
  readonly nodes = input.required<readonly TreeNode<T>[]>();
  /** Accessible name of the tree, e.g. "Cây nội dung". */
  readonly label = input.required<string>();
  /** Lets long names wrap in a narrow navigation pane instead of truncating them. */
  readonly wrapLabels = input(false, { transform: booleanAttribute });
  readonly trailing = input<TemplateRef<TreeTrailingContext<T>>>();
  /** Ids of the expanded nodes. */
  readonly expanded = model<readonly string[]>([]);
  /** Id of the selected node. */
  readonly selected = model<string>();

  protected readonly openIds = computed(() => new Set(this.expanded()));
  protected readonly selection = computed(() => {
    const id = this.selected();
    return id === undefined ? [] : [id];
  });

  protected select(ids: readonly string[]): void {
    const [id] = ids;
    if (id !== undefined && id !== this.selected()) this.selected.set(id);
  }

  protected toggle(id: string, open: boolean): void {
    const ids = this.expanded();
    if (open === ids.includes(id)) return;
    this.expanded.set(
      open ? [...ids, id] : ids.filter((other) => other !== id),
    );
  }
}
