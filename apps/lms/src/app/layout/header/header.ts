import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';
import type { Profile } from '@lms/contracts';
import { Icon, IconButton, Input, Menu, type MenuEntry } from '@lms/ui';
import { searchPlaceholder } from './search-target';

export type UserMenuValue = 'profile' | 'notifications' | 'sign-out';

/**
 * The page header (the mockup's `.header`): the navigation button below the `lg` breakpoint, the
 * global search, the notification bell and the user menu. It renders what the shell passes in and
 * reports intent through outputs.
 */
@Component({
  selector: 'app-header',
  imports: [Icon, IconButton, Input, Menu, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  readonly navOpen = input(false);
  readonly user = input<Profile | null>(null);
  readonly unread = input(0);
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

  protected readonly placeholder = computed(() => {
    const user = this.user();
    return searchPlaceholder(user ? user.role : 'learner');
  });

  protected readonly bellLabel = computed(() =>
    this.unread() > 0 ? `Thông báo, ${this.unread()} chưa đọc` : 'Thông báo',
  );

  protected readonly entries = computed<MenuEntry<UserMenuValue>[]>(() => {
    const user = this.user();
    return [
      { kind: 'label', label: user ? `${user.name} · ${user.email}` : '' },
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
  }
}
