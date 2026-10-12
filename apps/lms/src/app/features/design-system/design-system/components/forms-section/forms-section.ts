import { Component, computed, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  maxLength,
  required,
  type FieldTree,
} from '@angular/forms/signals';
import {
  Button,
  Checkbox,
  ErrorSummary,
  type ErrorSummaryItem,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { FormsSectionStore } from './data-access/forms-section.store';

@Component({
  selector: 'app-forms-section',
  imports: [
    DsSection,
    DsDemo,
    Field,
    ErrorSummary,
    FormField,
    Button,
    Input,
    Select,
    Textarea,
    Checkbox,
    Switch,
  ],
  providers: [FormsSectionStore],
  templateUrl: './forms-section.html',
})
export class FormsSection {
  protected readonly store = inject(FormsSectionStore);

  private readonly initialModel = {
    title: '',
    email: 'sai-dinh-dang',
    program: '',
    description: '',
  };
  private readonly model = signal({ ...this.initialModel });
  protected readonly demoForm = form(this.model, (path) => {
    required(path.title, { message: 'Tên khóa học là bắt buộc.' });
    maxLength(path.title, 120, { message: 'Tối đa 120 ký tự.' });
    required(path.email, { message: 'Email là bắt buộc.' });
    email(path.email, { message: 'Email không đúng định dạng.' });
  });

  protected readonly titleErrors = this.touchedMessages(this.demoForm.title);
  protected readonly emailErrors = this.touchedMessages(this.demoForm.email);
  protected readonly summaryItems = computed<ErrorSummaryItem[]>(() => [
    ...this.titleErrors().map((message) => ({
      controlId: 'ds-title',
      message,
    })),
    ...this.emailErrors().map((message) => ({
      controlId: 'ds-email',
      message,
    })),
  ]);

  protected validate(): void {
    this.demoForm().markAsTouched();
    this.store.setSummaryShown(true);
  }

  protected clearErrors(): void {
    this.demoForm().reset({ ...this.initialModel });
    this.store.setSummaryShown(false);
  }

  private touchedMessages(field: FieldTree<string>) {
    return computed(() =>
      field().touched()
        ? field()
            .errors()
            .map((e) => e.message ?? '')
        : [],
    );
  }
}
