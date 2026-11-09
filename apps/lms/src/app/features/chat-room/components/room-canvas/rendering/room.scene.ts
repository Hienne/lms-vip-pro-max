import Phaser from 'phaser';
import type {
  RoomPlayer as Player,
  RoomMap,
  RoomFacing,
  RoomMovement,
  RoomFurniture as Furniture,
} from '@lms/contracts';
import {
  inRoomArea,
  type RoomCanvasState,
} from '../../../data-access/chat-room.model';
import { RoomAvatar } from './room-avatar';
import {
  facingFromVector,
  gesturePose,
  moveInRoom,
  seatCenter,
} from './room.motion';

interface Actor {
  root: Phaser.GameObjects.Container;
  avatar: RoomAvatar;
  facing: RoomFacing;
  speechId: string;
  label: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Graphics;
  target: { x: number; y: number };
  name: string;
  until: number;
  seat?: number;
}

export class RoomScene extends Phaser.Scene {
  private actors = new Map<string, Actor>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private previousView?: RoomCanvasState;
  private lastSent = 0;
  private lastPosition = { x: -1, y: -1, facing: '' };
  private approaching = false;
  private touch = { x: 0, y: 0 };
  private focused = true;
  private readonly reducedMotion = matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  constructor(
    private layout: RoomMap,
    private view: () => RoomCanvasState,
    private moved: (position: RoomMovement) => void,
  ) {
    super('classroom');
  }

