import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  form,
  FormRoot,
  FormField,
  required,
  min,
  max,
} from '@angular/forms/signals';
import { Button, Field, Icon, IconButton, Input, SectionCard } from '@lms/ui';
import { ChatRoomStore } from '../../data-access/chat-room.store';
import { RoomMediaStore } from '../../data-access/room-media.store';

@Component({
  selector: 'app-room-screen',
  imports: [
    Button,
    Field,
    Icon,
    IconButton,
    Input,
    SectionCard,
    FormRoot,
    FormField,
  ],
  templateUrl: './room-screen.html',
  styleUrl: './room-screen.scss',
})
export class RoomScreen {
  protected readonly room = inject(ChatRoomStore);
  protected readonly media = inject(RoomMediaStore);
  readonly surfaceReady = output<HTMLElement | null>();
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private readonly link = signal({ url: '' });
  protected readonly linkForm = form(this.link, (path) => required(path.url), {
    submission: {
      action: async () => this.media.startYouTube(this.link().url),
    },
  });
  private readonly seek = signal<{ seconds: number | null }>({ seconds: 0 });
  protected readonly seekForm = form(
    this.seek,
    (path) => {
      required(path.seconds);
      min(path.seconds, 0);
      max(path.seconds, 864000);
    },
    {
      submission: {
        action: async () => {
          const seconds = this.seek().seconds;
          if (seconds !== null)
            this.media.control(this.media.meta$()?.paused ?? false, seconds);
        },
      },
    },
  );
  constructor() {
    afterRenderEffect(() => {
      if (
        this.media.meta$()?.source === 'idle' &&
        document.fullscreenElement === this.surface()?.nativeElement
      )
        void document.exitFullscreen().catch(() => undefined);
    });
    afterRenderEffect((onCleanup) => {
      const surface = this.surface()?.nativeElement;
      if (surface) {
        untracked(() => this.surfaceReady.emit(surface));
        onCleanup(() => this.surfaceReady.emit(null));
      }
    });
    afterRenderEffect(() => {
      const content = this.content()?.nativeElement,
        element = this.media.element$();
      if (content && content.firstElementChild !== element) {
        content.replaceChildren(...(element ? [element] : []));
      }
    });
  }
  protected fileChanged(event: Event): void {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (file) void this.media.shareFile(file);
    input.value = '';
  }
  protected async fullscreen(): Promise<void> {
    const element = this.surface()?.nativeElement;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (element?.requestFullscreen) await element.requestFullscreen();
      else {
        const video = this.media.element$() as
          | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
          | null;
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else
          this.media.failed(
            'Trình duyệt chưa hỗ trợ toàn màn hình ở chế độ này.',
          );
      }
    } catch {
      this.media.failed('Không mở được toàn màn hình. Hãy thử bấm lại.');
    }
  }
}
