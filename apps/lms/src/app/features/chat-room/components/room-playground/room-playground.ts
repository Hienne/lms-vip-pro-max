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
    ...(this.room.map$()?.caroTables ?? []).map((_, index) =>
      this.tableEntry(`caro:${index}`, `Caro ${index + 1}`),
    ),
    { kind: 'separator' },
    ...(this.room.map$()?.boardTables ?? []).map((table) =>
      this.tableEntry(table.id, table.name),
    ),
    { kind: 'separator' },
    {
      kind: 'item',
      value: 'dice',
      label: 'Trên/Dưới',
      disabled: this.games.balance$() === null,
    },
  ]);

  private tableEntry(id: string, name: string): MenuEntry {
    const status = this.games
      .boardTables$()
      .find((table) => table.id === id)?.status;
    return {
      kind: 'item',
      value: id,
      label: `${name} · ${status === 'playing' ? 'Đang chơi' : status === 'waiting' ? 'Chờ bạn chơi' : 'Trống'}`,
    };
  }
}
