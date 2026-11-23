import {
  afterNextRender,
  Component,
  ElementRef,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  required,
  submit,
} from '@angular/forms/signals';
import { FLOW_LIMITS, type FlowObject, type FlowStep } from '@lms/contracts';
import { Button, Field, Input, Select, Textarea } from '@lms/ui';

/** What the step form edits: `to` as the select holds it, '' for own work. */
interface StepFormValue {
  from: string;
  to: string;
  title: string;
  description: string;
}

/** Edits one Bước chuyển: from, to (or own work), title and an optional description. */
@Component({
  selector: 'app-flow-step-form',
  imports: [FormField, Button, Field, Input, Select, Textarea],
  templateUrl: './flow-step-form.html',
  styleUrl: './flow-step-form.scss',
})
export class FlowStepForm {
  readonly step = input.required<FlowStep>();
  readonly objects = input.required<readonly FlowObject[]>();
  /** Just made by a drag: the hint shows and cancelling drops the step. */
  readonly fresh = input(false);

  readonly saved =
    output<Pick<FlowStep, 'from' | 'to' | 'title' | 'description'>>();
  readonly cancelled = output<void>();

  private readonly model = linkedSignal<StepFormValue>(() => {
    const step = this.step();
    return {
      from: step.from,
      to: step.to ?? '',
      title: step.title,
      description: step.description ?? '',
    };
  });

  protected readonly stepForm = form(this.model, (path) => {
    required(path.title, { message: 'Nhập tiêu đề bước.' });
    maxLength(path.title, FLOW_LIMITS.title, {
      message: `Tiêu đề tối đa ${FLOW_LIMITS.title} ký tự.`,
    });
    maxLength(path.description, FLOW_LIMITS.description, {
      message: `Mô tả tối đa ${FLOW_LIMITS.description} ký tự.`,
    });
  });

  private readonly title =
    viewChild.required<ElementRef<HTMLInputElement>>('title');

  constructor() {
    // A step just made by a drag opens with its title selected, ready to type over.
    afterNextRender(() => {
      if (!this.fresh()) return;
      const field = this.title().nativeElement;
      field.focus();
      field.select();
    });
  }

  protected save(): void {
    void submit(this.stepForm, {
      action: async () => {
        const value = this.model();
        this.saved.emit({
          from: value.from,
          to: value.to && value.to !== value.from ? value.to : null,
          title: value.title.trim(),
          description: value.description.trim() || null,
        });
        return undefined;
      },
    });
  }
}
