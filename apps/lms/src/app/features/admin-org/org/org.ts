import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TEAM_PREVIEW_SIZE } from '@lms/contracts';
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
  Pagination,
  Spinner,
  Tree,
} from '@lms/ui';
import { OrgForm } from './components/org-form/org-form';
import { OrgImport } from './components/org-import/org-import';
import { TeamForm } from './components/team-form/team-form';
import { OrgStore, TEAMS_PAGE_SIZE } from './data-access/org.store';
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
    IconButton,
    List,
    ListIcon,
    ListItem,
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
  protected readonly previewSize = TEAM_PREVIEW_SIZE;
  protected readonly pageSize = TEAMS_PAGE_SIZE;
}
