import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, type FieldTree } from '@angular/forms/signals';
import {
  Button,
  Checkbox,
  Chip,
  ErrorSummary,
  Field,
  Input,
  OptionCard,
  Search,
  Select,
  Switch,
  Textarea,
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
    Button,
    Input,
    Select,
    Textarea,
    Checkbox,
    OptionCard,
    Switch,
    Search,
    Chip,
  ],
  providers: [FormsSectionStore],
  templateUrl: './forms-section.html',
})
export class FormsSection {
  protected readonly store = inject(FormsSectionStore);

  private readonly model = signal<FormsDemoFormValue>({
    ...FORMS_DEMO_INITIAL_VALUE,
  });
  protected readonly demoForm = form(this.model, formsDemoSchema);

  protected readonly titleErrors = this.touchedMessages(this.demoForm.title);
  protected readonly emailErrors = this.touchedMessages(this.demoForm.email);
  protected readonly summaryItems = computed(() =>
    toSummaryItems(this.titleErrors(), this.emailErrors()),
  );

  protected validate(): void {
    this.demoForm().markAsTouched();
    this.store.showSummary();
  }

  protected clearErrors(): void {
    this.demoForm().reset({ ...FORMS_DEMO_INITIAL_VALUE });
    this.store.hideSummary();
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
