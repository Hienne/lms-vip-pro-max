import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TEAM_PREVIEW_SIZE } from '@lms/contracts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DrawerOutlet,
  Empty,
  ErrorState,
  FormActions,
  Icon,
  Input,
  List,
  ListItem,
  Menu,
  PageHeader,
  Pagination,
  Spinner,
  Tree,
  type MenuEntry,
} from '@lms/ui';
import { OrgForm } from './components/org-form/org-form';
import { OrgImport } from './components/org-import/org-import';
import { TeamForm } from './components/team-form/team-form';
import {
  CHILD_ORGS_PAGE_SIZE,
  OrgStore,
  TEAMS_PAGE_SIZE,
  type TeamAction,
} from './data-access/org.store';
import { OrgTreeStore } from './data-access/org-tree.store';

/** Units, departments and teams (the mockup's `org` page): browse the tree and keep it tidy. */
@Component({
  selector: 'app-org',
  imports: [
    Avatar,
    Badge,
    Button,
    Card,
    CardHeader,
    DrawerOutlet,
    Empty,
    ErrorState,
    FormActions,
    Icon,
    Input,
    List,
    ListItem,
    Menu,
    OrgForm,
    OrgImport,
    PageHeader,
    Pagination,
    RouterLink,
    Spinner,
    TeamForm,
    Tree,
  ],
  providers: [OrgTreeStore, OrgStore],
  templateUrl: './org.html',
  styleUrl: './org.scss',
})
export class Org {
  protected readonly store = inject(OrgStore);
  protected readonly previewSize = 3;
  protected readonly pageSize = TEAMS_PAGE_SIZE;
  protected readonly childPageSize = CHILD_ORGS_PAGE_SIZE;
  protected readonly teamActions: readonly MenuEntry<TeamAction>[] = [
    { kind: 'item', value: 'edit', label: 'Sửa nhóm', icon: 'pen-line' },
    { kind: 'separator' },
    {
      kind: 'item',
      value: 'delete',
      label: 'Xóa nhóm',
      icon: 'trash-2',
      tone: 'danger',
    },
  ];
}
