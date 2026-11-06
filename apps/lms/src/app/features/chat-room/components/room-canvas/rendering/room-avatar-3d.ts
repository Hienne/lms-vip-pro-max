import * as THREE from 'three';
import type { RoomFacing, RoomPlayer } from '@lms/contracts';
import type { RoomSpeech } from '../../../data-access/chat-room.model';
import { AVATAR_COLORS } from './room-avatar';
import { facingYaw } from './room.motion';
import { RoomWorld3D, WORLD_SCALE } from './room-world-3d';

export class RoomAvatar3D {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private readonly limbs: THREE.Group[] = [];
  private readonly label: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private speechId = '';
  target: { x: number; y: number; facing: RoomFacing };

  constructor(
    private world: RoomWorld3D,
    private player: RoomPlayer,
  ) {
    this.root.position.set(player.x / WORLD_SCALE, 0, player.y / WORLD_SCALE);
    this.target = {
      x: player.x,
      y: player.y,
      facing: player.facing ?? 'south',
    };
    this.body.rotation.y = facingYaw(this.target.facing);
    this.root.add(this.body);
    const skin = 0xeec6a1,
      hair = 0x393832;
    world.box(
      this.body,
      0,
      1.05,
      0,
      0.38,
      0.5,
      0.24,
      AVATAR_COLORS[player.color],
    );
    world.box(this.body, 0, 1.49, 0, 0.32, 0.35, 0.3, skin);
    world.box(this.body, 0, 1.68, 0.015, 0.34, 0.12, 0.33, hair);
    world.box(this.body, 0, 1.51, 0.135, 0.34, 0.27, 0.07, hair);
    for (const x of [-0.065, 0.065])
      world.box(this.body, x, 1.53, -0.155, 0.027, 0.027, 0.016, 0x303934);
    world.box(this.body, 0, 1.46, -0.17, 0.04, 0.055, 0.035, skin);
    world.box(this.body, 0, 1.405, -0.155, 0.07, 0.013, 0.012, 0xa3755f);
    for (const [x, y, length, color] of [
      [-0.11, 0.8, 0.75, 0x34464b],
      [0.11, 0.8, 0.75, 0x34464b],
      [-0.25, 1.24, 0.5, skin],
      [0.25, 1.24, 0.5, skin],
    ]) {
      const joint = new THREE.Group();
      joint.position.set(x, y, 0);
      this.body.add(joint);
      world.box(
        joint,
        0,
        -length / 2,
        0,
        x * x > 0.04 ? 0.1 : 0.13,
        length,
        0.14,
        color,
      );
      this.limbs.push(joint);
    }
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.label = new THREE.Sprite(material);
    this.label.position.y = 2.05;
    this.root.add(this.label);
    this.paintLabel();
  }

  update(
    delta: number,
    time: number,
    speech: RoomSpeech | undefined,
    reducedMotion: boolean,
  ): void {
    const dx = this.target.x / WORLD_SCALE - this.root.position.x,
      dz = this.target.y / WORLD_SCALE - this.root.position.z;
    const walking = Math.hypot(dx, dz) > 0.01;
    const blend = 1 - Math.exp(-delta / 45);
    this.root.position.x += dx * blend;
    this.root.position.z += dz * blend;
    const yaw = facingYaw(this.target.facing);
    const angle = Math.atan2(
      Math.sin(yaw - this.body.rotation.y),
      Math.cos(yaw - this.body.rotation.y),
    );
    this.body.rotation.y += angle * blend;
    const swing = walking && !reducedMotion ? Math.sin(time / 100) * 0.45 : 0;
    this.limbs.forEach(
      (limb, i) => (limb.rotation.x = swing * (i % 2 ? -1 : 1)),
    );
    this.body.position.y =
      walking && !reducedMotion ? Math.abs(Math.sin(time / 100)) * 0.025 : 0;
    const active = speech && speech.expiresAt > Date.now() ? speech : undefined;
    if ((active?.id ?? '') !== this.speechId) {
      this.speechId = active?.id ?? '';
      this.paintLabel(active);
    }
  }
  private paintLabel(speech?: RoomSpeech): void {
    // Speech is UI anchored to the head; long bubbles remain readable against the ceiling.
    this.label.material.depthTest = !speech;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 512);
    ctx.font = speech ? '25px sans-serif' : 'bold 27px sans-serif';
    const lines: string[] = [];
    let line = '';
    for (const word of (speech?.text ?? this.player.name).split(/\s+/)) {
      if (line && ctx.measureText(line + ' ' + word).width > 440) {
        lines.push(line);
        line = '';
      }
      if (line) line += ' ';
      for (const char of word) {
        if (ctx.measureText(line + char).width > 440) {
          lines.push(line);
          line = char;
        } else line += char;
      }
    }
    if (line) lines.push(line);
    const shown = lines;
    const width = Math.min(
      490,
      Math.max(...shown.map((text) => ctx.measureText(text).width), 70) + 36,
    );
    const height = shown.length * 30 + 24;
    ctx.fillStyle = speech ? '#fffdf5' : '#234c44';
    ctx.beginPath();
    ctx.roundRect((512 - width) / 2, 0, width, height, 12);
    ctx.fill();
    ctx.fillStyle = speech ? '#23443c' : '#ffffff';
    ctx.textAlign = 'center';
    shown.forEach((text, i) => ctx.fillText(text, 256, 33 + i * 30));
    this.texture.repeat.set(1, height / 512);
    this.texture.offset.set(0, 1 - height / 512);
    this.texture.needsUpdate = true;
    this.label.scale.set(2.55, (height / 512) * 2.55, 1);
    this.label.position.y = 1.83 + this.label.scale.y / 2;
  }
  dispose(): void {
    this.texture.dispose();
    (this.label.material as THREE.SpriteMaterial).dispose();
  }
}
