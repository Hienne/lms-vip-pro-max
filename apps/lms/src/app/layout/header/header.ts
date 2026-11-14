import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  Button,
  Icon,
  IconButton,
  Input,
  Mai,
  Menu,
  type MenuEntry,
} from '@lms/ui';
import type { Profile } from '../../core/session/profile';
import { NotificationBell } from './notification-bell/notification-bell';
import type { LearnerNavGroup } from './learner-navigation';
import { searchPlaceholder } from './search-target';
import { ThemePicker } from './theme-picker/theme-picker';

export type UserMenuValue = 'profile' | 'notifications' | 'sign-out' | 'guide';
type PanelId = LearnerNavGroup['id'] | 'account';

/**
 * The page header (the mockup's `.header`): the navigation button below the `lg` breakpoint, the
 * global search, the theme picker, the notification bell (a dropdown, see `NotificationBell`) and the user menu. It renders what the
 * shell passes in and reports intent through outputs; the theme picker talks to `ThemeStore` itself.
 */
@Component({
  selector: 'app-header',
  imports: [
    Button,
    Icon,
    IconButton,
    Input,
    Mai,
    Menu,
    NotificationBell,
    RouterLink,
    ThemePicker,
  ],
  host: {
    '(document:pointerdown)': 'dismissOutside($event)',
    '(document:keydown.escape)': 'dismissWithEscape($event)',
  },
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  readonly navOpen = input(false);
  readonly user = input<Profile | null>(null);
  readonly guideAvailable = input(false);
  readonly learnerNav = input<readonly LearnerNavGroup[] | null>(null);
  readonly activePath = input('');
  readonly unread = input(0);
  /** The learner's level name for the user menu, with no XP; null for anyone without one. */
  readonly levelName = input<string | null>(null);
  readonly menu = output<void>();
  readonly searched = output<string>();
  readonly picked = output<UserMenuValue>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly panel = linkedSignal<
    string,
    { id: PanelId; hover: boolean } | null
  >({
    source: this.activePath,
    computation: () => null,
  });

  protected readonly activeHref = computed(() => {
    const path = this.activePath();
    if (path.startsWith('/course/')) return '/learn';
    if (path.startsWith('/certificate/')) return '/certificates';
    return this.learnerNav()
      ?.flatMap(({ links }) => links)
      .find(({ href }) => path === href || path.startsWith(href + '/'))?.href;
  });

  protected readonly activeGroup = computed(() => {
    const href = this.activeHref();
    if (this.activePath().startsWith('/community/')) return 'community';
    return this.learnerNav()?.find(({ links }) =>
      links.some((link) => link.href === href),
    )?.id;
  });

  /** On a phone the user menu is just its icon, so the search keeps room to be used. */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 639px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly field = viewChild<ElementRef<HTMLInputElement>>('q');

  protected readonly placeholder = computed(() => {
    const user = this.user();
    return searchPlaceholder(user ? user.menus : []);
  });

  protected readonly entries = computed<MenuEntry<UserMenuValue>[]>(() => {
    const user = this.user();
    return [
      {
        kind: 'label',
        label: user ? `${user.fullName} · ${user.email ?? user.username}` : '',
      },
      ...(user?.roleText && this.learnerNav() !== null
        ? [{ kind: 'label' as const, label: `Vai trò: ${user.roleText}` }]
        : []),
      ...(this.levelName()
        ? [{ kind: 'label' as const, label: `Cấp độ: ${this.levelName()}` }]
        : []),
      { kind: 'item', value: 'profile', label: 'Hồ sơ cá nhân', icon: 'user' },
      ...(this.guideAvailable()
        ? [
            {
              kind: 'item',
              value: 'guide',
              label: 'Hướng dẫn sử dụng',
              icon: 'circle-help',
            } as const,
          ]
        : []),
      {
        kind: 'item',
        value: 'notifications',
        label: 'Thông báo',
        icon: 'bell',
      },
      { kind: 'separator' },
      {
        kind: 'item',
        value: 'sign-out',
        label: 'Đăng xuất',
        icon: 'log-out',
        tone: 'danger',
      },
    ];
  });

  protected submit(event: Event): void {
    event.preventDefault();
    this.searched.emit(this.field()?.nativeElement.value ?? '');
  }

  protected togglePanel(id: PanelId): void {
    const current = this.panel();
    this.panel.set(
      current?.id === id && !current.hover ? null : { id, hover: false },
    );
  }

  protected showAccount(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && this.panel()?.id !== 'account') {
      this.panel.set({ id: 'account', hover: true });
    }
  }

  protected hideAccount(): void {
    const current = this.panel();
    if (
      current?.id === 'account' &&
      current.hover &&
      !this.panelContains(document.activeElement)
    ) {
      this.panel.set(null);
    }
  }

  protected leavePanel(event: FocusEvent, id: PanelId): void {
    if (this.panel()?.id === id && !this.panelContains(event.relatedTarget)) {
      this.panel.set(null);
    }
  }

  protected dismissOutside(event: PointerEvent): void {
    if (this.panel() && !this.panelContains(event.target)) this.panel.set(null);
  }

  protected dismissWithEscape(event: Event): void {
    const current = this.panel();
    if (!current) return;
    if (this.panelContains(document.activeElement)) {
      event.preventDefault();
      this.host.nativeElement
        .querySelector<HTMLButtonElement>(
          `[data-header-panel="${current.id}"] button`,
        )
        ?.focus();
    }
    this.panel.set(null);
  }

  protected chooseAccount(value: UserMenuValue): void {
    this.panel.set(null);
    this.picked.emit(value);
  }

  private panelContains(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target
        .closest('[data-header-panel]')
        ?.getAttribute('data-header-panel') === this.panel()?.id
    );
  }
}
