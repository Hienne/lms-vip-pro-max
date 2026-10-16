import type { MenuKey } from '@lms/contracts';
import type { IconName } from '@lms/ui';
import { MENU_KEYS, menuGroup } from '../routing/screens';

export interface MenuItem {
  readonly key: MenuKey;
  readonly href: string;
  readonly icon: IconName;
  readonly label: string;
  readonly section: string;
  /** Count shown beside the label; the shell fills it from the server's nav counts. */
  readonly badge?: 'inbox';
}

/** Every menu a role can grant, in sidebar order, read off the screen table. */
const MENU_ITEMS: readonly MenuItem[] = MENU_KEYS.map((key) => {
  const { nav, screens } = menuGroup(key);
  const [entry] = screens;
  return {
    key,
    href: `/${entry.path}`,
    icon: nav.icon,
    label: nav.label ?? entry.title,
    section: nav.section,
    ...(nav.badge ? { badge: nav.badge } : {}),
  };
});

export interface NavSection {
  readonly section: string;
  readonly items: readonly MenuItem[];
}

/** The sidebar of a user: the menu entries their role grants, grouped by section in order. */
export function navFor(menus: readonly MenuKey[]): readonly NavSection[] {
  const sections: { section: string; items: MenuItem[] }[] = [];
  for (const item of MENU_ITEMS) {
    if (!menus.includes(item.key)) continue;
    const last = sections[sections.length - 1];
    if (last?.section === item.section) last.items.push(item);
    else sections.push({ section: item.section, items: [item] });
  }
  return sections;
}

/** The menu entries grouped by section, for choosing menus in the role form. */
export function allSections(): readonly NavSection[] {
  return navFor(MENU_ITEMS.map((item) => item.key));
}

export function menuLabel(key: MenuKey): string {
  return MENU_ITEMS.find((item) => item.key === key)?.label ?? key;
}

/**
 * The nav item the path belongs to: the longest href that equals the path or is a parent of it,
 * so `/admin/courses/new` marks "Khóa học" and not "Tổng quan" (`/admin`). `routerLinkActive`
 * cannot do this, which is why the sidebar computes it.
 */
export function activeHref(
  menus: readonly MenuKey[],
  path: string,
): string | null {
  const matches = navFor(menus)
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => path === href || path.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
