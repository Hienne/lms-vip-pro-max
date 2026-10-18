import type { AnyEndpoint, FunctionCode, FunctionInfo } from '@lms/contracts';
import { FunctionCodeSchema } from '@lms/contracts';
import type { IconName } from '@lms/ui';
import { FUNCTION_CODES, menuGroup } from '../routing/screens';

export interface MenuItem {
  readonly code: FunctionCode;
  readonly href: string;
  readonly icon: IconName;
  /** The backend's name for the function. */
  readonly label: string;
  readonly section: string;
}

export interface NavSection {
  readonly section: string;
  readonly items: readonly MenuItem[];
}

/** The screen a function's sidebar entry links to: the first screen of its group. */
export function entryHref(code: FunctionCode): string {
  return `/${menuGroup(code).screens[0].path}`;
}

function isKnown(code: string): code is FunctionCode {
  return FunctionCodeSchema.safeParse(code).success;
}

/** Whether this build answers an endpoint: `EndpointClient.isServed`. */
export type IsServed = (endpoint: AnyEndpoint) => boolean;

const allServed: IsServed = () => true;

/**
 * The functions of `/me` this app has a screen for and can serve in this build (a group whose
 * `requires` endpoints are not served is left out), in the backend's order (`sortNo`, then `id`).
 */
export function knownFunctions(
  functions: readonly FunctionInfo[],
  isServed: IsServed = allServed,
): readonly FunctionInfo[] {
  return functions
    .filter(
      (fn) =>
        isKnown(fn.code) && (menuGroup(fn.code).requires ?? []).every(isServed),
    )
    .sort((a, b) => a.sortNo - b.sortNo || a.id - b.id);
}

/**
 * The sidebar of a user: one entry per function `/me` lists, labelled with the backend's name and
 * linked to its first screen, grouped by section in the order the backend sorts them. A code the
 * app has no screen for is skipped.
 */
export function navFor(
  functions: readonly FunctionInfo[],
): readonly NavSection[] {
  const sections: { section: string; items: MenuItem[] }[] = [];
  for (const fn of knownFunctions(functions)) {
    const code = fn.code as FunctionCode;
    const { nav } = menuGroup(code);
    const item: MenuItem = {
      code,
      href: entryHref(code),
      icon: nav.icon,
      label: fn.name,
      section: nav.section,
    };
    const existing = sections.find((s) => s.section === nav.section);
    if (existing) existing.items.push(item);
    else sections.push({ section: nav.section, items: [item] });
  }
  return sections;
}

/**
 * Where `/` and the login page send a user: the entry screen of the first function (after the
 * profile, which every account has) the app has a screen for; the profile when there is none.
 */
export function homePathFor(functions: readonly FunctionInfo[]): string {
  const first = knownFunctions(functions).find((fn) => fn.code !== 'PROFILE');
  return first ? entryHref(first.code as FunctionCode) : '/profile';
}

/** The sidebar label of a function code, for the 403 page: the table's first screen title. */
export function menuLabel(code: FunctionCode): string {
  return menuGroup(code).screens[0].title;
}

/**
 * Every function code grouped by section in table order, labelled with its entry screen's title,
 * for choosing the screens of a role in the (mock) role form.
 */
export function allSections(): readonly NavSection[] {
  const sections: { section: string; items: MenuItem[] }[] = [];
  for (const code of FUNCTION_CODES) {
    const { nav } = menuGroup(code);
    const item: MenuItem = {
      code,
      href: entryHref(code),
      icon: nav.icon,
      label: menuLabel(code),
      section: nav.section,
    };
    const existing = sections.find((s) => s.section === nav.section);
    if (existing) existing.items.push(item);
    else sections.push({ section: nav.section, items: [item] });
  }
  return sections;
}

/**
 * The nav item the path belongs to: the longest href that equals the path or is a parent of it,
 * so `/admin/courses/new` marks "Quản lý khóa học" and not a shorter entry. `routerLinkActive`
 * cannot do this, which is why the sidebar computes it.
 */
export function activeHref(
  functions: readonly FunctionInfo[],
  path: string,
): string | null {
  const matches = navFor(functions)
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => path === href || path.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
