import { Component, inject } from '@angular/core';
import {
  form,
  FormField,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  Alert,
  Button,
  Field,
  Icon,
  Input,
  SectionCard,
  Select,
  Textarea,
} from '@lms/ui';
import { UPLOAD_ACCEPT } from '../../../../core/knowledge/upload-rules';
import { LEVEL_OPTIONS, StartCourseFormSchema } from './ai-course-section.form';
import { StartCourseStore } from './data-access/start-course.store';

/**
 * "Tạo bằng AI" on step 1 of a new course: the source file and what the course is for. Its
 * values live in the page's {@link StartCourseStore}, which the header's "Tạo bằng AI" button
 * reads; the programme, name and description are step 1's own fields.
 */
@Component({
  selector: 'app-ai-course-section',
  imports: [
    Alert,
    Button,
    Field,
    FormField,
    Icon,
    Input,
    SectionCard,
    Select,
    Textarea,
  ],
  templateUrl: './ai-course-section.html',
  styleUrl: './ai-course-section.scss',
})
export class AiCourseSection {
  protected readonly store = inject(StartCourseStore);
  protected readonly accept = UPLOAD_ACCEPT;
  protected readonly levels = LEVEL_OPTIONS;

  protected readonly aiForm = form(this.store.model, (path) =>
    validateStandardSchema(path, StartCourseFormSchema),
  );

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.item(0) ?? null;
    input.value = '';
    this.store.chooseFile(picked);
  }
}
