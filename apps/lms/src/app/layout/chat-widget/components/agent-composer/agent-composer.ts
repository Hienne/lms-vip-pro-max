import {
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  FormRoot,
  maxLength,
  validateStandardSchema,
} from '@angular/forms/signals';
import { AGENT_MESSAGE_MAX_LENGTH } from '@lms/contracts';
import { Button, Icon, Textarea } from '@lms/ui';
import {
  AgentComposerSchema,
  COUNTER_FROM,
  type AgentComposerValue,
} from './agent-composer.form';

/**
 * The message box of the quick assistant. `Enter` sends, `Shift+Enter` starts a new line (and an
 * `Enter` that confirms an input-method composition does neither). While a reply is on its way the
 * button stops it instead.
 */
@Component({
  selector: 'app-agent-composer',
  imports: [Button, FormField, FormRoot, Icon, Textarea],
  templateUrl: './agent-composer.html',
  styleUrl: './agent-composer.scss',
})
export class AgentComposer {
  readonly answering = input(false);
  readonly offline = input(false);
  readonly ask = output<string>();
  readonly stop = output<void>();

  private readonly box =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('box');
  private readonly formElement =
    viewChild.required<ElementRef<HTMLFormElement>>('formElement');

  private readonly model = signal<AgentComposerValue>({ message: '' });
  protected readonly composerForm = form(
    this.model,
    (path) => {
      maxLength(path.message, AGENT_MESSAGE_MAX_LENGTH);
      validateStandardSchema(path, AgentComposerSchema);
      disabled(path.message, () => this.offline());
    },
    {
      submission: {
        action: async () => {
          if (this.answering() || this.offline()) return;
          this.ask.emit(this.model().message.trim());
          this.composerForm().reset({ message: '' });
        },
      },
    },
  );

  protected readonly limit = AGENT_MESSAGE_MAX_LENGTH;
  protected readonly length = computed(() => this.model().message.length);
  protected readonly counting = computed(() => this.length() >= COUNTER_FROM);
  protected readonly tooLong = computed(() => this.length() > this.limit);
  protected readonly canSend = computed(
    () => this.model().message.trim().length > 0 && !this.offline(),
  );

  /** Puts the cursor in the box, as the panel does when it opens. */
  focus(): void {
    this.box().nativeElement.focus();
  }

  protected send(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    event.preventDefault();
    this.formElement().nativeElement.requestSubmit();
  }
}
