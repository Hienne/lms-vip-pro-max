import { Injectable, signal } from '@angular/core';
import type { MenuEntry } from '@lms/ui';

export type MenuDemoAction = 'edit' | 'copy' | 'archive' | 'delete';

const ACTION_LABEL: Record<MenuDemoAction, string> = {
  edit: 'Sửa',
  copy: 'Sao chép',
  archive: 'Lưu trữ',
  delete: 'Xóa',
};

/** State of the menu demo: the menu's entries and the action the viewer last chose. */
@Injectable()
export class MenuDemoStore {
  private readonly state = {
    chosen: signal<MenuDemoAction | null>(null),
  };

  readonly entries: readonly MenuEntry<MenuDemoAction>[] = [
    { kind: 'label', label: 'Hành động' },
    { kind: 'item', value: 'edit', label: 'Sửa', icon: 'pen-line' },
    { kind: 'item', value: 'copy', label: 'Sao chép', icon: 'copy' },
    {
      kind: 'item',
      value: 'archive',
      label: 'Lưu trữ (không khả dụng)',
      icon: 'archive',
      disabled: true,
    },
    { kind: 'separator' },
    {
      kind: 'item',
      value: 'delete',
      label: 'Xóa',
      icon: 'trash-2',
      tone: 'danger',
    },
  ];

  readonly chosen$ = this.state.chosen.asReadonly();

  choose(action: MenuDemoAction): void {
    this.state.chosen.set(action);
  }

  label(action: MenuDemoAction): string {
    return ACTION_LABEL[action];
  }
}
