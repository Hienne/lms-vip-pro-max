import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, Mai, Tooltip } from '@lms/ui';
import { activeHref, type NavSection } from '../../core/menu/menu-catalog';

/**
 * The user's navigation (the mockup's `sidebar`): brand, role line, the sections of the nav
 * `toProfile` built from the functions the backend lists for the user, and the design-system link.
 * It owns no state: the shell passes the nav and the path in, and the
 * current page is marked with `aria-current="page"` by longest-prefix match.
 *
 * A `collapsible` sidebar has a footer button that asks the shell to collapse it to an icon rail;
 * while `collapsed`, labels stay in the DOM for screen readers and show as tooltips.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, Icon, Mai, Tooltip],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly nav = input.required<readonly NavSection[]>();
  /** The role line, e.g. "Giảng viên, Học viên". */
  readonly roleText = input.required<string>();
  readonly activePath = input('');
  /** Shows the collapse button (the desktop sidebar; the drawer always shows the full menu). */
  readonly collapsible = input(false);
  readonly collapsed = input(false);

  /** The collapse button was pressed. */
  readonly collapseToggle = output();

  protected readonly active = computed(() =>
    activeHref(this.nav(), this.activePath()),
  );
  protected readonly toggleLabel = computed(() =>
    this.collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên',
  );
}
