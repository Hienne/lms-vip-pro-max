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
import { RoomDice } from './components/room-dice/room-dice';
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
    RoomDice,
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
          composer.focus();
        }
      });
    });
  }
  protected shortcut(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (this.store.diceOpen$()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeDice();
      }
      return;
    }
    const target = event.target as HTMLElement;
    if (
      event.code === 'Space' &&
      this.store.gesturesEnabled$() &&
      !this.store.chatOpen$() &&
      (target === document.body || target?.classList?.contains('room-canvas'))
    ) {
      event.preventDefault();
      if (!event.repeat) this.store.performGesture('jump');
      return;
    }
    if (event.repeat) return;
    if (event.key === 'Escape' && this.store.chatOpen$()) {
      event.preventDefault();
      this.store.closeChat();
      this.canvas()?.focusRoom();
    }
    if (
      event.key === 'Enter' &&
      this.store.online$() &&
      !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target?.tagName)
    ) {
      event.preventDefault();
      this.store.openChat();
    }
  }
  protected closeDice(): void {
    this.store.closeDice();
    this.canvas()?.focusRoom();
  }
}
