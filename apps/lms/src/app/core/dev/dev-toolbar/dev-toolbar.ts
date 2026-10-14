import { Component, computed, inject } from '@angular/core';
import { Menu, type MenuEntry } from '@lms/ui';
import { roleLabel } from '../../../shared/status/role-badge';
import { DevToolbarStore } from './dev-toolbar.store';

type Choice =
  | `role:${string}`
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
    <div
      class="dev-toolbar"
      (pointerenter)="store.load()"
      (focusin)="store.load()"
    >
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

  protected readonly entries = computed<MenuEntry<Choice>[]>(() => [
    { kind: 'label', label: 'Đăng nhập nhanh theo vai trò' },
    ...this.store.accounts$().map(
      (account): MenuEntry<Choice> => ({
        kind: 'item',
        value: `role:${account.id}`,
        label: `${roleLabel(account.role)}${account.adminScope ? ' đơn vị' : ''} — ${account.name}`,
        icon: 'user',
        disabled: account.id === this.store.currentId$(),
      }),
    ),
    { kind: 'separator' },
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
    if (choice.startsWith('role:')) {
      const account = this.store
        .accounts$()
        .find((a) => `role:${a.id}` === choice);
      if (account) this.store.switchRole(account);
    } else if (choice === 'offline') this.store.toggleOffline();
    else if (choice === 'expire') this.store.expireSession();
    else if (choice === 'admin-url') this.store.tryAdminUrl();
    else this.store.openDesignSystem();
  }
}
