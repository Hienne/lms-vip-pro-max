import type { MenuItem } from '../../core/menu/menu-catalog';
import type { Profile } from '../../core/session/profile';
import { SCREEN_TABLE, type Screen } from '../../core/routing/screens';
import type { AnyEndpoint } from '@lms/contracts';

type NavLink = Pick<MenuItem, 'href' | 'label' | 'icon' | 'upcoming'>;
const GROUPS = [
  { id: 'learn', label: 'Học tập' },
  { id: 'tools', label: 'Công cụ học' },
  { id: 'community', label: 'Cộng đồng' },
] as const;

export type LearnerNavGroup = (typeof GROUPS)[number] & {
  readonly links: readonly NavLink[];
};

/** Accounts with additional roles keep access to their full staff navigation. */
export function learnerNavigation(
  user: Profile | null,
  isServed: (endpoint: AnyEndpoint) => boolean,
): readonly LearnerNavGroup[] | null {
  if (
    !user?.grants.length ||
    user.grants.some((grant) => grant.roleCode !== 'LEARNER')
  ) {
    return null;
  }

  const linksIn = (label: string): readonly NavLink[] =>
    user.nav.find(({ section }) => section === label)?.items ?? [];
  const route = (
    path: (typeof SCREEN_TABLE.open)[number]['path'],
    icon: NavLink['icon'],
    label?: string,
  ): NavLink[] => {
    const screen: Screen | undefined = SCREEN_TABLE.open.find(
      (entry) => entry.path === path,
    );
    return screen &&
      (!screen.access || user.menus.includes(screen.access)) &&
      (screen.requires ?? []).every(isServed)
      ? [
          {
            href: `/${path}`,
            label: label ?? screen.title,
            icon,
            upcoming: false,
          },
        ]
      : [];
  };

  return GROUPS.map((group) => {
    const links = linksIn(group.label);
    switch (group.id) {
      case 'learn':
        return {
          ...group,
          links: links.flatMap((link) =>
            link.href === '/learn'
              ? [
                  { ...link, label: 'Khóa học của tôi' },
                  ...route('catalog', 'library'),
                ]
              : [link],
          ),
        };
      case 'tools':
        return {
          ...group,
          links: [
            ...route('saved', 'bookmark', 'Ghi chú & đánh dấu'),
            ...route('flashcards', 'layers'),
            ...route('certificates', 'award'),
            ...route('leaderboard', 'trophy'),
            ...links.filter((link) => link.href !== '/leaderboard'),
          ],
        };
      case 'community':
        return {
          ...group,
          links: [...links, ...route('chat-room', 'message-square')],
        };
    }
  }).filter((group) => group.links.length > 0);
}
