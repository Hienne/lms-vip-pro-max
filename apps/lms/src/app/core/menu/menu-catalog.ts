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

/** A function of `/me` this app has a screen for: its code is narrowed to `FunctionCode`. */
export type KnownFunction = FunctionInfo & { readonly code: FunctionCode };

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
): readonly KnownFunction[] {
  return functions
    .filter(
      (fn): fn is KnownFunction =>
        isKnown(fn.code) && (menuGroup(fn.code).requires ?? []).every(isServed),
    )
    .sort((a, b) => a.sortNo - b.sortNo || a.id - b.id);
}

/** Items grouped by section, sections and items in the order given. */
function groupBySection(items: readonly MenuItem[]): readonly NavSection[] {
  const sections: { section: string; items: MenuItem[] }[] = [];
  for (const item of items) {
    const existing = sections.find((s) => s.section === item.section);
    if (existing) existing.items.push(item);
    else sections.push({ section: item.section, items: [item] });
  }
  return sections;
}

/**
 * The sidebar of a user: one entry per function, labelled with the backend's name and linked to
 * its first screen, grouped by section in the order the backend sorts them. `toProfile` builds it
 * once; the sidebar only renders it.
 */
export function navFor(
  functions: readonly KnownFunction[],
): readonly NavSection[] {
  return groupBySection(
    functions.map((fn) => {
      const { nav } = menuGroup(fn.code);
      return {
        code: fn.code,
        href: entryHref(fn.code),
        icon: nav.icon,
        label: fn.name,
        section: nav.section,
      };
    }),
  );
}

/**
 * Where `/` and the login page send a user: the entry screen of the first function (after the
 * profile, which every account has) the app has a screen for; the profile when there is none.
 */
export function homePathFor(functions: readonly KnownFunction[]): string {
  const first = functions.find((fn) => fn.code !== 'PROFILE');
  return first ? entryHref(first.code) : '/profile';
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
  return groupBySection(
    FUNCTION_CODES.map((code) => ({
      code,
      href: entryHref(code),
      icon: menuGroup(code).nav.icon,
      label: menuLabel(code),
      section: menuGroup(code).nav.section,
    })),
  );
}

/**
 * The nav item the path belongs to: the longest href that equals the path or is a parent of it,
 * so `/admin/courses/new` marks "Quản lý khóa học" and not a shorter entry. `routerLinkActive`
 * cannot do this, which is why the sidebar computes it.
 */
export function activeHref(
  nav: readonly NavSection[],
  path: string,
): string | null {
  const matches = nav
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => path === href || path.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
