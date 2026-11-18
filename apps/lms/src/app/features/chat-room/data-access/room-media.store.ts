import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type { RoomCommand, RoomEvent, RoomMediaState } from '@lms/contracts';

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};
type Peer = {
  pc: RTCPeerConnection;
  connection: string;
  ice: RTCIceCandidateInit[];
};
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(position: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
interface YouTubeAPI {
  Player: new (element: HTMLElement, options: object) => YouTubePlayer;
}
let youtubeLoader: Promise<YouTubeAPI> | undefined;
function youtubeAPI(): Promise<YouTubeAPI> {
  const runtime = window as unknown as {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (runtime.YT?.Player) return Promise.resolve(runtime.YT);
  return (youtubeLoader ??= new Promise((resolve, reject) => {
    const previous = runtime.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => {
      youtubeLoader = undefined;
      script.remove();
      runtime.onYouTubeIframeAPIReady = previous;
      reject(
        new Error(
          'YouTube chưa phản hồi. Bấm Kết nối lại màn hình để thử lại.',
        ),
      );
    }, 15000);
    runtime.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      if (runtime.YT) resolve(runtime.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      clearTimeout(timeout);
      youtubeLoader = undefined;
      script.remove();
      reject(new Error('Không tải được trình phát YouTube.'));
    };
    document.head.append(script);
  }));
}

@Injectable()
export class RoomMediaStore {
  // Socket state and native media resources live only for this room connection.
  private readonly state = {
    meta: signal<RoomMediaState | null>(null),
    me: signal(''),
    element: signal<HTMLElement | null>(null),
    error: signal(''),
    busy: signal(false),
    controls: signal(false),
  };
  readonly meta$ = this.state.meta.asReadonly();
  readonly element$ = this.state.element.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly busy$ = this.state.busy.asReadonly();
  readonly controls$ = this.state.controls.asReadonly();
  readonly controller$ = computed(
    () =>
      !!this.meta$()?.controller &&
      this.meta$()?.controller === this.state.me(),
  );
  private send?: (command: RoomCommand) => void;
  private peers = new Map<string, Peer>();
  private stream?: MediaStream;
  private local?: HTMLVideoElement;
  private blobUrl?: string;
  private frameCanvas?: HTMLCanvasElement;
  private imagePaint?: ReturnType<typeof setInterval>;
  private youtube?: YouTubePlayer;
  private youtubeId = '';
  private sourceId = '';
  private generation = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private youtubeReady = false;
  private youtubeAnchored = false;
  private youtubeAnchorTimer?: ReturnType<typeof setTimeout>;
  private signalQueue: RoomCommand[] = [];
  private signalPump?: ReturnType<typeof setInterval>;
  private syncTimer?: ReturnType<typeof setInterval>;
  private offset = 0;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset());
  }
  connect(send: (command: RoomCommand) => void): void {
    this.send = send;
  }
  identify(id: string): void {
    this.setMe(id);
  }
  private setMe(value: string): void {
    this.state.me.set(value);
  }
  private setMeta(value: RoomMediaState | null): void {
    this.state.meta.set(value);
  }
  failed(message: string): void {
    this.setError(message);
  }
  setControls(value: boolean): void {
    this.state.controls.set(value);
  }
  private setElement(element: HTMLElement | null): void {
    if (element)
      Object.assign(element.style, {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      });
    this.state.element.set(element);
  }
  private setError(message: string): void {
    this.state.error.set(message);
  }
  private setBusy(value: boolean): void {
    this.state.busy.set(value);
  }
  startYouTube(link: string): void {
    if (!this.controller$()) return;
    try {
      const url = new URL(link);
      const hostname = url.hostname.toLowerCase();
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      let id = '';
      if (hostname === 'youtu.be') id = url.pathname.slice(1);
      else if (
        [
          'youtube.com',
          'www.youtube.com',
          'm.youtube.com',
          'www.youtube-nocookie.com',
        ].includes(hostname)
      )
        id =
          url.pathname === '/watch'
            ? (url.searchParams.get('v') ?? '')
            : (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ??
              '');
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error();
      this.stop();
      this.setError('');
      this.send?.({
        type: 'media-start',
        id: crypto.randomUUID(),
        source: 'youtube',
        videoId: id,
        title: 'YouTube',
      });
    } catch {
      this.setError('Nhập link video YouTube hợp lệ.');
    }
  }
  async shareFile(file: File): Promise<void> {
    if (!this.controller$() || this.busy$()) return;
    const image = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ].includes(file.type);
    if (!image && !file.type.startsWith('video/')) {
      this.setError('Chọn video hoặc ảnh JPG, PNG, WebP, GIF.');
      return;
    }
    if (image && file.size > 20_000_000) {
      this.setError('Chọn ảnh nhỏ hơn 20 MB.');
      return;
    }
    this.stop();
    this.setBusy(true);
    this.setError('');
    const generation = this.generation;
    let stream: MediaStream | undefined;
    let video: HTMLVideoElement | undefined;
    let url: string | undefined;
    let canvas: HTMLCanvasElement | undefined;
    try {
      if (image) {
        const bitmap = await createImageBitmap(file, {
          resizeWidth: 1920,
          resizeQuality: 'high',
        });
        canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const context = canvas.getContext('2d');
        if (!context) {
          bitmap.close();
          throw new Error('Không mở được ảnh.');
        }
        context.fillStyle = '#000000';
        context.fillRect(0, 0, 1920, 1080);
        const ratio = Math.min(
          canvas.width / bitmap.width,
          canvas.height / bitmap.height,
        );
        context.drawImage(
          bitmap,
          (1920 - bitmap.width * ratio) / 2,
          (1080 - bitmap.height * ratio) / 2,
          bitmap.width * ratio,
          bitmap.height * ratio,
        );
        bitmap.close();
        stream = canvas.captureStream(1);
      } else {
        video = document.createElement('video') as CapturableVideo;
        video.playsInline = true;
        video.muted = true;
        video.controls = true;
        video.preload = 'metadata';
        url = URL.createObjectURL(file);
        video.src = url;
        this.local = video;
        this.blobUrl = url;
        await video.play();
        const capturable = video as CapturableVideo;
        const capture = capturable.captureStream ?? capturable.mozCaptureStream;
        if (!capture)
          throw new Error(
            'Trình duyệt chưa phát trực tiếp tệp này. Hãy dùng Chia sẻ màn hình.',
          );
        stream = capture.call(video);
        if (!stream.getVideoTracks().length)
          throw new Error('Không đọc được video. Hãy thử MP4 hoặc WebM khác.');
      }
      if (generation !== this.generation || !this.controller$()) {
        stream?.getTracks().forEach((track) => track.stop());
        video?.pause();
        if (url) URL.revokeObjectURL(url);
        return;
      }
      this.stream = stream;
      this.local = video;
      this.blobUrl = url;
      this.frameCanvas = canvas;
      if (canvas) {
        const paint = canvas,
          context = paint.getContext('2d');
        if (context)
          this.imagePaint = setInterval(
            () => context.drawImage(paint, 0, 0),
            1000,
          );
      }
      this.sourceId = crypto.randomUUID();
      this.setElement(video ?? this.frameCanvas ?? null);
      if (video) video.onended = () => this.stop();
      this.send?.({
        type: 'media-start',
        id: this.sourceId,
        source: image ? 'image' : 'video',
        title: file.name.slice(0, 100),
      });
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      video?.pause();
      if (url) URL.revokeObjectURL(url);
      if (generation === this.generation)
        this.setError(
          error instanceof Error ? error.message : 'Không phát được tệp.',
        );
    } finally {
      if (generation === this.generation) this.setBusy(false);
    }
  }
  async shareScreen(): Promise<void> {
    if (!this.controller$() || this.busy$()) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.setError('Chia sẻ màn hình cần HTTPS và trình duyệt hỗ trợ.');
      return;
    }
    this.stop();
    this.setBusy(true);
    this.setError('');
    const generation = this.generation;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 25 },
        audio: true,
      });
      if (generation !== this.generation || !this.controller$()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.sourceId = crypto.randomUUID();
      const video = this.makeVideo(stream, true);
      this.setElement(video);
      stream.getVideoTracks()[0].onended = () => this.stop();
      this.send?.({
        type: 'media-start',
        id: this.sourceId,
        source: 'screen',
        title: 'Chia sẻ màn hình',
      });
    } catch (error) {
      if (
        generation === this.generation &&
        !(error instanceof DOMException && error.name === 'NotAllowedError')
      )
        this.setError('Không bắt đầu được chia sẻ màn hình.');
    } finally {
      if (generation === this.generation) this.setBusy(false);
    }
  }
  private makeVideo(stream: MediaStream, muted: boolean): HTMLVideoElement {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = muted;
    video.srcObject = stream;
    void video.play().catch(() => {
      if (this.element$() === video)
        this.setError('Bấm Bật âm thanh để bắt đầu xem.');
    });
    return video;
  }
  enableSound(): void {
    const element = this.element$();
    if (element instanceof HTMLVideoElement) {
      element.muted = false;
      void element
        .play()
        .catch(() => this.setError('Bấm nút phát của trình duyệt để xem.'));
    }
    if (this.youtubeReady) {
      this.youtube?.unMute();
      if (!this.meta$()?.paused) this.youtube?.playVideo();
    }
  }
  control(paused: boolean, position?: number): void {
    const meta = this.meta$();
    if (!meta || !this.controller$()) return;
    if (meta.source === 'youtube')
      this.send?.({
        type: 'media-control',
        id: meta.id,
        paused,
        position: Math.max(
          0,
          position ??
            (this.youtubeReady
              ? this.youtube?.getCurrentTime()
              : this.meta$()?.position) ??
            0,
        ),
      });
    else if (this.local) {
      if (paused) this.local.pause();
      else
        void this.local
          .play()
          .catch(() => this.setError('Không tiếp tục được video.'));
    }
  }
  stop(): void {
    if (this.controller$()) this.send?.({ type: 'media-stop' });
    this.generation++;
    this.releaseLocal();
    this.closePeers();
    this.clearYoutube();
    this.setBusy(false);
    this.setElement(null);
  }
  reset(): void {
    this.generation++;
    this.releaseLocal();
    this.closePeers();
    this.clearYoutube();
    clearTimeout(this.retry);
    this.setMeta(null);
    this.setMe('');
    this.setElement(null);
    this.setBusy(false);
    this.setError('');
    this.setControls(false);
  }
  private releaseLocal(): void {
    clearInterval(this.imagePaint);
    this.local?.pause();
    if (this.local) {
      this.local.onended = null;
      this.local.removeAttribute('src');
      this.local.load();
    }
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.local = undefined;
    this.stream = undefined;
    this.blobUrl = undefined;
    this.frameCanvas = undefined;
    this.sourceId = '';
  }
  private clearYoutube(): void {
    try {
      this.youtube?.destroy();
    } catch {
      /* The iframe can be detached during route teardown. */
    }
    this.youtube = undefined;
    this.youtubeReady = false;
    this.youtubeAnchored = false;
    clearTimeout(this.youtubeAnchorTimer);
    this.youtubeId = '';
    clearInterval(this.syncTimer);
  }
  private closePeers(): void {
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear();
    clearTimeout(this.retry);
    clearInterval(this.signalPump);
    this.signalPump = undefined;
    this.signalQueue = [];
  }
  receive(event: RoomEvent): void {
    if (event.type === 'media-state') {
      const previous = this.meta$();
      this.offset = event.serverTime - Date.now();
      this.setMeta(event);
      if (this.controller$() && previous?.controller !== event.controller)
        this.setControls(true);
      if (previous?.id !== event.id) this.closePeers();
      if (
        !this.controller$() &&
        (this.stream || previous?.controller === this.state.me())
      ) {
        this.generation++;
        this.releaseLocal();
        this.setBusy(false);
      }
      if (event.source === 'youtube') {
        if (this.youtubeId !== event.id) {
          this.clearYoutube();
          this.setElement(null);
          this.youtubeId = event.id;
          void this.loadYoutube(event);
        } else this.syncYoutube();
      } else {
        this.clearYoutube();
        if (event.source === 'idle') {
          if (
            !this.busy$() &&
            (!this.sourceId ||
              previous?.id === this.sourceId ||
              !this.controller$())
          ) {
            this.releaseLocal();
            this.setElement(null);
          }
        } else if (!this.controller$() && previous?.id !== event.id)
          this.watch();
      }
    } else if (
      event.type === 'media-peer' &&
      this.controller$() &&
      event.id === this.meta$()?.id &&
      this.stream
    ) {
      void this.offer(event.peer, event.connection).catch(() =>
        this.setError('Không kết nối được với một người xem.'),
      );
    } else if (event.type === 'media-signal' && event.id === this.meta$()?.id) {
      void this.signal(event).catch(() =>
        this.setError('Kết nối phát bị gián đoạn. Bấm Kết nối lại màn hình.'),
      );
    } else if (event.type === 'media-error') {
      this.setError(event.message);
      this.setBusy(false);
    }
  }
  left(id: string): void {
    const peer = this.peers.get(id);
    peer?.pc.close();
    this.peers.delete(id);
  }
  watch(): void {
    const meta = this.meta$();
    if (meta?.source === 'youtube') {
      this.setError('');
      this.clearYoutube();
      this.setElement(null);
      this.youtubeId = meta.id;
      void this.loadYoutube(meta);
      return;
    }
    if (
      !meta ||
      this.controller$() ||
      ['idle', 'youtube'].includes(meta.source)
    )
      return;
    this.closePeers();
    this.setError('');
    this.setElement(null);
    const connection = crypto.randomUUID();
    try {
      this.peer(meta.controller, connection);
    } catch {
      this.setError(
        'Không khởi tạo được kết nối phát. Kiểm tra trình duyệt hoặc cấu hình ICE/TURN.',
      );
      return;
    }
    this.send?.({ type: 'media-watch', id: meta.id, connection });
    this.retry = setTimeout(() => {
      const video = this.element$();
      if (!(video instanceof HTMLVideoElement) || !video.videoWidth)
        this.setError(
          'Chưa nhận được hình. Thử kết nối lại; mạng có thể cần máy chủ TURN.',
        );
    }, 15000);
  }
  private peer(id: string, connection: string): Peer {
    this.peers.get(id)?.pc.close();
    const pc = new RTCPeerConnection({
      iceServers: this.meta$()?.iceServers ?? [],
    });
    const peer = { pc, connection, ice: [] as RTCIceCandidateInit[] };
    this.peers.set(id, peer);
    pc.onicecandidate = (event) => {
      if (event.candidate)
        this.sendSignal(
          id,
          peer,
          'ice',
          JSON.stringify(event.candidate.toJSON()),
        );
    };
    pc.ontrack = (event) => {
      if (this.controller$() || this.peers.get(id) !== peer) return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const current = this.element$();
      if (current instanceof HTMLVideoElement && current.srcObject === stream)
        return;
      const video = this.makeVideo(stream, true);
      video.onloadeddata = video.onresize = () => {
        if (video.videoWidth && this.peers.get(id) === peer) {
          clearTimeout(this.retry);
          this.setError('');
        }
      };
      this.setElement(video);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed')
        this.setError(
          'Không truyền được hình qua mạng hiện tại. Thử lại hoặc cấu hình TURN.',
        );
    };
    return peer;
  }
  private sendSignal(
    to: string,
    peer: Peer,
    kind: 'offer' | 'answer' | 'ice',
    payload: string,
  ): void {
    const meta = this.meta$();
    if (!meta || this.peers.get(to) !== peer) return;
    this.signalQueue.push({
      type: 'media-signal',
      to,
      id: meta.id,
      connection: peer.connection,
      kind,
      payload,
    });
    this.signalPump ??= setInterval(() => {
      const command = this.signalQueue.shift();
      if (
        command?.type === 'media-signal' &&
        command.id === this.meta$()?.id &&
        this.peers.get(command.to)?.connection === command.connection
      )
        this.send?.(command);
      if (!this.signalQueue.length) {
        clearInterval(this.signalPump);
        this.signalPump = undefined;
      }
    }, 50);
  }
  private async offer(id: string, connection: string): Promise<void> {
    const stream = this.stream;
    if (!stream) return;
    const peer = this.peer(id, connection);
    for (const track of stream.getTracks()) peer.pc.addTrack(track, stream);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.sendSignal(id, peer, 'offer', offer.sdp ?? '');
  }
  private async signal(
    event: Extract<RoomEvent, { type: 'media-signal' }>,
  ): Promise<void> {
    const peer = this.peers.get(event.from);
    if (!peer || peer.connection !== event.connection) return;
    if (event.kind === 'ice') {
      const ice = JSON.parse(event.payload) as RTCIceCandidateInit;
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(ice);
      else peer.ice.push(ice);
      return;
    }
    await peer.pc.setRemoteDescription({
      type: event.kind,
      sdp: event.payload,
    });
    for (const ice of peer.ice) await peer.pc.addIceCandidate(ice);
    peer.ice = [];
    if (event.kind === 'offer') {
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.sendSignal(event.from, peer, 'answer', answer.sdp ?? '');
    }
  }
  private async loadYoutube(meta: RoomMediaState): Promise<void> {
    try {
      const api = await youtubeAPI();
      if (this.meta$()?.id !== meta.id || this.meta$()?.source !== 'youtube')
        return;
      const holder = document.createElement('div');
      const player = document.createElement('div');
      holder.append(player);
      this.setElement(holder);
      this.youtube = new api.Player(player, {
        width: '100%',
        height: '100%',
        videoId: meta.videoId,
        playerVars: {
          playsinline: 1,
          controls: 0,
          autoplay: 0,
          origin: location.origin,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (this.meta$()?.id !== meta.id) return;
            this.youtubeReady = true;
            this.youtube?.mute();
            this.syncYoutube();
            this.syncTimer = setInterval(() => this.syncYoutube(), 1500);
          },
          onError: (event: { data: number }) =>
            this.meta$()?.id === meta.id &&
            this.setError(
              'YouTube không phát được video này (mã ' +
                event.data +
                '). Thử video cho phép nhúng hoặc báo người quản trị.',
            ),
          onAutoplayBlocked: () => {
            if (this.meta$()?.id === meta.id)
              this.setError('Bấm Bật âm thanh để bắt đầu xem.');
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === 1 && this.meta$()?.id === meta.id)
              this.setError('');
            if (
              event.data !== 1 ||
              !this.controller$() ||
              this.youtubeAnchored ||
              this.meta$()?.id !== meta.id
            )
              return;
            this.youtubeAnchored = true;
            this.youtubeAnchorTimer = setTimeout(
              () => {
                if (this.meta$()?.id === meta.id)
                  this.control(
                    this.meta$()?.paused ?? false,
                    this.youtube?.getCurrentTime() ?? 0,
                  );
              },
              Math.max(
                0,
                110 -
                  (Date.now() + this.offset - (this.meta$()?.updatedAt ?? 0)),
              ),
            );
          },
        },
      });
    } catch (error) {
      if (this.meta$()?.id === meta.id)
        this.setError(
          error instanceof Error ? error.message : 'Không tải được YouTube.',
        );
    }
  }
  private syncYoutube(): void {
    const meta = this.meta$();
    if (
      !meta ||
      meta.source !== 'youtube' ||
      !this.youtube ||
      !this.youtubeReady
    )
      return;
    const position =
      meta.position +
      (meta.paused
        ? 0
        : Math.max(0, (Date.now() + this.offset - meta.updatedAt) / 1000));
    try {
      if (
        (!this.controller$() || this.youtubeAnchored || meta.position > 0) &&
        Math.abs(this.youtube.getCurrentTime() - position) > 2
      )
        this.youtube.seekTo(position, true);
      if (meta.paused) this.youtube.pauseVideo();
      else this.youtube.playVideo();
    } catch {
      /* The iframe may still be initializing. */
    }
  }
}
