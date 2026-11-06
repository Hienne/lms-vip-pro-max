import {
  afterRenderEffect,
  Component,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Alert, Button, ErrorState, PageHeader } from '@lms/ui';
import { RoomCanvas } from './components/room-canvas/room-canvas';
import { RoomComposer } from './components/room-composer/room-composer';
import { RoomJoin } from './components/room-join/room-join';
import { ChatRoomStore } from './data-access/chat-room.store';

@Component({
  selector: 'app-chat-room',
  imports: [
    Alert,
    Button,
    ErrorState,
    PageHeader,
    RoomCanvas,
    RoomComposer,
    RoomJoin,
  ],
  providers: [ChatRoomStore],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.scss',
  host: { '(window:keydown)': 'shortcut($event)' },
})
export class ChatRoom {
  protected readonly store = inject(ChatRoomStore);
  private readonly composer = viewChild(RoomComposer);
  private readonly canvas = viewChild(RoomCanvas);
  constructor() {
    afterRenderEffect(() => {
      const chatting = this.store.chatOpen$();
      const composer = this.composer();
      untracked(() => {
        if (chatting && composer) {
          if (document.pointerLockElement) document.exitPointerLock();
          composer.focus();
        }
      });
    });
  }
  protected shortcut(event: KeyboardEvent): void {
    if (event.isComposing || event.repeat) return;
    if (event.key === 'Escape' && document.pointerLockElement)
      document.exitPointerLock();
    if (event.key === 'Escape' && this.store.chatOpen$()) {
      event.preventDefault();
      this.store.closeChat();
      this.canvas()?.focusRoom();
    }
    if (
      event.key === 'Enter' &&
      this.store.online$() &&
      !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(
        (event.target as HTMLElement)?.tagName,
      )
    ) {
      event.preventDefault();
      this.store.openChat();
    }
  }
}
