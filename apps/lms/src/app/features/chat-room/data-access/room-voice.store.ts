import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type { RoomCommand, RoomEvent } from '@lms/contracts';

type VoiceSignal = Extract<RoomCommand, { type: 'voice-signal' }>;
type IncomingSignal = Extract<RoomEvent, { type: 'voice-signal' }>;

interface VoicePeer {
  id: string;
  speaker: string;
  remote: string;
  connection: RTCPeerConnection;
  ice: RTCIceCandidateInit[];
  pending: Promise<void>;
  audio?: HTMLAudioElement;
}

@Injectable()
export class RoomVoiceStore {
  private readonly state = {
    available: signal(false),
    phase: signal<'idle' | 'permission' | 'connecting' | 'talking'>('idle'),
    error: signal(''),
    playingBlocked: signal(false),
    speakers: signal<Record<string, string>>({}),
  };
  readonly available$ = this.state.available.asReadonly();
  readonly phase$ = this.state.phase.asReadonly();
  readonly error$ = this.state.error.asReadonly();
  readonly playingBlocked$ = this.state.playingBlocked.asReadonly();
  readonly speakers$ = computed(() => Object.values(this.state.speakers()));

  private send?: (command: RoomCommand) => void;
  private me = '';
  private iceServers: RTCIceServer[] = [];
  private press?: string;
  private stream?: MediaStream;
  private peers = new Map<string, VoicePeer>();
  private queue: { peer: VoicePeer; command: VoiceSignal }[] = [];
  private pump?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  connect(send: (command: RoomCommand) => void): void {
    this.send = send;
  }

  identify(id: string): void {
    this.me = id;
  }

  async pressToTalk(): Promise<void> {
    if (!this.available$() || this.press) return;
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (this.press !== id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      for (const track of stream.getAudioTracks())
        track.onended = () => this.release();
      this.state.phase.set('connecting');
      this.send?.({ type: 'voice-talk', id });
    } catch {
      if (this.press !== id) return;
      this.release();
      this.state.error.set(
        'Không mở được micrô. Kiểm tra quyền micrô và giữ V để thử lại.',
      );
    }
  }

