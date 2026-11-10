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
import {
  ROOM_MAX_STAKE,
  type RoomDiceBet,
  type RoomDiceSide,
  type RoomDiceState,
} from '@lms/contracts';
import { Button, Field, Input, Select } from '@lms/ui';

@Component({
  selector: 'app-room-dice',
  imports: [Button, Field, FormField, FormRoot, Input, Select],
  templateUrl: './room-dice.html',
  styleUrl: './room-dice.scss',
})
export class RoomDice {
  readonly state = input<RoomDiceState | null>(null);
  readonly balance = input.required<number>();
  readonly seconds = input(0);
  readonly pending = input(false);
  readonly error = input('');
  readonly rolled = output<RoomDiceBet>();
  readonly closed = output<void>();
  protected readonly faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  protected readonly labels = { upper: 'Trên', lower: 'Dưới', triple: 'Bộ ba' };
  private readonly bet = signal<{ side: RoomDiceSide; stake: number | null }>({
    side: 'upper',
    stake: 10,
  });
  protected readonly betForm = form(
    this.bet,
    (path) => {
      required(path.stake, { message: 'Nhập số CPoint muốn đặt.' });
      min(path.stake, 1, { message: 'Đặt ít nhất 1 CPoint.' });
      max(path.stake, () => Math.min(this.balance(), ROOM_MAX_STAKE), {
        message: 'Số CPoint đặt vượt mức hiện có.',
      });
      validate(path.stake, ({ value }) => {
        const stake = value();
        return stake !== null && !Number.isSafeInteger(stake)
          ? { kind: 'integer', message: 'Nhập số CPoint nguyên.' }
          : undefined;
      });
    },
    {
      submission: {
        action: async () => {
          const { side, stake } = this.bet();
          if (stake !== null && !this.pending() && this.seconds())
            this.rolled.emit({ side, stake });
        },
      },
    },
  );
}
