import { Component, input, output, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  max,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import type { RoomDiceBet, RoomDiceSide, RoomDiceState } from '@lms/contracts';
import { Button, Field, Input, Select } from '@lms/ui';

@Component({
  selector: 'app-room-dice',
  imports: [Button, Field, FormField, FormRoot, Input, Select],
  templateUrl: './room-dice.html',
  styleUrl: './room-dice.scss',
})
export class RoomDice {
  readonly state = input.required<RoomDiceState>();
  readonly pending = input(false);
  readonly error = input('');
  readonly rolled = output<RoomDiceBet>();
  readonly closed = output<void>();
  protected readonly faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  private readonly bet = signal<{ side: RoomDiceSide; stake: number | null }>({
    side: 'big',
    stake: 10,
  });
  protected readonly betForm = form(
    this.bet,
    (path) => {
      required(path.stake, { message: 'Nhập số token muốn đặt.' });
      min(path.stake, 1, { message: 'Đặt ít nhất 1 token.' });
      max(path.stake, () => this.state().balance, {
        message: 'Số token đặt vượt số dư.',
      });
      validate(path.stake, ({ value }) => {
        const stake = value();
        return stake !== null && !Number.isSafeInteger(stake)
          ? { kind: 'integer', message: 'Nhập số token nguyên.' }
          : undefined;
      });
    },
    {
      submission: {
        action: async () => {
          const { side, stake } = this.bet();
          if (stake !== null && !this.pending())
            this.rolled.emit({ side, stake });
        },
      },
    },
  );
}