  create(): void {
    this.drawRoom();
    // Only movement keys are registered; text fields retain normal browser input.
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT',
      false,
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.scale.on('resize', this.resize, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.blur, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.focus, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.blur, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.focus, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.resize, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.blur, this);
      this.game.events.off(Phaser.Core.Events.FOCUS, this.focus, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.blur, this);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.focus, this);
    });
    this.resize();
  }
  setTouch(x: number, y: number): void {
    this.touch = { x, y };
  }
  chairAt(clientX: number, clientY: number): number | undefined {
    const rect = this.game.canvas.getBoundingClientRect();
    const point = this.cameras.main.getWorldPoint(
      ((clientX - rect.left) * this.scale.width) / rect.width,
      ((clientY - rect.top) * this.scale.height) / rect.height,
    );
    const index = this.layout.objects.findIndex(
      (object) =>
        object.kind === 'chair' &&
        point.x >= object.x &&
        point.x <= object.x + object.w &&
        point.y >= object.y &&
        point.y <= object.y + object.h,
    );
    return index >= 0 ? index : undefined;
  }
  private blur(): void {
    this.focused = false;
    this.touch = { x: 0, y: 0 };
    this.input.keyboard?.resetKeys();
  }
  private focus(): void {
    this.focused = true;
  }
  private resize(): void {
    const camera = this.cameras.main;
    const fit = Math.min(
      this.scale.width / this.layout.width,
      this.scale.height / this.layout.height,
    );
    const minimumZoom = this.scale.width >= 800 ? 0.27 : 0.5;
    camera.setZoom(Math.max(minimumZoom, fit * 0.96));
    const me = this.actors.get(this.view().me);
    if (me && fit * 0.96 < minimumZoom) {
      camera.setBounds(0, 0, this.layout.width, this.layout.height);
      camera.startFollow(me.root, true, 0.12, 0.12);
    } else {
      camera.stopFollow();
      camera.removeBounds();
      camera.centerOn(this.layout.width / 2, this.layout.height / 2);
    }
  }
  private drawRoom(): void {
    const { width: w, height: h } = this.layout;
    const g = this.add.graphics();
    g.fillStyle(0xcedbd5).fillRoundedRect(8, 15, w - 16, h - 20, 22);
    g.fillStyle(0xf4edde).fillRoundedRect(24, 24, w - 48, h - 48, 14);
    // A warm parquet floor, drawn locally with no external asset requests.
    for (let row = 0, y = 70; y < h - 32; row++, y += 40) {
      for (let x = 32 - (row % 2) * 80; x < w - 32; x += 160) {
        const left = Math.max(32, x),
          right = Math.min(w - 32, x + 160);
        g.fillStyle(
          (row + Math.floor(x / 160)) % 3 === 0 ? 0xeee4d0 : 0xf1e8d7,
        );
        g.fillRect(left, y, right - left - 1, Math.min(39, h - 32 - y));
      }
    }
    g.fillStyle(0xf7f8ef).fillRoundedRect(25, 25, w - 50, 43, {
      tl: 14,
      tr: 14,
      bl: 0,
      br: 0,
    });
    g.fillStyle(0xc0d2c5).fillRect(32, 64, w - 64, 7);
    g.fillStyle(0x9fbca9)
      .fillRect(28, 71, 8, h - 111)
      .fillRect(w - 36, 71, 8, h - 111);
    // Windows along the classroom walls.
    for (const x of [w * 0.2, w * 0.75]) {
      g.fillStyle(0xd1e8e5).fillRoundedRect(x, 29, 74, 28, 4);
      g.lineStyle(3, 0xffffff).strokeRect(x + 3, 31, 68, 24);
      g.lineBetween(x + 37, 31, x + 37, 55);
    }
    const area = this.layout.activityArea;
    if (area) {
      g.fillStyle(0xbed3bc).fillRoundedRect(area.x, area.y, area.w, area.h, 22);
      g.lineStyle(2, 0x88aa90).strokeRoundedRect(
        area.x + 8,
        area.y + 8,
        area.w - 16,
        area.h - 16,
        17,
      );
      this.add
        .text(area.x + area.w / 2, area.y + area.h / 2, 'Khu giao lưu', {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '30px',
          color: '#52795e',
        })
        .setOrigin(0.5);
    }
    const diceArea = this.layout.diceArea;
    if (diceArea) {
      const { x, y, w, h } = diceArea;
      g.fillStyle(0xe4c89e).fillRoundedRect(x, y, w, h, 22);
      g.lineStyle(3, 0xa66c38).strokeRoundedRect(
        x + 8,
        y + 8,
        w - 16,
        h - 16,
        17,
      );
      this.add
        .text(x + w / 2, y + h * 0.77, 'Bàn Trên/Dưới', {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '38px',
          color: '#6b411e',
        })
        .setOrigin(0.5);
    }
    g.fillStyle(0xacc5b6).fillRoundedRect(w / 2 - 97, h - 60, 194, 28, 6);
    this.add
      .text(w / 2, h - 47, 'Lối vào', {
        fontFamily: 'Segoe UI',
        fontSize: '11px',
        color: '#456958',
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.layout.objects.forEach((object) => this.drawFurniture(object));
  }

  private drawFurniture(o: Furniture): void {
    const { x, y, w, h } = o;
    const g = this.add.graphics().setDepth(y + h);
    g.fillStyle(0x344d3e, 0.1).fillRoundedRect(x + 3, y + 6, w, h, 7);
    if (o.kind === 'desk') {
      g.fillStyle(0x9d7252).fillRoundedRect(x, y + 7, w, h, 8);
      g.fillStyle(0xd9b684).fillRoundedRect(x, y, w, h - 3, 8);
      g.lineStyle(2, 0xe8cda4).strokeRoundedRect(
        x + 4,
        y + 4,
        w - 8,
        h - 12,
        5,
      );
      if (inRoomArea(this.layout.diceArea, x + w / 2, y + h / 2)) {
        g.fillStyle(0x305747).fillRoundedRect(x + 10, y + 9, w - 20, h - 20, 6);
        for (const offset of [-42, 0, 42]) {
          const center = x + w / 2 + offset;
          g.fillStyle(0xfff3d4).fillRoundedRect(
            center - 13,
            y + h / 2 - 13,
            26,
            26,
            4,
          );
          g.fillStyle(0x3b3025)
            .fillCircle(center - 5, y + h / 2 - 5, 2.6)
            .fillCircle(center + 5, y + h / 2 + 5, 2.6);
        }
        return;
      }
      // Open book, pencil and a small notebook on each desk.
      g.fillStyle(0x789a8e).fillRoundedRect(x + 18, y + 15, 37, 32, 3);
      g.fillStyle(0xfffdf3)
        .fillRect(x + 72, y + 17, 28, 29)
        .fillRect(x + 101, y + 17, 28, 29);
      g.lineStyle(1, 0xc7c9b8);
      for (let i = 0; i < 4; i++) {
        g.lineBetween(x + 77, y + 24 + i * 5, x + 95, y + 24 + i * 5);
        g.lineBetween(x + 106, y + 24 + i * 5, x + 123, y + 24 + i * 5);
      }
      g.fillStyle(0xb77a3e).fillRect(x + 142, y + 16, 3, 30);
    } else if (o.kind === 'chair') {
      g.fillStyle(0x638d7c).fillRoundedRect(x + 3, y + 10, w - 6, h - 7, 6);
      g.fillStyle(0x9ab9a1).fillRoundedRect(x + 1, y + 4, w - 2, h - 12, 7);
      g.fillStyle(0x719781).fillRoundedRect(x, y + h - 11, w, 12, 5);
      g.fillStyle(0xb3ccaf).fillRoundedRect(x + 4, y + h - 9, w - 8, 4, 2);
    } else if (o.kind === 'board') {
      g.fillStyle(0xb68e63).fillRoundedRect(x - 5, y - 23, w + 10, h + 23, 5);
      g.fillStyle(0x2e6255).fillRoundedRect(x, y - 20, w, h + 16, 3);
      this.add
        .text(x + w / 2, y + 5, 'Phòng học chung', {
          fontFamily: 'Segoe UI',
          fontSize: '14px',
          color: '#e4eee0',
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setDepth(y + h + 1);
      g.fillStyle(0xf0e7c8).fillRect(x + w - 30, y + h - 7, 18, 3);
    } else if (o.kind === 'shelf') {
      g.fillStyle(0xb38d62).fillRoundedRect(x, y - 17, w, h + 17, 4);
      g.fillStyle(0x7e624a).fillRect(x + 6, y - 11, w - 12, h + 3);
      const colors = [0x759b89, 0xd7bc82, 0xe7dfca, 0x7799a6, 0xbe8a76];
      for (let i = 0; i < 10; i++) {
        g.fillStyle(colors[i % 5]).fillRoundedRect(
          x + 9 + i * 10,
          y - 6 + (i % 3) * 3,
          7,
          31 - (i % 3) * 3,
          1,
        );
      }
      g.fillStyle(0xd0aa7b).fillRect(x, y + 25, w, 7);
    } else {
      g.fillStyle(0xba886b).fillRoundedRect(x + 8, y + 13, 22, 24, 5);
      g.fillStyle(0xd9ad88).fillEllipse(x + 19, y + 14, 29, 12);
      g.fillStyle(0x3b8059)
        .fillEllipse(x + 9, y, 22, 29)
        .fillEllipse(x + 28, y - 5, 23, 27);
      g.fillStyle(0x6d9d67).fillEllipse(x + 19, y - 14, 23, 31);
      g.fillStyle(0x87ae76).fillEllipse(x + 9, y - 15, 13, 20);
    }
  }

  private addActor(player: Player): void {
    if (this.actors.has(player.id)) return;
    const root = this.add.container(player.x, player.y);
    const shadow = this.add.ellipse(0, 2, 29, 12, 0x233c34, 0.17);
    const avatar = new RoomAvatar(this, player.color, player.avatar);
    const bubble = this.add.graphics();
    const label = this.add
      .text(0, -62, player.name, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 190 },
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 1);
    root.add([shadow, avatar.body, bubble, label]);
    const actor = {
      root,
      avatar,
      facing: player.facing ?? 'north',
      speechId: '',
      bubble,
      label,
      target: { x: player.x, y: player.y },
      name: player.name,
      until: 0,
    };
    this.actors.set(player.id, actor);
    this.paintLabel(actor, false);
  }
  private paintLabel(actor: Actor, speaking: boolean): void {
    const { width: w, height: h } = actor.label;
    actor.bubble
      .clear()
      .fillStyle(speaking ? 0xffffff : 0x234c44, speaking ? 1 : 0.93)
      .fillRoundedRect(-w / 2, -62 - h, w, h, speaking ? 10 : 6);
    if (speaking) actor.bubble.fillTriangle(-5, -63, 5, -63, 0, -56);
    actor.label.setColor(speaking ? '#23443c' : '#ffffff');
  }
  private synchronize(): void {
    const view = this.view();
    if (view === this.previousView) return;
    const previous = this.previousView;
    this.previousView = view;
    if (view.me !== previous?.me) {
      this.actors.forEach((a) => a.root.destroy());
      this.actors.clear();
      this.approaching = false;
      this.lastPosition = { x: -1, y: -1, facing: '' };
    }
    const ids = new Set(view.players.map((p) => p.id));
    this.actors.forEach((actor, id) => {
      if (!ids.has(id)) {
        actor.root.destroy();
        this.actors.delete(id);
      }
    });
    view.players.forEach((player) => {
      this.addActor(player);
      const actor = this.actors.get(player.id);
      if (!actor) return;
      const seat = seatCenter(this.layout, player.seat);
      const position = seat ?? { x: player.x, y: player.y };
      const seatChanged = actor.seat !== player.seat;
      actor.seat = player.seat;
      const wasApproaching = player.id === view.me && this.approaching;
      if (player.id === view.me) this.approaching = player.approaching === true;
      if (
        player.id !== view.me ||
        seatChanged ||
        player.approaching ||
        wasApproaching
      ) {
        actor.facing =
          player.facing ??
          facingFromVector(
            player.x - actor.target.x,
            player.y - actor.target.y,
            actor.facing,
          );
        actor.target = position;
        if (player.id === view.me && !this.approaching) {
          actor.root.setPosition(position.x, position.y);
          this.lastPosition = { ...position, facing: actor.facing };
        }
      }
    });
    if (view.me !== previous?.me) this.resize();
    if (
      view.correction &&
      view.correction !== previous?.correction &&
      this.actors.get(view.me)?.seat === undefined
    ) {
      this.actors
        .get(view.me)
        ?.root.setPosition(view.correction.x, view.correction.y);
    }
    if (view.chatting && !previous?.chatting) {
      this.input.keyboard?.resetKeys();
      this.touch = { x: 0, y: 0 };
    }
    this.actors.forEach((actor, id) => {
      const speech = view.speech[id];
      const active =
        speech && speech.expiresAt > Date.now() ? speech : undefined;
      if (actor.speechId === (active?.id ?? '')) return;
      actor.speechId = active?.id ?? '';
      actor.label.setText(active?.text ?? actor.name);
      actor.until = active
        ? this.time.now + Math.max(0, active.expiresAt - Date.now())
        : 0;
      this.paintLabel(actor, !!active);
    });
  }
  override update(time: number, delta: number): void {
    this.synchronize();
    const view = this.view();
    if (!view.online) {
      if (this.actors.size) {
        this.actors.forEach((a) => a.root.destroy());
        this.actors.clear();
      }
      return;
    }
    const self = this.actors.get(view.me);
    const now = performance.now();
    const localPose = gesturePose(
      view.gestures[view.me],
      now,
      this.reducedMotion,
    );
    const canMove =
      self?.seat === undefined && !localPose.highFive && !this.approaching;
    const typing =
      ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(
        document.activeElement?.tagName ?? '',
      ) || (document.activeElement as HTMLElement)?.isContentEditable;
    let dx = 0,
      dy = 0;
    if (self && canMove && this.focused && !typing && !view.chatting) {
      dx =
        Number(this.keys['D'].isDown || this.keys['RIGHT'].isDown) -
        Number(this.keys['A'].isDown || this.keys['LEFT'].isDown) +
        this.touch.x;
      dy =
        Number(this.keys['S'].isDown || this.keys['DOWN'].isDown) -
        Number(this.keys['W'].isDown || this.keys['UP'].isDown) +
        this.touch.y;
      const length = Math.hypot(dx, dy);
      if (length) {
        self.facing = facingFromVector(dx, dy, self.facing);
        const distance = (this.layout.speed * Math.min(delta, 40)) / 1000;
        dx = (dx / length) * distance;
        dy = (dy / length) * distance;
        const next = moveInRoom(
          this.layout,
          { x: self.root.x, y: self.root.y },
          dx,
          dy,
        );
        self.root.setPosition(next.x, next.y);
      }
    }
    if (
      self &&
      canMove &&
      time - this.lastSent > 65 &&
      (self.root.x !== this.lastPosition.x ||
        self.root.y !== this.lastPosition.y ||
        self.facing !== this.lastPosition.facing)
    ) {
      this.moved({ x: self.root.x, y: self.root.y, facing: self.facing });
      this.lastSent = time;
      this.lastPosition = {
        x: self.root.x,
        y: self.root.y,
        facing: self.facing,
      };
    }
    this.actors.forEach((actor, id) => {
      const distance = Math.hypot(
        actor.target.x - actor.root.x,
        actor.target.y - actor.root.y,
      );
      if (id !== view.me || this.approaching) {
        const blend = 1 - Math.exp(-delta / 45);
        actor.root.x = Phaser.Math.Linear(actor.root.x, actor.target.x, blend);
        actor.root.y = Phaser.Math.Linear(actor.root.y, actor.target.y, blend);
      }
      const pose =
        id === view.me
          ? localPose
          : gesturePose(view.gestures[id], now, this.reducedMotion);
      const seated = actor.seat !== undefined;
      const lift = seated ? -2 : pose.lift * 38;
      const shiftX = pose.highFive?.x ?? 0;
      const shiftY = pose.highFive?.y ?? 0;
      actor.avatar.draw(
        pose.facing ?? actor.facing,
        !seated &&
          !pose.highFive &&
          (id === view.me && !this.approaching
            ? Math.hypot(dx, dy) > 0
            : distance > 1),
        time,
        this.reducedMotion,
        lift,
        pose.wave,
        seated,
        pose.highFive !== undefined,
      );
      actor.avatar.body.x = shiftX;
      actor.avatar.body.y += shiftY;
      actor.label.setPosition(shiftX, -62 - lift + shiftY);
      actor.bubble.setPosition(shiftX, -lift + shiftY);
      actor.root.setDepth(actor.root.y + 4);
      if (actor.until && time > actor.until) {
        actor.until = 0;
        actor.label.setText(actor.name);
        this.paintLabel(actor, false);
      }
    });
  }
}
