import * as THREE from 'three';
import type { RoomApproach, RoomFacing, RoomPlayer } from '@lms/contracts';
import type { RoomSpeech } from '../../../data-access/chat-room.model';
import { facingFromVector, facingYaw, type GesturePose } from './room.motion';
import { CHAIR_SEAT_TOP, RoomWorld3D, WORLD_SCALE } from './room-world-3d';

const AVATAR_COLORS = {
  teal: 0x168e85,
  slate: 0x657a81,
  amber: 0xd39a39,
  blue: 0x5188cf,
  rose: 0xce728a,
};

const AVATAR_SCALE = 0.5;
const SEATED_HIP_BASE = 0.49;
const LABEL_HEIGHT = 2.18 * AVATAR_SCALE;
const LABEL_SCALE = 1.85;

export class RoomAvatar3D {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private readonly limbs: THREE.Group[] = [];
  private readonly seatedLegs: THREE.Group[] = [];
  private readonly hands: { fist: THREE.Mesh; palm: THREE.Group }[] = [];
  private garment!: THREE.Mesh;
  private belt!: THREE.Mesh;
  private readonly label: THREE.Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private speechId = '';
  private route?: RoomApproach;
  private routeStartedAt = 0;
  target: { x: number; y: number; facing: RoomFacing };
  seated = false;

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
    this.body.scale.setScalar(AVATAR_SCALE);
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
    const trousers = 0x343f50;
    const shoe = 0x44302a;
    const sole = 0xffe9ce;
    const body = this.body;
    const sphere = this.world.sphere.bind(this.world);
    const skirt = this.player.avatar === 'female';

    this.garment = this.world.dressAvatar(body, garment, skirt);
    this.belt = sphere(
      body,
      0,
      0.54,
      0,
      skirt ? 0.322 : 0.286,
      0.038,
      0.235,
      0x4b3932,
    );
    sphere(body, 0, 1.42, -0.035, 0.466, 0.45, 0.418, skin);
    if (skirt) {
      const chestnut = 0x603729;
      sphere(body, 0, 1.58, 0.09, 0.483, 0.385, 0.403, hair);
      sphere(body, 0.05, 1.27, 0.259, 0.34, 0.378, 0.22, hair).rotation.z =
        0.13;
      sphere(
        body,
        -0.16,
        1.745,
        -0.251,
        0.299,
        0.137,
        0.203,
        chestnut,
      ).rotation.z = 0.32;
      sphere(body, 0.25, 1.725, -0.239, 0.191, 0.129, 0.18, hair).rotation.z =
        -0.51;
      sphere(
        body,
        -0.22,
        1.792,
        -0.311,
        0.15,
        0.029,
        0.079,
        0x754836,
      ).rotation.z = 0.3;
      for (const side of [-1, 1]) {
        sphere(
          body,
          side * 0.414,
          1.4,
          0.013,
          0.101,
          0.252,
          0.158,
          hair,
        ).rotation.z = side * -0.1;
        sphere(
          body,
          side * 0.375,
          1.205,
          0.12,
          0.122,
          0.225,
          0.159,
          chestnut,
        ).rotation.z = side * -0.21;
        sphere(
          body,
          side * 0.09,
          0.96,
          -0.19,
          0.105,
          0.045,
          0.045,
          0xffe6b9,
        ).rotation.z = side * 0.22;
      }
      // A flower clip frames the side part and stays visible from the front and side.
      const clip = new THREE.Group();
      clip.position.set(0.365, 1.654, -0.417);
      clip.rotation.y = -0.32;
      body.add(clip);
      for (let petal = 0; petal < 5; petal++) {
        const angle = (petal * Math.PI * 2) / 5;
        sphere(
          clip,
          Math.cos(angle) * 0.046,
          Math.sin(angle) * 0.046,
          0,
          0.033,
          0.034,
          0.024,
          0xf5b7c6,
        );
      }
      sphere(clip, 0, 0, -0.019, 0.025, 0.025, 0.017, 0xffd483);
      sphere(body, 0, 0.95, -0.22, 0.054, 0.055, 0.035, 0xe5b767);
    } else {
      sphere(body, 0, 1.64, 0.103, 0.458, 0.29, 0.37, hair);
      sphere(body, -0.11, 1.79, -0.218, 0.319, 0.123, 0.194, hair).rotation.z =
        0.15;
      sphere(
        body,
        0.29,
        1.72,
        -0.145,
        0.144,
        0.115,
        0.178,
        0x503021,
      ).rotation.z = -0.43;
      sphere(body, 0, 0.86, -0.23, 0.035, 0.18, 0.025, 0xf4e3ca);
      for (const y of [0.73, 0.62])
        sphere(body, 0.032, y, -0.219, 0.026, 0.026, 0.018, 0xd9b574);
    }

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
      if (!skirt) sphere(foot, 0, 0.045, 0.022, 0.123, 0.234, 0.126, trousers);
      sphere(foot, 0, -0.135, -0.05, 0.125, 0.079, 0.165, shoe);
      sphere(foot, 0, -0.181, -0.05, 0.129, 0.028, 0.169, sole);

