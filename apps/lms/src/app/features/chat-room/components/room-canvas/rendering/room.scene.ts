import Phaser from 'phaser';
import type {
  RoomPlayer as Player,
  RoomMap,
  RoomFurniture as Furniture,
} from '@lms/contracts';
import type { RoomCanvasState } from '../../../data-access/chat-room.model';
const PALETTE = {
  teal: 0x168e85,
  slate: 0x657a81,
  amber: 0xd39a39,
  blue: 0x5188cf,
  rose: 0xce728a,
};

interface Actor {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Graphics;
  target: { x: number; y: number };
  name: string;
  until: number;
}

export class RoomScene extends Phaser.Scene {
  private actors = new Map<string, Actor>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private previousView?: RoomCanvasState;
  private lastSent = 0;
  private lastPosition = { x: -1, y: -1 };
  private touch = { x: 0, y: 0 };
  private focused = true;
  private readonly reducedMotion = matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  constructor(
    private layout: RoomMap,
    private view: () => RoomCanvasState,
    private moved: (x: number, y: number) => void,
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
    camera.setBounds(0, 0, this.layout.width, this.layout.height);
    const fit = Math.min(
      this.scale.width / this.layout.width,
      this.scale.height / this.layout.height,
    );
    camera.setZoom(Math.max(0.62, fit * 0.96));
    const me = this.actors.get(this.view().me);
    if (me && fit < 0.62) camera.startFollow(me.root, true, 0.12, 0.12);
    else {
      camera.stopFollow();
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
    for (const x of [238, 812]) {
      g.fillStyle(0xd1e8e5).fillRoundedRect(x, 29, 74, 28, 4);
      g.lineStyle(3, 0xffffff).strokeRect(x + 3, 31, 68, 24);
      g.lineBetween(x + 37, 31, x + 37, 55);
    }
    g.fillStyle(0xe2e9dc).fillRoundedRect(437, 415, 246, 172, 22);
    g.lineStyle(2, 0xd1ddcc).strokeRoundedRect(445, 423, 230, 156, 17);
    this.add
      .text(560, 475, 'Khu tự học', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '22px',
        color: '#8ca58d',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    g.fillStyle(0xacc5b6).fillRoundedRect(463, 700, 194, 28, 6);
    this.add
      .text(560, 713, 'Lối vào', {
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
    const body = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x33444a)
      .fillRoundedRect(-10, -10, 8, 12, 2)
      .fillRoundedRect(3, -10, 8, 12, 2);
    g.fillStyle(PALETTE[player.color]).fillRoundedRect(-13, -29, 26, 23, 8);
    g.fillStyle(0xf2cba6)
      .fillRoundedRect(-16, -24, 5, 14, 3)
      .fillRoundedRect(11, -24, 5, 14, 3);
    g.fillStyle(0xf2cba6).fillRoundedRect(-11, -49, 22, 23, 8);
    g.fillStyle(0x393832)
      .fillRoundedRect(-12, -51, 24, 10, 6)
      .fillRect(-12, -45, 5, 8);
    g.fillStyle(0x423f38).fillCircle(-4, -37, 1.4).fillCircle(5, -37, 1.4);
    g.lineStyle(1, 0xb77461).lineBetween(-2, -32, 3, -32);
    body.add(g);
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
    root.add([shadow, body, bubble, label]);
    const actor = {
      root,
      body,
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
      this.lastPosition = { x: -1, y: -1 };
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
      if (actor && player.id !== view.me)
        actor.target = { x: player.x, y: player.y };
    });
    if (view.me !== previous?.me) this.resize();
    if (view.correction && view.correction !== previous?.correction) {
      this.actors
        .get(view.me)
        ?.root.setPosition(view.correction.x, view.correction.y);
    }
    if (view.lastChat && view.lastChat !== previous?.lastChat) {
      const actor = this.actors.get(view.lastChat.playerId);
      if (actor) {
        actor.label.setText(view.lastChat.text);
        actor.until = this.time.now + 5500;
        this.paintLabel(actor, true);
      }
    }
  }
  private walkable(x: number, y: number): boolean {
    const r = this.layout.radius,
      { width: w, height: h } = this.layout;
    return (
      x >= 32 + r &&
      y >= 48 + r &&
      x <= w - 32 - r &&
      y <= h - 32 - r &&
      !this.layout.objects.some(
        (o) =>
          x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h,
      )
    );
  }
  override update(time: number, delta: number): void {
    this.synchronize();
    if (!this.view().online) {
      if (this.actors.size) {
        this.actors.forEach((a) => a.root.destroy());
        this.actors.clear();
      }
      return;
    }
    const self = this.actors.get(this.view().me);
    const typing =
      ['INPUT', 'TEXTAREA', 'BUTTON'].includes(
        document.activeElement?.tagName ?? '',
      ) || (document.activeElement as HTMLElement)?.isContentEditable;
    let dx = 0,
      dy = 0;
    if (self && this.focused && !typing) {
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
        const distance = (this.layout.speed * Math.min(delta, 40)) / 1000;
        dx = (dx / length) * distance;
        dy = (dy / length) * distance;
        const steps = Math.max(1, Math.ceil(distance / 4));
        for (let i = 0; i < steps; i++) {
          if (this.walkable(self.root.x + dx / steps, self.root.y))
            self.root.x += dx / steps;
          if (this.walkable(self.root.x, self.root.y + dy / steps))
            self.root.y += dy / steps;
        }
      }
    }
    if (
      self &&
      time - this.lastSent > 65 &&
      (self.root.x !== this.lastPosition.x ||
        self.root.y !== this.lastPosition.y)
    ) {
      this.moved(self.root.x, self.root.y);
      this.lastSent = time;
      this.lastPosition = { x: self.root.x, y: self.root.y };
    }
    this.actors.forEach((actor, id) => {
      const distance = Math.hypot(
        actor.target.x - actor.root.x,
        actor.target.y - actor.root.y,
      );
      if (id !== this.view().me) {
        const blend = 1 - Math.exp(-delta / 45);
        actor.root.x = Phaser.Math.Linear(actor.root.x, actor.target.x, blend);
        actor.root.y = Phaser.Math.Linear(actor.root.y, actor.target.y, blend);
      }
      actor.body.y = this.reducedMotion
        ? 0
        : (id === this.view().me ? Math.hypot(dx, dy) > 0 : distance > 1)
          ? Math.sin(time / 85) * 2
          : 0;
      actor.root.setDepth(actor.root.y + 4);
      if (actor.until && time > actor.until) {
        actor.until = 0;
        actor.label.setText(actor.name);
        this.paintLabel(actor, false);
      }
    });
  }
}
