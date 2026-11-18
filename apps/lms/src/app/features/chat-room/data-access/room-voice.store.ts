import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type { RoomCommand, RoomEvent } from '@lms/contracts';

const VOICE_RATE = 16_000;
const LOG_MU = Math.log(256);
type IncomingFrame = Extract<RoomEvent, { type: 'voice-frame' }>;

@Injectable()
export class RoomVoiceStore {
  private readonly state = {
    available: signal(false),
    listening: signal(false),
    paused: signal(false),
    micReady: signal(false),
    preparingMic: signal(false),
    phase: signal<'idle' | 'permission' | 'talking'>('idle'),
    error: signal(''),
    speakers: signal<Record<string, string>>({}),
  };
  readonly available$ = this.state.available.asReadonly();
  readonly listening$ = this.state.listening.asReadonly();
  readonly paused$ = this.state.paused.asReadonly();
  readonly micReady$ = this.state.micReady.asReadonly();
  readonly preparingMic$ = this.state.preparingMic.asReadonly();
  readonly phase$ = this.state.phase.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly speakers$ = computed(() => Object.values(this.state.speakers()));

  private send?: (command: RoomCommand) => void;
  private wantsListening = false;
  private context?: AudioContext;
  private captureModule?: Promise<void>;
  private press?: string;
  private announced = false;
  private stream?: MediaStream;
  private input?: MediaStreamAudioSourceNode;
  private capture?: AudioWorkletNode;
  private timings = new Map<string, { id: string; next: number }>();
  private playing = new Set<AudioBufferSourceNode>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  connect(send: (command: RoomCommand) => void): void {
    this.send = send;
  }

  startListeningByDefault(): void {
    this.wantsListening = true;
    void this.resumeAudio();
  }

  enablePlayback(): void {
    if (this.available$()) this.startListeningByDefault();
  }

  private async resumeAudio(): Promise<void> {
    if (typeof AudioContext === 'undefined') return;
    try {
      const context = (this.context ??= new AudioContext());
      context.onstatechange = () => {
        if (this.context !== context) return;
        const paused = context.state !== 'running';
        this.state.paused.set(paused);
        if (paused) {
          if (this.announced) this.release();
          this.stopPlayback();
        } else {
          this.subscribeToVoice();
        }
      };
      // Start within the join gesture, before the ticket or socket handshake.
      await context.resume();
      if (this.context !== context) return;
      if (this.available$()) this.state.error.set('');
      this.state.paused.set(false);
      this.subscribeToVoice();
    } catch {
      if (this.available$())
        this.state.error.set('Không bật được âm thanh thoại. Bấm lại để thử.');
    }
  }

  disablePlayback(): void {
    this.wantsListening = false;
    this.closeAudio();
    this.send?.({ type: 'voice-listen', enabled: false });
  }

  private subscribeToVoice(): void {
    if (
      !this.wantsListening ||
      !this.available$() ||
      this.listening$() ||
      this.context?.state !== 'running'
    )
      return;
    this.state.listening.set(true);
    this.send?.({ type: 'voice-listen', enabled: true });
  }

  async prepareMicrophone(): Promise<void> {
    const context = this.context;
    if (!this.listening$() || this.preparingMic$()) return;
    this.state.preparingMic.set(true);
    this.state.error.set('');
    try {
      const stream = await this.openMicrophone();
      stream.getTracks().forEach((track) => track.stop());
      if (this.context === context) this.state.micReady.set(true);
    } catch (error) {
      if (this.context === context) this.microphoneError(error);
    } finally {
      if (this.context === context) this.state.preparingMic.set(false);
    }
  }

  async pressToTalk(): Promise<void> {
    const context = this.context;
    if (
      !this.listening$() ||
      !context ||
      this.paused$() ||
      this.press ||
      this.preparingMic$()
    )
      return;
    this.state.error.set('');
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !globalThis.crypto?.randomUUID
    ) {
      this.state.error.set('Thoại cần HTTPS và trình duyệt hỗ trợ micrô.');
      return;
    }

