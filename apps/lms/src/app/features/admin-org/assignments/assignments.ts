import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DataTableCell,
  DrawerOutlet,
  Empty,
  ErrorState,
  FmtDatePipe,
  FormActions,
  Icon,
  IconButton,
  PageHeader,
  Progress,
  Select,
  Spinner,
  TablePrimary,
  TableSub,
  TabPanel,
  Tabs,
  Tooltip,
  type TabItem,
} from '@lms/ui';
import { DueDate } from '../../../shared/course/due-date';
import { TARGET_TYPE_LABEL } from '../../../shared/assignment-target/target-labels';
import { AssignForm } from './components/assign-form/assign-form';
import { AssignmentDetail } from './components/assignment-detail/assignment-detail';
import { GroupForm } from './components/group-form/group-form';
import { GroupMembers } from './components/group-members/group-members';
import { ScheduleForm } from './components/schedule-form/schedule-form';
import { WithdrawForm } from './components/withdraw-form/withdraw-form';
import { AssignmentsStore } from './data-access/assignments.store';

/**
 * Course assignment and deadlines (the mockup's `assignments`): an org's assignments across courses
 * with the server's counts, the assign, schedule and revoke drawers, reminders, the detail of an
 * assignment with per-learner revoke, and the learning groups courses can be assigned to.
 */
@Component({
  selector: 'app-assignments',
  imports: [
    AssignForm,
    AssignmentDetail,
    Badge,
    Button,
    Card,
    DataTable,
    DataTableCell,
    DrawerOutlet,
    DueDate,
    Empty,
    ErrorState,
    FmtDatePipe,
    FormActions,
    GroupForm,
    GroupMembers,
    Icon,
    IconButton,
    NgTemplateOutlet,
    PageHeader,
    Progress,
    RouterLink,
    ScheduleForm,
    Select,
    Spinner,
    TablePrimary,
    TableSub,
    TabPanel,
    Tabs,
    Tooltip,
    WithdrawForm,
  ],
  providers: [AssignmentsStore],
  templateUrl: './assignments.html',
  styleUrl: './assignments.scss',
})
export class Assignments {
  protected readonly store = inject(AssignmentsStore);
  private readonly assignForm = viewChild(AssignForm);

  hasUnsavedChanges(): boolean {
    return (
      this.store.isAssigning$() ||
      (this.assignForm()?.hasUnsavedChanges() ?? false)
    );
  }

  protected readonly typeLabel = TARGET_TYPE_LABEL;

  protected readonly tabs = computed((): readonly TabItem[] => {
    const counts = this.store.counts$();
    return [
      { id: 'assignments', label: 'Lượt giao', count: counts.assignments },
      { id: 'groups', label: 'Nhóm học tập', count: counts.groups },
    ];
  });

  protected readonly detailTitle = computed(() => {
    const assignment = this.store.detail$()?.assignment;
    if (!assignment) return 'Lượt giao';
    return assignment.title || `Lượt giao #${assignment.id}`;
  });

  protected readonly membersTitle = computed(() => {
    const group = this.store.groupDetail$()?.group;
    return group ? `Thành viên · ${group.name}` : 'Thành viên nhóm';
  });
}
