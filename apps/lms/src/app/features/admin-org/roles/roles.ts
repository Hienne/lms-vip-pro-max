import { Component, inject, type TemplateRef, viewChild } from '@angular/core';
import { menuLabel } from '../../../core/menu/menu-catalog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  type DrawerContext,
  Empty,
  ErrorState,
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
    Empty,
    ErrorState,
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

  private readonly body =
    viewChild.required<TemplateRef<DrawerContext>>('body');
  private readonly footer =
    viewChild.required<TemplateRef<DrawerContext>>('footer');

  protected edit(role: Parameters<RolesStore['edit']>[0]): void {
    this.store.edit(role, this.body(), this.footer());
  }
}
