import { Component, inject } from '@angular/core';
import {
  Badge,
  Card,
  ErrorState,
  FmtDatetimePipe,
  PageHeader,
  Spinner,
  TabPanel,
  Table,
  TablePrimary,
  TableSub,
  TableWrap,
  Tabs,
} from '@lms/ui';
import { BadgeAdmin } from './components/badge-admin/badge-admin';
import { CalendarEditor } from './components/calendar-editor/calendar-editor';
import { ConfigForm } from './components/config-form/config-form';
import { GamificationAdminStore } from './data-access/gamification-admin.store';

/**
 * Gamification settings for system admins: XP weights and the level ladder, the working calendar and the
 * history of saved versions. Every figure is the server's; the server refuses anyone who is not a system admin.
 */
@Component({
  selector: 'app-gamification-admin',
  imports: [
    Badge,
    BadgeAdmin,
    CalendarEditor,
    Card,
    ConfigForm,
    ErrorState,
    FmtDatetimePipe,
    PageHeader,
    Spinner,
    TabPanel,
    Table,
    TablePrimary,
    TableSub,
    TableWrap,
    Tabs,
  ],
  providers: [GamificationAdminStore],
  templateUrl: './gamification-admin.html',
  styleUrl: './gamification-admin.scss',
})
export class GamificationAdmin {
  protected readonly store = inject(GamificationAdminStore);
}
