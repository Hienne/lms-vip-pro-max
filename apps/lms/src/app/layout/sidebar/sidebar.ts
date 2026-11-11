import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, Mai, Tooltip } from '@lms/ui';
import { APP_CONFIG } from '../../core/config/app-config';
import {
  activeHref,
  type MenuItem,
  type NavSection,
} from '../../core/menu/menu-catalog';

const ENTERTAINMENT_LINK: MenuItem = {
  code: 'COMMUNITY',
  href: '/chat-room',
  icon: 'message-square',
  label: 'Giờ ra chơi',
  section: 'Cộng đồng',
  upcoming: false,
};

/**
 * The user's navigation (the mockup's `sidebar`): brand, role line, the sections of the nav
 * `toProfile` built from the functions the backend lists for the user, and, with `devTools`, the
 * design-system link. An entry whose screen is not built yet says "Sắp ra mắt" after its label.
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
  /** The design system is an internal page: production users never see its link. */
  protected readonly showDesignLink = inject(APP_CONFIG).devTools;

  readonly nav = input.required<readonly NavSection[]>();
  /** The role line, e.g. "Giảng viên, Học viên". */
  readonly roleText = input.required<string>();
  readonly activePath = input('');
  /** Shows the collapse button (the desktop sidebar; the drawer always shows the full menu). */
  readonly collapsible = input(false);
  readonly collapsed = input(false);

  /** The collapse button was pressed. */
  readonly collapseToggle = output();

  /**
   * The profile is left out: it opens from the account menu in the header. Entries whose screen is
   * not built are shown in development builds only.
   */
  protected readonly sections = computed<readonly NavSection[]>(() => {
    const sections = this.nav()
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.code !== 'PROFILE' && (this.showDesignLink || !item.upcoming),
        ),
      }))
      .filter((section) => section.items.length > 0);

    // This signed-in route is available independently of the Community grant.
    const community = sections.find(
      ({ section }) => section === ENTERTAINMENT_LINK.section,
    );
    if (community) {
      community.items.push(ENTERTAINMENT_LINK);
    } else {
      sections.push({
        section: ENTERTAINMENT_LINK.section,
        items: [ENTERTAINMENT_LINK],
      });
    }
    return sections;
  });
  protected readonly active = computed(() =>
    activeHref(this.sections(), this.activePath()),
  );
  protected readonly toggleLabel = computed(() =>
    this.collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên',
  );

  /** The rail has no visible label, so its tooltip carries the state too. */
  protected itemTooltip(item: MenuItem): string {
    return item.upcoming ? `${item.label} · Sắp ra mắt` : item.label;
  }
}