  release(): void {
    this.press = undefined;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
      this.send?.({ type: 'voice-talk', id: null });
    }
    for (const peer of this.peers.values()) {
      if (peer.speaker === this.me) this.close(peer);
    }
    this.state.phase.set('idle');
  }

  enablePlayback(): void {
    this.state.playingBlocked.set(false);
    for (const peer of this.peers.values()) this.play(peer);
  }

  receive(event: RoomEvent): void {
    switch (event.type) {
      case 'voice-ready':
        this.iceServers = event.iceServers;
        this.state.available.set(typeof RTCPeerConnection !== 'undefined');
        break;
      case 'voice-state':
        if (!this.available$() || event.speaker === this.me) return;
        this.left(event.speaker, false);
        if (
          event.id &&
          this.createPeer(event.id, event.speaker, event.speaker)
        ) {
          this.state.speakers.update((speakers) => ({
            ...speakers,
            [event.speaker]: event.name,
          }));
          this.send?.({
            type: 'voice-watch',
            id: event.id,
            speaker: event.speaker,
          });
        }
        break;
      case 'voice-peer':
        if (
          this.press === event.id &&
          this.stream &&
          !this.peers.has(this.key(this.me, event.peer))
        ) {
          const peer = this.createPeer(event.id, this.me, event.peer);
          if (peer)
            this.enqueue(peer, async () => {
              const stream = this.stream;
              if (!stream) return;
              for (const track of stream.getAudioTracks())
                peer.connection.addTrack(track, stream);
              await peer.connection.setLocalDescription(
                await peer.connection.createOffer(),
              );
              this.relay(
                peer,
                'offer',
                peer.connection.localDescription?.sdp ?? '',
              );
            });
        }
        break;
      case 'voice-signal': {
        const peer = this.peers.get(this.key(event.speaker, event.from));
        if (peer?.id === event.id)
          this.enqueue(peer, () => this.acceptSignal(peer, event));
        break;
      }
    }
  }

  left(id: string, closeOutgoing = true): void {
    for (const peer of this.peers.values()) {
      if (peer.remote === id && (closeOutgoing || peer.speaker === id))
        this.close(peer);
    }
    this.state.speakers.update((speakers) => {
      const remaining = { ...speakers };
      delete remaining[id];
      return remaining;
    });
  }

  reset(): void {
    this.release();
    for (const peer of this.peers.values()) this.close(peer);
    clearInterval(this.pump);
    this.pump = undefined;
    this.queue = [];
    this.me = '';
    this.iceServers = [];
    this.state.available.set(false);
    this.state.playingBlocked.set(false);
    this.state.error.set('');
    this.state.speakers.set({});
  }

  private key(speaker: string, remote: string): string {
    return JSON.stringify([speaker, remote]);
  }

  private current(peer: VoicePeer): boolean {
    return this.peers.get(this.key(peer.speaker, peer.remote)) === peer;
  }

  private createPeer(
    id: string,
    speaker: string,
    remote: string,
  ): VoicePeer | undefined {
    let connection: RTCPeerConnection;
    try {
      connection = new RTCPeerConnection({ iceServers: this.iceServers });
    } catch {
      this.state.error.set('Không khởi tạo được kết nối thoại.');
      return;
    }
    const peer: VoicePeer = {
      id,
      speaker,
      remote,
      connection,
      ice: [],
      pending: Promise.resolve(),
    };
    this.peers.set(this.key(speaker, remote), peer);
    connection.onicecandidate = ({ candidate }) => {
      if (candidate)
        this.relay(peer, 'ice', JSON.stringify(candidate.toJSON()));
    };
    connection.ontrack = ({ track, streams }) => {
      if (!this.current(peer) || speaker === this.me || track.kind !== 'audio')
        return;
      peer.audio ??= new Audio();
      peer.audio.srcObject = streams[0] ?? new MediaStream([track]);
      this.play(peer);
    };
    connection.onconnectionstatechange = () => {
      if (!this.current(peer)) return;
      if (connection.connectionState === 'connected' && speaker === this.me) {
        this.state.phase.set('talking');
      } else if (connection.connectionState === 'failed') {
        this.state.error.set(
          'Kết nối thoại bị gián đoạn. Thử giữ V lại hoặc kiểm tra mạng.',
        );
        this.close(peer);
      }
    };
    return peer;
  }

  private play(peer: VoicePeer): void {
    void peer.audio?.play().catch(() => {
      if (this.current(peer)) this.state.playingBlocked.set(true);
    });
  }

  private close(peer: VoicePeer): void {
    this.peers.delete(this.key(peer.speaker, peer.remote));
    peer.connection.close();
    if (peer.audio) {
      peer.audio.pause();
      peer.audio.srcObject = null;
    }
    this.queue = this.queue.filter((item) => item.peer !== peer);
  }

  private enqueue(peer: VoicePeer, action: () => Promise<void>): void {
    peer.pending = peer.pending
      .then(async () => {
        if (this.current(peer)) await action();
      })
      .catch(() => {
        if (this.current(peer)) this.close(peer);
      });
  }

  private relay(
    peer: VoicePeer,
    kind: VoiceSignal['kind'],
    payload: string,
  ): void {
    if (!this.current(peer)) return;
    this.queue.push({
      peer,
      command: {
        type: 'voice-signal',
        id: peer.id,
        speaker: peer.speaker,
        to: peer.remote,
        kind,
        payload,
      },
    });
    // Keep ICE bursts below the room socket's packet limit.
    this.pump ??= setInterval(() => {
      const next = this.queue.shift();
      if (next && this.current(next.peer)) this.send?.(next.command);
      if (!this.queue.length) {
        clearInterval(this.pump);
        this.pump = undefined;
      }
    }, 35);
  }

  private async acceptSignal(
    peer: VoicePeer,
    event: IncomingSignal,
  ): Promise<void> {
    const connection = peer.connection;
    if (event.kind === 'ice') {
      const candidate = JSON.parse(event.payload) as RTCIceCandidateInit;
      if (connection.remoteDescription)
        await connection.addIceCandidate(candidate);
      else if (peer.ice.length < 64) peer.ice.push(candidate);
      return;
    }
    await connection.setRemoteDescription({
      type: event.kind,
      sdp: event.payload,
    });
    for (const candidate of peer.ice)
      await connection.addIceCandidate(candidate);
    peer.ice = [];
    if (event.kind === 'offer') {
      await connection.setLocalDescription(await connection.createAnswer());
      this.relay(peer, 'answer', connection.localDescription?.sdp ?? '');
    }
  }
}