      // The shin hangs in front of the cushion and the thigh rests on top.
      const seatedLeg = new THREE.Group();
      seatedLeg.position.x = side * 0.156;
      const legColor = skirt ? skin : trousers;
      sphere(
        seatedLeg,
        0,
        SEATED_HIP_BASE + 0.105,
        -0.2,
        0.123,
        0.116,
        0.34,
        legColor,
      );
      sphere(seatedLeg, 0, 0.338, -0.55, 0.103, 0.267, 0.11, legColor);
      sphere(seatedLeg, 0, 0.128, -0.618, 0.125, 0.079, 0.165, shoe);
      sphere(seatedLeg, 0, 0.082, -0.618, 0.129, 0.028, 0.169, sole);
      seatedLeg.visible = false;
      body.add(seatedLeg);
      this.seatedLegs.push(seatedLeg);

      const arm = new THREE.Group();
      arm.position.set(side * 0.264, 0.88, 0);
      arm.rotation.z = side * 0.32;
      body.add(arm);
      sphere(arm, 0, -0.138, 0, 0.123, 0.207, 0.123, garment);
      const fist = sphere(arm, 0, -0.303, -0.015, 0.088, 0.091, 0.086, skin);
      const palm = new THREE.Group();
      palm.position.set(0, -0.34, -0.01);
      sphere(palm, 0, 0, 0, 0.078, 0.048, 0.072, skin);
      for (const x of [-0.051, -0.017, 0.017, 0.051])
        sphere(
          palm,
          x,
          0,
          -0.071,
          0.022,
          0.033,
          0.062 - Math.abs(x) * 0.3,
          skin,
        );
      sphere(palm, -side * 0.069, 0, -0.017, 0.036, 0.034, 0.047, skin);
      palm.visible = false;
      arm.add(palm);
      this.hands.push({ fist, palm });
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

  follow(route: RoomApproach | undefined): void {
    if (route === this.route) return;
    this.route = route;
    this.routeStartedAt = performance.now();
  }

