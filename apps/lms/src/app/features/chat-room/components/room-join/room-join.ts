import { Component, input, linkedSignal, output } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  pattern,
  required,
} from '@angular/forms/signals';
import type { RoomIdentity } from '@lms/contracts';
import { Button, Field, Input, Select } from '@lms/ui';

@Component({
  selector: 'app-room-join',
  imports: [Button, Field, FormField, FormRoot, Input, Select],
  templateUrl: './room-join.html',
  styleUrl: './room-join.scss',
})
export class RoomJoin {
  readonly defaultName = input('');
  readonly ready = input(false);
  readonly joined = output<RoomIdentity>();
  private readonly model = linkedSignal<RoomIdentity>(() => ({
    name: this.defaultName(),
    color: 'teal',
  }));
  protected readonly joinForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Hãy nhập tên hiển thị.' });
      pattern(path.name, /\S/, {
        message: 'Tên không được chỉ có khoảng trắng.',
      });
      maxLength(path.name, 24, { message: 'Tên tối đa 24 ký tự.' });
    },
    {
      submission: {
        action: async () => {
          if (this.ready())
            this.joined.emit({
              ...this.model(),
              name: this.model().name.trim(),
            });
        },
      },
    },
  );
}
