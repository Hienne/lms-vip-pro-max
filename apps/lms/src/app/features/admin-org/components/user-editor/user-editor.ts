import { Component, inject, type TemplateRef, viewChild } from '@angular/core';
import type { UserListItem } from '@lms/contracts';
import { Alert, Button, type DrawerContext, Icon, Spinner } from '@lms/ui';
import { UserEditorStore } from '../../data-access/user-editor.store';
import { UserForm } from '../user-form/user-form';

/**
 * The add/edit drawer of a user and the lock and reset actions around it (the mockup's `userForm`
 * and `setStatus`), shared by the users list and the user page. The page provides
 * `UserEditorStore`, puts this component once in its template and calls `open` and `toggleLock`.
 */
@Component({
  selector: 'app-user-editor',
  imports: [Alert, Button, Icon, Spinner, UserForm],
  templateUrl: './user-editor.html',
  styleUrl: './user-editor.scss',
})
export class UserEditor {
  protected readonly store = inject(UserEditorStore);

  private readonly body =
    viewChild.required<TemplateRef<DrawerContext>>('body');
  private readonly footer =
    viewChild.required<TemplateRef<DrawerContext>>('footer');

  /** Opens the drawer to add a user (`null`) or to edit one. */
  open(user: UserListItem | null): void {
    this.store.edit(user, this.body(), this.footer());
  }

  toggleLock(user: UserListItem): void {
    this.store.toggleLock(user);
  }
}