  private approachPosition(time: number): typeof this.target {
    if (!this.route) return this.target;
    let distance =
      (Math.max(0, time - this.routeStartedAt) * this.route.speed) / 1000;
    const points = this.route.points;
    let from = points[0];
    for (let index = 1; index < points.length; index++) {
      const to = points[index];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length > 0 && distance <= length) {
        return {
          x: from.x + (dx * distance) / length,
          y: from.y + (dy * distance) / length,
          facing: facingFromVector(dx, dy, this.target.facing),
        };
      }
      distance -= length;
      from = to;
    }
    return { ...from, facing: this.target.facing };
  }

  update(
    delta: number,
    time: number,
    speech: RoomSpeech | undefined,
    reducedMotion: boolean,
    pose: GesturePose,
    localWalking?: boolean,
    smoothLocalPosition = false,
  ): void {
    const target = this.approachPosition(time);
    const dx = target.x / WORLD_SCALE - this.root.position.x,
      dz = target.y / WORLD_SCALE - this.root.position.z;
    const walking =
      !this.seated &&
      !pose.highFive &&
      (localWalking ?? Math.hypot(dx, dz) > 0.01);
    const blend = 1 - Math.exp(-delta / 45);
    const positionBlend = this.local && !smoothLocalPosition ? 1 : blend;
    this.root.position.x += dx * positionBlend;
    this.root.position.z += dz * positionBlend;
    const yaw = pose.highFive?.yaw ?? facingYaw(pose.facing ?? target.facing);
    const angle = Math.atan2(
      Math.sin(yaw - this.body.rotation.y),
      Math.cos(yaw - this.body.rotation.y),
    );
    this.body.rotation.y += angle * blend;
    const swing = walking && !reducedMotion ? Math.sin(time / 100) * 0.45 : 0;
    const [leftFoot, leftArm, rightFoot, rightArm] = this.limbs;
    leftFoot.visible = rightFoot.visible = !this.seated;
    leftFoot.rotation.x = swing;
    rightFoot.rotation.x = -swing;
    this.seatedLegs.forEach((leg) => (leg.visible = this.seated));
    const wave = pose.highFive ? 0 : pose.wave;
    leftArm.rotation.set(-swing, 0, -0.32 - pose.lift * 0.45);
    rightArm.rotation.set(
      wave > 0 ? wave * 0.28 : swing,
      0,
      0.32 + wave * 1.9 + pose.lift * 0.45,
    );
    leftArm.scale.y = rightArm.scale.y = 1;
    this.hands.forEach(({ fist, palm }, index) => {
      palm.visible = !!pose.highFive && (index === 1) === pose.highFive.leading;
      fist.visible = !palm.visible;
    });
    if (pose.highFive) {
      const hand = pose.highFive.leading ? rightArm : leftArm;
      hand.rotation.set(pose.highFive.amount * 1.78, 0, 0);
      hand.scale.y = 1 + pose.highFive.amount * 0.33;
    }
    const skirtSeated = this.seated && this.player.avatar === 'female';
    this.garment.scale.y = skirtSeated ? 0.61 : 1;
    this.garment.position.y = skirtSeated ? 0.42 : 0;
    this.belt.visible = !this.seated;
    const lift = this.seated
      ? CHAIR_SEAT_TOP - SEATED_HIP_BASE * AVATAR_SCALE
      : pose.lift * 0.62 * AVATAR_SCALE;
    const reach = pose.highFive
      ? 39 * (1 - AVATAR_SCALE) * pose.highFive.amount
      : 0;
    this.body.position.set(
      ((pose.highFive?.x ?? 0) - Math.sin(yaw) * reach) / WORLD_SCALE,
      lift +
        (walking && !reducedMotion
          ? Math.abs(Math.sin(time / 100)) * 0.025 * AVATAR_SCALE
          : 0),
      ((pose.highFive?.y ?? 0) - Math.cos(yaw) * reach) / WORLD_SCALE,
    );
    const active = speech && speech.expiresAt > Date.now() ? speech : undefined;
    if ((active?.id ?? '') !== this.speechId) {
      this.speechId = active?.id ?? '';
      this.paintLabel(active);
    }
    this.label.position.set(
      this.body.position.x,
      LABEL_HEIGHT + this.label.scale.y / 2 + lift,
      this.body.position.z,
    );
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
    this.label.scale.set(LABEL_SCALE, (height / 512) * LABEL_SCALE, 1);
    this.label.position.y = LABEL_HEIGHT + this.label.scale.y / 2;
  }
  dispose(): void {
    this.texture.dispose();
    (this.label.material as THREE.SpriteMaterial).dispose();
  }
}
