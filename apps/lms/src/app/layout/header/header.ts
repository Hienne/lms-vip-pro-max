import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { map } from 'rxjs';
import { Icon, IconButton, Input, Menu, type MenuEntry } from '@lms/ui';
import type { Profile } from '../../core/session/profile';
import { NotificationBell } from './notification-bell/notification-bell';
import { searchPlaceholder } from './search-target';
import { ThemePicker } from './theme-picker/theme-picker';

export type UserMenuValue = 'profile' | 'notifications' | 'sign-out';

/**
 * The page header (the mockup's `.header`): the navigation button below the `lg` breakpoint, the
 * global search, the theme picker, the notification bell (a dropdown, see `NotificationBell`) and the user menu. It renders what the
 * shell passes in and reports intent through outputs; the theme picker talks to `ThemeStore` itself.
 */
@Component({
  selector: 'app-header',
  imports: [Icon, IconButton, Input, Menu, NotificationBell, ThemePicker],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  readonly navOpen = input(false);
  readonly user = input<Profile | null>(null);
  readonly unread = input(0);
  /** The learner's level name for the user menu, with no XP; null for anyone without one. */
  readonly levelName = input<string | null>(null);
  readonly menu = output<void>();
  readonly searched = output<string>();
  readonly picked = output<UserMenuValue>();

  /** On a phone the user menu is just its icon, so the search keeps room to be used. */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 639px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly field = viewChild<ElementRef<HTMLInputElement>>('q');

  /** Below `md` the search field is hidden until its icon button opens it as a full-width row. */
  protected readonly searchOpen = signal(false);

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
      ...(this.levelName()
        ? [{ kind: 'label' as const, label: `Cấp độ: ${this.levelName()}` }]
        : []),
      { kind: 'item', value: 'profile', label: 'Hồ sơ cá nhân', icon: 'user' },
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
    this.searchOpen.set(false);
  }

  protected toggleSearch(): void {
    const open = !this.searchOpen();
    this.searchOpen.set(open);
    if (open) queueMicrotask(() => this.field()?.nativeElement.focus());
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
  }
}
