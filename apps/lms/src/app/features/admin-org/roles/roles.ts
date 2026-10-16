import { Component, inject } from '@angular/core';
import { menuLabel } from '../../../core/menu/menu-catalog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DrawerOutlet,
  Empty,
  ErrorState,
  FormActions,
  Icon,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { RoleForm } from './components/role-form/role-form';
import { RolesStore } from './data-access/roles.store';

/** Roles and the menus each grants (new in the Angular app: the mockup's four roles were fixed). */
@Component({
  selector: 'app-roles',
  imports: [
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    DrawerOutlet,
    Empty,
    ErrorState,
    FormActions,
    Icon,
    PageHeader,
    RoleForm,
    Spinner,
  ],
  providers: [RolesStore],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles {
  protected readonly store = inject(RolesStore);
  protected readonly menuLabel = menuLabel;
}
