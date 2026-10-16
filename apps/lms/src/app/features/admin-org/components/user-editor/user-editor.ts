import { Component, inject } from '@angular/core';
import {
  Alert,
  Button,
  DrawerOutlet,
  FormActions,
  Icon,
  Spinner,
} from '@lms/ui';
import { UserEditorStore } from '../../data-access/user-editor.store';
import { UserForm } from '../user-form/user-form';

/**
 * The add/edit drawer of a user (the mockup's `userForm`), shared by the users list and the user
 * page. It only renders: the page provides `UserEditorStore`, puts this component once in its
 * template and calls `store.edit(user)`; the drawer shows while the store's `editing$` is set.
 */
@Component({
  selector: 'app-user-editor',
  imports: [Alert, Button, DrawerOutlet, FormActions, Icon, Spinner, UserForm],
  templateUrl: './user-editor.html',
  styleUrl: './user-editor.scss',
})
export class UserEditor {
  protected readonly store = inject(UserEditorStore);
}
