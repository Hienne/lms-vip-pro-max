import { Component, inject, type TemplateRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  type DrawerContext,
  Empty,
  ErrorState,
  Icon,
  IconButton,
  List,
  ListIcon,
  ListItem,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { isUnitAdmin, RoleBadge } from '../../../shared/status/role-badge';
import { GroupForm } from './components/group-form/group-form';
import { UnitForm } from './components/unit-form/unit-form';
import { OrgStore } from './data-access/org.store';

/** Members listed under a group before "+n người khác". */
export const GROUP_MEMBERS_SHOWN = 5;

/** Units, departments and teams (the mockup's `org` page): browse them and keep them tidy. */
@Component({
  selector: 'app-org',
  imports: [
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    Empty,
    ErrorState,
    GroupForm,
    Icon,
    IconButton,
    List,
    ListIcon,
    ListItem,
    PageHeader,
    RoleBadge,
    RouterLink,
    Spinner,
    UnitForm,
  ],
  providers: [OrgStore],
  templateUrl: './org.html',
  styleUrl: './org.scss',
})
export class Org {
  protected readonly store = inject(OrgStore);
  protected readonly shown = GROUP_MEMBERS_SHOWN;
  protected readonly isUnitAdmin = isUnitAdmin;

  private readonly unitBody =
    viewChild.required<TemplateRef<DrawerContext>>('unitBody');
  private readonly unitFooter =
    viewChild.required<TemplateRef<DrawerContext>>('unitFooter');
  private readonly groupBody =
    viewChild.required<TemplateRef<DrawerContext>>('groupBody');
  private readonly groupFooter =
    viewChild.required<TemplateRef<DrawerContext>>('groupFooter');

  protected editUnit(unit: Parameters<OrgStore['editUnit']>[0]): void {
    this.store.editUnit(unit, this.unitBody(), this.unitFooter());
  }

  protected editGroup(group: Parameters<OrgStore['editGroup']>[0]): void {
    this.store.editGroup(group, this.groupBody(), this.groupFooter());
  }
}
