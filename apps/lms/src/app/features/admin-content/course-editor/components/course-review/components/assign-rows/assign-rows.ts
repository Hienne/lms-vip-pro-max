import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Card,
  CardBody,
  Field,
  Icon,
  IconButton,
  LinkButton,
  Switch,
  DateInput,
} from '@lms/ui';
import { TargetPicker } from '../../../../../../../shared/assignment-target/target-picker/target-picker';
import { TARGET_OWNER_ORG } from '../../../../../../../shared/assignment-target/target-picker/data-access/target-options.store';
import { TARGET_TYPE_LABEL } from '../../../../../../../shared/assignment-target/target-labels';
import { CourseEditorStore } from '../../../../data-access/course-editor.store';
import { REMIND_DAYS } from '../../../../data-access/publish-targets';

/**
 * "Giao khóa học" on step 4: the targets the course is assigned to in the same click as the
 * publish, each with its own dates. The picker is the one of "Giao học & hạn"; a pick becomes a
 * row. The rows live in the editor's store and go with the publish, all or nothing.
 */
@Component({
  selector: 'app-assign-rows',
  imports: [
    DateInput,
    Card,
    CardBody,
    Field,
    Icon,
    IconButton,
    LinkButton,
    RouterLink,
    Switch,
    TargetPicker,
  ],
  providers: [
    {
      // The picker offers the learning groups of the unit that owns the course.
      provide: TARGET_OWNER_ORG,
      useFactory: () => inject(CourseEditorStore).ownerOrgId$,
    },
  ],
  templateUrl: './assign-rows.html',
  styleUrl: './assign-rows.scss',
})
export class AssignRows {
  protected readonly store = inject(CourseEditorStore);
  protected readonly typeLabel = TARGET_TYPE_LABEL;
  protected readonly remindDays = REMIND_DAYS;

  protected setStart(id: number, startDate: string): void {
    this.store.setRowDates(id, { startDate });
  }

  protected setDue(id: number, dueDate: string): void {
    this.store.setRowDates(id, { dueDate });
  }

  protected setReminder(event: Event): void {
    this.store.setReminder((event.target as HTMLInputElement).checked);
  }
}
