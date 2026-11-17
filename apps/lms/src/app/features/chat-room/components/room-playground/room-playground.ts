import { Component, computed, inject } from '@angular/core';
import { Button } from '@lms/ui';
import { ChatRoomStore } from '../../data-access/chat-room.store';
import { RoomGamesStore } from '../../data-access/room-games.store';
import { inRoomArea } from '../../data-access/chat-room.model';

@Component({
  selector: 'app-room-playground',
  imports: [Button],
  templateUrl: './room-playground.html',
  styleUrl: './room-playground.scss',
})
export class RoomPlayground {
  protected readonly room = inject(ChatRoomStore);
  protected readonly games = inject(RoomGamesStore);
  protected readonly tables = computed(
    () => this.room.map$()?.boardTables ?? [],
  );
  protected readonly nearFloor = computed(() => {
    const self = this.room.self$();
    return (
      self &&
      self.seat === undefined &&
      inRoomArea(this.room.map$()?.colorFloor, self.x, self.y)
    );
  });
  protected readonly target = computed(() =>
    this.room
      .map$()
      ?.colorTiles.find((tile) => tile.color === this.games.floor$()?.target),
  );
  protected status(id: string): string {
    const status = this.games
      .boardTables$()
      .find((table) => table.id === id)?.status;
    return status === 'playing'
      ? 'Đang chơi'
      : status === 'waiting'
        ? 'Chờ bạn chơi'
        : 'Trống';
  }
}