    const id = crypto.randomUUID();
    this.press = id;
    this.state.phase.set('permission');
    let stream: MediaStream;
    try {
      stream = await this.openMicrophone();
    } catch (error) {
      if (this.press === id) {
        this.release();
        this.microphoneError(error);
      }
      return;
    }
    if (this.context === context) this.state.micReady.set(true);
    if (this.press !== id) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    this.stream = stream;
    for (const track of stream.getAudioTracks())
      track.onended = () => this.release();
    try {
      this.captureModule ??= context.audioWorklet
        .addModule(new URL('voice-capture.js', document.baseURI).href)
        .catch((error: unknown) => {
          if (this.context === context) this.captureModule = undefined;
          throw error;
        });
      await this.captureModule;
      if (this.press !== id) return;
      // A system audio interruption can suspend the context even after the user enabled listening.
      if (context.state !== 'running') {
        this.release();
        this.state.error.set(
          'Âm thanh đang tạm ngắt. Bấm Tắt thoại rồi Bật âm thanh thoại lại.',
        );
        return;
      }

      this.input = context.createMediaStreamSource(stream);
      this.capture = new AudioWorkletNode(context, 'room-voice-capture');
      this.capture.port.onmessage = ({
        data,
      }: MessageEvent<{ frame: Uint8Array; time: number }>) => {
        if (this.press !== id || context.currentTime - data.time > 0.25) return;
        if (!this.announced) {
          this.announced = true;
          this.send?.({ type: 'voice-talk', id });
          this.state.phase.set('talking');
        }
        this.send?.({
          type: 'voice-frame',
          id,
          data: btoa(String.fromCharCode(...data.frame)),
        });
      };
      this.input.connect(this.capture);
      this.capture.connect(context.destination);
    } catch {
      if (this.press === id) {
        this.release();
        this.state.error.set(
          'Không thu được âm thanh. Thử mở phòng bằng Chrome hoặc Safari.',
        );
      }
    }
  }

  release(): void {
    this.press = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.input?.disconnect();
    this.input = undefined;
    this.capture?.disconnect();
    this.capture?.port.close();
    this.capture = undefined;
    if (this.announced) this.send?.({ type: 'voice-talk', id: null });
    this.announced = false;
    this.state.phase.set('idle');
  }

  receive(event: RoomEvent): void {
    switch (event.type) {
      case 'voice-ready':
        this.state.available.set(
          !!event.relay && typeof AudioContext !== 'undefined',
        );
        if (!this.available$()) {
          this.state.error.set(
            event.relay
              ? 'Trình duyệt này chưa phát được âm thanh thoại.'
              : 'Máy chủ chưa hỗ trợ phiên bản thoại này.',
          );
        }
        this.subscribeToVoice();
        break;
      case 'voice-frame':
        this.play(event);
        break;
      case 'voice-state':
        if (!event.id) this.left(event.speaker);
        break;
      case 'voice-issue':
        this.release();
        this.state.error.set(event.message);
        break;
    }
  }

  left(id: string): void {
    this.timings.delete(id);
    this.state.speakers.update((speakers) => {
      if (!(id in speakers)) return speakers;
      const remaining = { ...speakers };
      delete remaining[id];
      return remaining;
    });
  }

  disconnect(): void {
    this.release();
    this.stopPlayback();
    this.state.listening.set(false);
    this.state.available.set(false);
    this.state.error.set('');
  }

  reset(): void {
    this.wantsListening = false;
    this.closeAudio();
    this.state.available.set(false);
    this.state.micReady.set(false);
  }

  private closeAudio(): void {
    this.release();
    this.stopPlayback();
    this.state.listening.set(false);
    this.state.paused.set(false);
    this.state.preparingMic.set(false);
    this.state.error.set('');
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.captureModule = undefined;
  }

  private stopPlayback(): void {
    for (const source of this.playing) source.stop();
    this.playing.clear();
    this.timings.clear();
    this.state.speakers.set({});
  }

  private openMicrophone(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
  }

  private microphoneError(error: unknown): void {
    this.state.micReady.set(false);
    const denied =
      error instanceof DOMException && error.name === 'NotAllowedError';
    this.state.error.set(
      denied
        ? 'Micrô chưa được cấp quyền. Kiểm tra quyền của trang rồi bấm Cho phép micrô.'
        : 'Không mở được micrô. Kiểm tra thiết bị và quyền micrô rồi thử lại.',
    );
  }

  private play(event: IncomingFrame): void {
    const context = this.context;
    if (!this.listening$() || context?.state !== 'running') return;
    const now = context.currentTime;
    const previous = this.timings.get(event.speaker);
    const next = previous?.id === event.id ? previous.next : 0;
    // Drop delayed frames rather than let a congested socket build up an audio queue.
    if (next > now + 0.24) return;
    const bytes = atob(event.data);
    const buffer = context.createBuffer(1, bytes.length, VOICE_RATE);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const code = (bytes.charCodeAt(i) - 128) / 127;
      samples[i] =
        (Math.sign(code) * Math.expm1(Math.abs(code) * LOG_MU)) / 255;
    }

    const start = next < now ? now + 0.07 : next;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      this.playing.delete(source);
    };
    this.playing.add(source);
    source.start(start);
    this.timings.set(event.speaker, {
      id: event.id,
      next: start + buffer.duration,
    });
    if (this.state.speakers()[event.speaker] !== event.name) {
      this.state.speakers.update((speakers) => ({
        ...speakers,
        [event.speaker]: event.name,
      }));
    }
  }
}
