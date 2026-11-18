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
import { Icon, IconButton, Textarea } from '@lms/ui';
import {
  UPLOAD_ACCEPT,
  uploadProblem,
} from '../../../../core/knowledge/upload-rules';
import {
  AgentComposerSchema,
  COUNTER_FROM,
  DRAFTING_SOURCE_QUESTION,
  type AgentComposerValue,
} from './agent-composer.form';

/**
 * The message box of the quick assistant: one line that grows as the user types, with the send
 * button inside it. `Enter` sends, `Shift+Enter` starts a new line (and an `Enter` that confirms an
 * input-method composition does neither). While a reply is on its way the button stops it instead.
 * An instructor or admin (`canAttach`) can also attach one file, which the message then asks the
 * assistant to build a course from. Opened by "Soạn cùng trợ lý" ({@link pickSource}), the file
 * picked is sent at once, since the user came to build a course from it.
 */
@Component({
  selector: 'app-agent-composer',
  imports: [FormField, FormRoot, Icon, IconButton, Textarea],
  templateUrl: './agent-composer.html',
  styleUrl: './agent-composer.scss',
})
export class AgentComposer {
  readonly answering = input(false);
  readonly offline = input(false);
  /** Offers the paperclip: only for people who may generate a course. */
  readonly canAttach = input(false);
  readonly ask = output<string>();
  readonly askWithFile = output<{ message: string; file: File }>();
  readonly stop = output<void>();

  private readonly box =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('box');
  private readonly formElement =
    viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');
  private readonly attachButton =
    viewChild<ElementRef<HTMLButtonElement>>('attachButton');
  /** The next file picked is sent at once: the picker was opened by {@link pickSource}. */
  private sendOnPick = false;

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
          const message = this.model().message.trim();
          const file = this.file();
          if (file) this.askWithFile.emit({ message, file });
          else this.ask.emit(message);
          this.file.set(null);
          this.composerForm().reset({ message: '' });
        },
      },
    },
  );

  protected readonly accept = UPLOAD_ACCEPT;
  protected readonly file = signal<File | null>(null);
  protected readonly fileProblem = signal<string | null>(null);

  protected readonly limit = AGENT_MESSAGE_MAX_LENGTH;
  protected readonly length = computed(() => this.model().message.length);
  protected readonly counting = computed(() => this.length() >= COUNTER_FROM);
  protected readonly tooLong = computed(() => this.length() > this.limit);
  protected readonly canSend = computed(
    () => this.model().message.trim().length > 0 && !this.offline(),
  );

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.item(0) ?? null;
    input.value = '';
    if (!picked) return;
    const problem = uploadProblem(picked);
    this.fileProblem.set(problem);
    const sendNow = this.sendOnPick && !problem && !this.answering();
    this.sendOnPick = false;
    if (sendNow) {
      this.file.set(null);
      this.askWithFile.emit({
        message: DRAFTING_SOURCE_QUESTION,
        file: picked,
      });
      return;
    }
    this.file.set(problem ? null : picked);
  }

  /** The paperclip: the file picked waits for the message. */
  protected attach(): void {
    this.sendOnPick = false;
    this.picker()?.nativeElement.click();
  }

  /**
   * "Soạn cùng trợ lý": focus on the paperclip and the file picker opened, and the file picked
   * there is sent at once. Nothing happens for someone who may not attach a file.
   */
  pickSource(): void {
    const picker = this.picker()?.nativeElement;
    if (!picker) return;
    this.sendOnPick = true;
    this.attachButton()?.nativeElement.focus();
    picker.click();
  }

  protected removeFile(): void {
    this.file.set(null);
    this.fileProblem.set(null);
  }

  /** Puts the cursor in the box, as the panel does when it opens. */
  focus(): void {
    this.box().nativeElement.focus();
  }

  protected send(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    event.preventDefault();
    this.submit();
  }

  /** The icon button cannot be a submit button (`uiIconButton` sets `type="button"`), so it asks the form. */
  protected submit(): void {
    this.formElement().nativeElement.requestSubmit();
  }
}
