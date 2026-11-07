import * as THREE from 'three';
import type { RoomFacing, RoomPlayer } from '@lms/contracts';
import type { RoomSpeech } from '../../../data-access/chat-room.model';
import { AVATAR_COLORS } from './room-avatar';
import { facingYaw, type GesturePose } from './room.motion';
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
    private local: boolean,
  ) {
    this.root.position.set(player.x / WORLD_SCALE, 0, player.y / WORLD_SCALE);
    this.target = {
      x: player.x,
      y: player.y,
      facing: player.facing ?? 'south',
    };
    this.body.rotation.y = facingYaw(this.target.facing);
    this.root.add(this.body);
    this.buildBody();
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
    this.root.add(this.label);
    this.paintLabel();
  }

  private buildBody(): void {
    const skin = 0xecb18b;
    const hair = 0x40251c;
    const garment = AVATAR_COLORS[this.player.color];
    const body = this.body;
    const sphere = this.world.sphere.bind(this.world);

    this.world.dressAvatar(body, garment);
    sphere(body, 0, 0.54, 0, 0.322, 0.044, 0.238, 0x4b3932);
    sphere(body, 0.045, 0.83, -0.215, 0.037, 0.26, 0.031, 0xffe2b2).rotation.z =
      -0.57;

    // The head, fringe and bun each have volume so the silhouette reads from behind.
    sphere(body, 0, 1.42, -0.035, 0.466, 0.45, 0.418, skin);
    sphere(body, 0, 1.54, 0.119, 0.479, 0.382, 0.382, hair);
    sphere(body, -0.13, 1.72, -0.265, 0.3, 0.146, 0.185, hair).rotation.z =
      0.31;
    sphere(body, 0.252, 1.73, -0.2, 0.182, 0.126, 0.196, 0x533123).rotation.z =
      -0.45;
    sphere(body, 0, 1.36, 0.45, 0.192, 0.186, 0.162, 0x583627);
    sphere(body, 0, 1.49, 0.449, 0.175, 0.028, 0.127, 0xe0ad64);

    for (const side of [-1, 1]) {
      sphere(body, side * 0.44, 1.37, -0.025, 0.081, 0.111, 0.08, skin);
      const eye = new THREE.Group();
      eye.position.set(side * 0.173, 1.399, -0.422);
      eye.rotation.y = -side * 0.29;
      body.add(eye);
      sphere(eye, 0, 0, 0, 0.091, 0.113, 0.037, 0xffefdc).castShadow = false;
      sphere(eye, 0, -0.003, -0.022, 0.074, 0.097, 0.033, 0x321d19).castShadow =
        false;
      sphere(
        eye,
        -0.021,
        0.037,
        -0.05,
        0.023,
        0.028,
        0.012,
        0xffffff,
      ).castShadow = false;
      sphere(
        eye,
        0.025,
        -0.03,
        -0.049,
        0.01,
        0.011,
        0.006,
        0xf5cea3,
      ).castShadow = false;
      const brow = sphere(eye, 0, 0.146, 0.02, 0.072, 0.016, 0.019, hair);
      brow.castShadow = false;
      brow.rotation.z = side * -0.19;
      const cheek = sphere(
        body,
        side * 0.255,
        1.269,
        -0.372,
        0.061,
        0.031,
        0.016,
        0xe88e7d,
      );
      cheek.rotation.y = -side * 0.52;
      cheek.castShadow = false;

      const foot = new THREE.Group();
      foot.position.set(side * 0.156, 0.23, 0);
      body.add(foot);
      sphere(foot, 0, -0.135, -0.05, 0.125, 0.079, 0.165, 0x44302a);
      sphere(foot, 0, -0.181, -0.05, 0.129, 0.028, 0.169, 0xffe9ce);

      const arm = new THREE.Group();
      arm.position.set(side * 0.264, 0.88, 0);
      arm.rotation.z = side * 0.32;
      body.add(arm);
      sphere(arm, 0, -0.138, 0, 0.123, 0.207, 0.123, garment);
      sphere(arm, 0, -0.303, -0.015, 0.088, 0.091, 0.086, skin);
      this.limbs.push(foot, arm);
    }
    sphere(body, 0, 1.319, -0.443, 0.038, 0.033, 0.037, skin).castShadow =
      false;
    for (const side of [-1, 1]) {
      const smile = sphere(
        body,
        side * 0.023,
        1.229,
        -0.409,
        0.029,
        0.009,
        0.012,
        0x965c4f,
      );
      smile.castShadow = false;
      smile.rotation.z = side * 0.27;
    }
  }

  update(
    delta: number,
    time: number,
    speech: RoomSpeech | undefined,
    reducedMotion: boolean,
    pose: GesturePose,
    localWalking?: boolean,
  ): void {
    const dx = this.target.x / WORLD_SCALE - this.root.position.x,
      dz = this.target.y / WORLD_SCALE - this.root.position.z;
    const walking = localWalking ?? Math.hypot(dx, dz) > 0.01;
    const blend = 1 - Math.exp(-delta / 45);
    this.root.position.x += dx * (this.local ? 1 : blend);
    this.root.position.z += dz * (this.local ? 1 : blend);
    const yaw = facingYaw(pose.facing ?? this.target.facing);
    const angle = Math.atan2(
      Math.sin(yaw - this.body.rotation.y),
      Math.cos(yaw - this.body.rotation.y),
    );
    this.body.rotation.y += angle * blend;
    const swing = walking && !reducedMotion ? Math.sin(time / 100) * 0.45 : 0;
    this.limbs.forEach((limb, i) => {
      limb.rotation.x = swing * (i === 0 || i === 3 ? 1 : -1);
    });
    this.limbs[1].rotation.z = -0.32 - pose.lift * 0.45;
    const wavingArm = this.limbs[3];
    wavingArm.rotation.z = 0.32 + pose.wave * 1.9 + pose.lift * 0.45;
    if (pose.wave > 0) wavingArm.rotation.x = pose.wave * 0.28;
    const lift = pose.lift * 0.62;
    this.body.position.y =
      lift +
      (walking && !reducedMotion ? Math.abs(Math.sin(time / 100)) * 0.025 : 0);
    const active = speech && speech.expiresAt > Date.now() ? speech : undefined;
    if ((active?.id ?? '') !== this.speechId) {
      this.speechId = active?.id ?? '';
      this.paintLabel(active);
    }
    this.label.position.y = 2.01 + this.label.scale.y / 2 + lift;
  }
  private paintLabel(speech?: RoomSpeech): void {
    // Speech is UI anchored to the head; long bubbles remain readable against the ceiling.
    this.label.material.depthTest = !speech;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 512);
    ctx.font = speech ? '25px sans-serif' : 'bold 27px sans-serif';
    const lines: string[] = [];
    let line = '';
    const name = this.local ? `${this.player.name} · Bạn` : this.player.name;
    for (const word of (speech?.text ?? name).split(/\s+/)) {
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
    ctx.fillStyle = speech ? '#fffdf5' : '#253a32';
    ctx.beginPath();
    ctx.roundRect((512 - width) / 2, 4, width, height - 8, 12);
    ctx.fill();
    if (!speech && this.local) {
      ctx.strokeStyle = '#e5bc77';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.fillStyle = speech ? '#23443c' : '#ffffff';
    ctx.textAlign = 'center';
    shown.forEach((text, i) => ctx.fillText(text, 256, 33 + i * 30));
    this.texture.repeat.set(1, height / 512);
    this.texture.offset.set(0, 1 - height / 512);
    this.texture.needsUpdate = true;
    this.label.scale.set(2.55, (height / 512) * 2.55, 1);
    this.label.position.y = 2.01 + this.label.scale.y / 2;
  }
  dispose(): void {
    this.texture.dispose();
    (this.label.material as THREE.SpriteMaterial).dispose();
  }
}
