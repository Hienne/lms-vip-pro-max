import { Component, computed, inject } from '@angular/core';
import { APP_CONFIG } from '../../config/app-config';
import { Menu, type MenuEntry } from '@lms/ui';
import { DevToolbarStore } from './dev-toolbar.store';

type Choice =
  | `user:${string}`
  | 'offline'
  | 'expire'
  | 'admin-url'
  | 'design-system';

/**
 * The floating "Demo" menu of development and staging builds (the mockup's Demo menu in the
 * header). Loaded by the shell only where `DEV_FEATURES.toolbar` exists, so production has none.
 */
@Component({
  selector: 'app-dev-toolbar',
  imports: [Menu],
  providers: [DevToolbarStore],
  template: `
    <div class="dev-toolbar">
      <ui-menu
        label="Demo"
        icon="settings"
        size="sm"
        [entries]="entries()"
        (selected)="run($event)"
      />
    </div>
  `,
  styleUrl: './dev-toolbar.scss',
})
export class DevToolbar {
  protected readonly store = inject(DevToolbarStore);
  private readonly config = inject(APP_CONFIG);

  /** Signing in as a demo user only works against the mock backend, so it is offered only then. */
  private readonly userEntries = computed<MenuEntry<Choice>[]>(() =>
    this.config.mockApi && this.config.mockBackend
      ? [
          { kind: 'label', label: 'Đăng nhập bằng tài khoản demo' },
          ...this.store.accounts.map(
            (account): MenuEntry<Choice> => ({
              kind: 'item',
              value: `user:${account.userId}`,
              label: `${account.roleText} — ${account.fullName}`,
              icon: 'user',
              disabled: account.userId === this.store.currentUserId$(),
            }),
          ),
          { kind: 'separator' },
        ]
      : [],
  );

  protected readonly entries = computed<MenuEntry<Choice>[]>(() => [
    ...this.userEntries(),
    { kind: 'label', label: 'Mô phỏng sự cố' },
    {
      kind: 'item',
      value: 'offline',
      label: this.store.offline$()
        ? 'Bật lại kết nối mạng'
        : 'Mô phỏng mất kết nối',
      icon: 'wifi-off',
    },
    {
      kind: 'item',
      value: 'expire',
      label: 'Mô phỏng hết phiên đăng nhập',
      icon: 'clock',
    },
    {
      kind: 'item',
      value: 'admin-url',
      label: 'Thử truy cập URL quản trị (kiểm thử vượt quyền)',
      icon: 'lock',
    },
    { kind: 'separator' },
    {
      kind: 'item',
      value: 'design-system',
      label: 'Mở Design System',
      icon: 'palette',
    },
  ]);

  protected run(choice: Choice): void {
    if (choice.startsWith('user:')) {
      const account = this.store.accounts.find(
        (a) => `user:${a.userId}` === choice,
      );
      if (account) this.store.signInAs(account);
    } else if (choice === 'offline') this.store.toggleOffline();
    else if (choice === 'expire') this.store.expireSession();
    else if (choice === 'admin-url') this.store.tryAdminUrl();
    else this.store.openDesignSystem();
  }
}
