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
  form,
  FormField,
  FormRoot,
  maxLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { Button, Field, Input } from '@lms/ui';

@Component({
  selector: 'app-room-composer',
  imports: [Button, Field, FormField, FormRoot, Input],
  templateUrl: './room-composer.html',
  styleUrl: './room-composer.scss',
})
export class RoomComposer {
  readonly disabled = input(true);
  readonly sent = output<string>();
  private readonly input =
    viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly model = signal({ text: '' });
  protected readonly count = computed(() => this.model().text.length);
  protected readonly chatForm = form(
    this.model,
    (path) => {
      required(path.text, { message: 'Hãy nhập nội dung tin nhắn.' });
      pattern(path.text, /\S/, {
        message: 'Tin nhắn không được chỉ có khoảng trắng.',
      });
      maxLength(path.text, 280, { message: 'Tin nhắn tối đa 280 ký tự.' });
    },
    {
      submission: {
        action: async () => {
          if (!this.disabled()) {
            this.sent.emit(this.model().text.trim());
            this.chatForm().reset({ text: '' });
          }
        },
      },
    },
  );
  focus(): void {
    if (!this.disabled()) this.input().nativeElement.focus();
  }
}
