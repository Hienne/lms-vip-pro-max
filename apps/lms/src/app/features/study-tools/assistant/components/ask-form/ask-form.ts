import { Component, input, output, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  validateStandardSchema,
} from '@angular/forms/signals';
import { MAX_QUESTION_LENGTH } from '@lms/contracts';
import { Button, Icon, Input } from '@lms/ui';
import { AskFormSchema, type AskFormValue } from './ask-form.form';

/** The question box. While an answer is on its way the button stops it instead. */
@Component({
  selector: 'app-ask-form',
  imports: [Button, FormField, FormRoot, Icon, Input],
  templateUrl: './ask-form.html',
  styleUrl: './ask-form.scss',
})
export class AskForm {
  readonly answering = input(false);
  readonly ask = output<string>();
  readonly stop = output<void>();

  private readonly model = signal<AskFormValue>({ question: '' });
  protected readonly askForm = form(
    this.model,
    (path) => {
      maxLength(path.question, MAX_QUESTION_LENGTH);
      validateStandardSchema(path, AskFormSchema);
    },
    {
      submission: {
        action: async () => {
          if (this.answering()) return;
          this.ask.emit(this.model().question.trim());
          this.askForm().reset({ question: '' });
        },
      },
    },
  );
}
