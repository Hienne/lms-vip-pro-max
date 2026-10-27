import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import {
  Button,
  Checkbox,
  Dropzone,
  Chip,
  ErrorSummary,
  Icon,
  Field,
  Input,
  OptionCard,
  Search,
  Select,
  Switch,
  Textarea,
  UploadItem,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { FormsSectionStore } from './data-access/forms-section.store';
import {
  FORMS_DEMO_INITIAL_VALUE,
  formsDemoSchema,
  toSummaryItems,
  type FormsDemoFormValue,
} from './forms-section.form';

@Component({
  selector: 'app-forms-section',
  imports: [
    DsSection,
    DsDemo,
    Field,
    ErrorSummary,
    FormField,
    FormRoot,
    Button,
    Input,
    Select,
    Textarea,
    Checkbox,
    Dropzone,
    Icon,
    UploadItem,

    OptionCard,
    Switch,
    Search,
    Chip,
  ],
  providers: [FormsSectionStore],
  templateUrl: './forms-section.html',
  styleUrl: './forms-section.scss',
})
export class FormsSection {
  protected readonly store = inject(FormsSectionStore);

  private readonly model = signal<FormsDemoFormValue>({
    ...FORMS_DEMO_INITIAL_VALUE,
  });
  protected readonly demoForm = form(this.model, formsDemoSchema);

  protected readonly summaryItems = computed(() =>
    toSummaryItems(this.demoForm().errorSummary()),
  );

  protected validate(): void {
    this.demoForm().markAsTouched();
    this.store.showSummary();
  }

  protected clearErrors(): void {
    this.demoForm().reset({ ...FORMS_DEMO_INITIAL_VALUE });
    this.store.hideSummary();
  }
}
