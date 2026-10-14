import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Role } from '@lms/contracts';
import { Icon, Mai } from '@lms/ui';
import { roleLabel } from '../../shared/status/role-badge';
import { activeHref, NAV } from '../nav/nav';

/**
 * The role's navigation (the mockup's `sidebar`): brand, role line, the sections of `NAV`, and the
 * design-system link. It owns no state: the shell passes the role and the current path in, and the
 * current page is marked with `aria-current="page"` by longest-prefix match.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, Icon, Mai],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly role = input.required<Role>();
  /** Admin limited to one unit: the role line reads "… đơn vị". */
  readonly scoped = input(false);
  readonly activePath = input('');
  readonly inboxCount = input(0);

  protected readonly sections = computed(() => NAV[this.role()]);
  protected readonly active = computed(() =>
    activeHref(this.role(), this.activePath()),
  );
  protected readonly roleText = computed(
    () => roleLabel(this.role()) + (this.scoped() ? ' đơn vị' : ''),
  );
}
