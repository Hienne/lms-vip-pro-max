import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { COURSE_LIMITS } from '@lms/contracts';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  PageHeader,
} from '@lms/ui';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { CourseNewStore } from './data-access/course-new.store';

/**
 * The first step of the mockup's `courseWizard`: the backend creates a course from a code and a
 * title, and the rest is written in the editor, on the draft the server opens.
 */
@Component({
  selector: 'app-course-new',
  imports: [
    Alert,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    Field,
    FormField,
    FormRoot,
    Input,
    PageHeader,
    RouterLink,
  ],
  providers: [CourseNewStore],
  templateUrl: './course-new.html',
  styleUrl: './course-new.scss',
})
export class CourseNew implements HasUnsavedChanges {
  protected readonly store = inject(CourseNewStore);

  private readonly model = signal({ code: '', title: '' });
  protected readonly courseForm = form(
    this.model,
    (path) => {
      required(path.code, { message: 'Nhập mã khóa học.' });
      maxLength(path.code, COURSE_LIMITS.code, {
        message: `Mã tối đa ${COURSE_LIMITS.code} ký tự.`,
      });
      required(path.title, { message: 'Nhập tên khóa học.' });
      maxLength(path.title, COURSE_LIMITS.title, {
        message: `Tên tối đa ${COURSE_LIMITS.title} ký tự.`,
      });
    },
    {
      submission: {
        action: async () =>
          this.store.create({
            code: this.model().code.trim(),
            title: this.model().title.trim(),
          }),
      },
    },
  );

  hasUnsavedChanges(): boolean {
    return (
      !this.store.created$() &&
      !!(this.model().code.trim() || this.model().title.trim())
    );
  }
}
