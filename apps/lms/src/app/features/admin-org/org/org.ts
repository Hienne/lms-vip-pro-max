import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
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
    DrawerOutlet,
    Empty,
    ErrorState,
    FormActions,
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
}
