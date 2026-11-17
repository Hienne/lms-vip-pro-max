import { Component, computed, inject } from '@angular/core';
import { Menu, type MenuEntry } from '@lms/ui';
import { ChatRoomStore } from '../../data-access/chat-room.store';
import { RoomGamesStore } from '../../data-access/room-games.store';

@Component({
  selector: 'app-room-playground',
  imports: [Menu],
  templateUrl: './room-playground.html',
  styleUrl: './room-playground.scss',
})
export class RoomPlayground {
  protected readonly room = inject(ChatRoomStore);
  private readonly games = inject(RoomGamesStore);
  protected readonly entries = computed<readonly MenuEntry[]>(() => [
    { kind: 'label', label: 'Caro' },
    ...(this.room.map$()?.caroTables ?? []).map((_, index) => ({
      kind: 'item' as const,
      value: `caro:${index}`,
      label: `Caro ${index + 1}`,
    })),
    { kind: 'separator' },
    ...(this.room.map$()?.boardTables ?? []).map((table) => {
      const status = this.games
        .boardTables$()
        .find((state) => state.id === table.id)?.status;
      return {
        kind: 'item' as const,
        value: table.id,
        label: `${table.name} · ${status === 'playing' ? 'Đang chơi' : status === 'waiting' ? 'Chờ bạn chơi' : 'Trống'}`,
      };
    }),
    { kind: 'separator' },
    {
      kind: 'item',
      value: 'dice',
      label: 'Trên/Dưới',
      disabled: this.games.balance$() === null,
    },
  ]);
}
