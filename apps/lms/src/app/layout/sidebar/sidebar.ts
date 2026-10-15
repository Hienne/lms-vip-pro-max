import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MenuKey } from '@lms/contracts';
import { Icon, Mai } from '@lms/ui';
import { activeHref, navFor } from '../../core/menu/menu-catalog';

/**
 * The user's navigation (the mockup's `sidebar`): brand, role line, the menu sections the role
 * grants, and the design-system link. It owns no state: the shell passes the menus and the path in, and the
 * current page is marked with `aria-current="page"` by longest-prefix match.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, Icon, Mai],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly menus = input.required<readonly MenuKey[]>();
  /** The role line, e.g. "Quản trị viên đơn vị". */
  readonly roleText = input.required<string>();
  readonly activePath = input('');
  readonly inboxCount = input(0);

  protected readonly sections = computed(() => navFor(this.menus()));
  protected readonly active = computed(() =>
    activeHref(this.menus(), this.activePath()),
  );
}
