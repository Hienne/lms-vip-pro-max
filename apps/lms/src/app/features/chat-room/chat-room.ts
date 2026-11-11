import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Alert, Button, ErrorState, PageHeader, SectionCard } from '@lms/ui';
import { RoomCanvas } from './components/room-canvas/room-canvas';
import { RoomCaro } from './components/room-caro/room-caro';
import { RoomComposer } from './components/room-composer/room-composer';
import { RoomDice } from './components/room-dice/room-dice';
import { RoomJoin } from './components/room-join/room-join';
import { ChatRoomStore } from './data-access/chat-room.store';
import { RoomGamesStore } from './data-access/room-games.store';

@Component({
  selector: 'app-chat-room',
  imports: [
    Alert,
    Button,
    ErrorState,
    PageHeader,
    RoomCanvas,
    RoomCaro,
    RoomComposer,
    RoomDice,
    RoomJoin,
    SectionCard,
  ],
  providers: [ChatRoomStore, RoomGamesStore],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.scss',
  host: { '(window:keydown)': 'shortcut($event)' },
})
export class ChatRoom {
  protected readonly store = inject(ChatRoomStore);
  protected readonly games = inject(RoomGamesStore);
  private readonly composer = viewChild(RoomComposer);
  private readonly canvas = viewChild(RoomCanvas);
  private readonly gamePanel = viewChild<ElementRef<HTMLElement>>('gamePanel');
  private readonly chatLog = viewChild<ElementRef<HTMLElement>>('chatLog');
  private followChat = true;
  constructor() {
    afterRenderEffect(() =>
      this.gamePanel()?.nativeElement.focus({ preventScroll: true }),
    );
    afterRenderEffect(() => {
      const chatting = this.store.chatOpen$();
      const composer = this.composer();
      untracked(() => {
        if (chatting && composer) {
          composer.focus();
        }
      });
    });
    afterRenderEffect(() => {
      const log = this.chatLog()?.nativeElement;
      const messages = this.store.messages$();
      if (!log || messages.length === 0) this.followChat = true;
      if (log && this.followChat) log.scrollTop = log.scrollHeight;
    });
  }
  protected trackChatScroll(event: Event): void {
    const log = event.currentTarget as HTMLElement;
    this.followChat = log.scrollHeight - log.scrollTop - log.clientHeight < 16;
  }
  protected shortcut(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (this.games.panel$()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeGame();
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
    if (event.key === 'Escape' && this.store.self$()?.approaching) {
      event.preventDefault();
      this.store.cancelApproach();
      return;
    }
    if (event.key === 'Escape' && this.store.chatOpen$()) {
      event.preventDefault();
      this.closeChat();
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
  protected closeChat(): void {
    this.store.closeChat();
    this.canvas()?.focusRoom();
  }
  protected closeGame(): void {
    this.games.close();
    this.canvas()?.focusRoom();
  }
}
