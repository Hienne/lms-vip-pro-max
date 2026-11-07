import { Component, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
} from '@lms/ui';
import { GamificationAdminStore } from '../../data-access/gamification-admin.store';
import {
  CALENDAR_TYPE_LABEL,
  calendarFormSchema,
  toCalendarCommand,
  toCalendarFormValue,
} from './calendar-editor.schema';

/**
 * The bank-wide working calendar of one year: the days that are not the usual Monday-to-Friday week. A save
 * replaces the year's days; streaks use the new calendar from their next evaluation.
 */
@Component({
  selector: 'app-calendar-editor',
  imports: [
    Button,
    Empty,
    ErrorState,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    Select,
    Spinner,
  ],
  templateUrl: './calendar-editor.html',
  styleUrl: './calendar-editor.scss',
})
export class CalendarEditor {
  protected readonly store = inject(GamificationAdminStore);
  protected readonly typeLabel = CALENDAR_TYPE_LABEL;
  protected readonly types = Object.keys(CALENDAR_TYPE_LABEL) as Array<
    keyof typeof CALENDAR_TYPE_LABEL
  >;

  private readonly model = linkedSignal(() =>
    toCalendarFormValue(this.store.calendar$()),
  );
  protected readonly calendarForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, () =>
        calendarFormSchema(this.store.year$()),
      );
    },
    {
      submission: {
        action: async () => {
          this.store.saveCalendar(toCalendarCommand(this.model()));
        },
      },
    },
  );

  protected addDay(): void {
    this.model.update((value) => ({
      days: [
        ...value.days,
        { date: `${this.store.year$()}-01-01`, type: 'HOLIDAY', note: '' },
      ],
    }));
  }

  protected removeDay(index: number): void {
    this.model.update((value) => ({
      days: value.days.filter((_, i) => i !== index),
    }));
  }
}
