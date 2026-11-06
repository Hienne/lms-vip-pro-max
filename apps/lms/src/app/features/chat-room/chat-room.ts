import { DatePipe } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Alert, Button, ErrorState, PageHeader, Tabs, TabPanel } from '@lms/ui';
import { RoomCanvas } from './components/room-canvas/room-canvas';
import { RoomComposer } from './components/room-composer/room-composer';
import { RoomJoin } from './components/room-join/room-join';
import { ChatRoomStore } from './data-access/chat-room.store';

@Component({
  selector: 'app-chat-room',
  imports: [
    Alert,
    Button,
    DatePipe,
    ErrorState,
    PageHeader,
    RoomCanvas,
    RoomComposer,
    RoomJoin,
    Tabs,
    TabPanel,
  ],
  providers: [ChatRoomStore],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.scss',
  host: { '(window:keydown)': 'shortcut($event)' },
})
export class ChatRoom {
  protected readonly store = inject(ChatRoomStore);
  private readonly composer = viewChild(RoomComposer);
  private readonly messages = viewChild<ElementRef<HTMLDivElement>>('messages');
  constructor() {
    afterRenderEffect(() => {
      this.store.chats$();
      const messages = this.messages();
      untracked(() => {
        if (messages)
          messages.nativeElement.scrollTop =
            messages.nativeElement.scrollHeight;
      });
    });
  }
  protected shortcut(event: KeyboardEvent): void {
    if (event.key === 'Escape') (document.activeElement as HTMLElement)?.blur();
    if (
      event.key === 'Enter' &&
      this.store.online$() &&
      !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(
        (event.target as HTMLElement)?.tagName,
      )
    ) {
      event.preventDefault();
      this.composer()?.focus();
    }
  }
}
