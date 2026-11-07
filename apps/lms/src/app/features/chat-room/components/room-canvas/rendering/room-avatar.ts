import type Phaser from 'phaser';
import type { RoomColor, RoomFacing } from '@lms/contracts';

export const AVATAR_COLORS: Record<RoomColor, number> = {
  teal: 0x168e85,
  slate: 0x657a81,
  amber: 0xd39a39,
  blue: 0x5188cf,
  rose: 0xce728a,
};

/** Procedural eight-way sprite: world art is independent from the Angular UI theme. */
export class RoomAvatar {
  readonly body: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private frame = '';

  constructor(
    scene: Phaser.Scene,
    private color: RoomColor,
  ) {
    this.graphics = scene.add.graphics();
    this.body = scene.add.container(0, 0, [this.graphics]);
  }

  draw(
    facing: RoomFacing,
    walking: boolean,
    time: number,
    reducedMotion: boolean,
    lift: number,
    wave: number,
  ): void {
    const step = walking && !reducedMotion ? Math.floor(time / 100) % 6 : 0;
    const swing =
      walking && !reducedMotion ? Math.sin((step * Math.PI) / 3) * 3 : 0;
    this.body.y = -lift - Math.abs(swing) * 0.45;
    const waveFrame = Math.round(wave * 10);
    const key = `${facing}:${step}:${waveFrame}`;
    if (key === this.frame) return;
    this.frame = key;
    const g = this.graphics.clear();
    const back = facing.startsWith('north');
    const east = facing.includes('east'),
      west = facing.includes('west');
    const side = facing === 'east' || facing === 'west';
    const sign = east ? 1 : west ? -1 : 0;
    const half = side ? 9 : 13;
    g.fillStyle(0x33444a)
      .fillRoundedRect(-9, -9 + swing, 7, 12, 2)
      .fillRoundedRect(3, -9 - swing, 7, 12, 2);
    g.fillStyle(AVATAR_COLORS[this.color]).fillRoundedRect(
      -half,
      -30,
      half * 2,
      24,
      7,
    );
    g.fillStyle(0xf2cba6).fillRoundedRect(-half - 3, -24 - swing, 5, 14, 3);
    if (waveFrame) {
      const angle = waveFrame * 0.2;
      const handX = half - 1 + Math.sin(angle) * 13;
      const handY = -24 + Math.cos(angle) * 13;
      g.lineStyle(5, 0xf2cba6).lineBetween(half - 1, -24, handX, handY);
      g.fillCircle(handX, handY, 3.5);
    } else {
      g.fillRoundedRect(half - 2, -24 + swing, 5, 14, 3);
    }
    g.fillStyle(0xf2cba6).fillRoundedRect(-11 + sign, -49, 22, 23, 8);
    if (back) {
      g.fillStyle(0x393832).fillRoundedRect(
        -12 + sign,
        -51,
        24,
        side ? 17 : 22,
        7,
      );
      g.fillStyle(0x235951).fillRoundedRect(-8, -27, 16, 17, 4);
      g.lineStyle(1, 0x86b3a1).lineBetween(-4, -23, 4, -23);
    } else {
      g.fillStyle(0x393832)
        .fillRoundedRect(-12 + sign, -51, 24, 10, 6)
        .fillRect(sign > 0 ? -11 : 7, -45, 5, 8);
      g.fillStyle(0x423f38);
      if (side) {
        g.fillCircle(sign * 7, -37, 1.5);
        g.fillStyle(0xf2cba6).fillRoundedRect(
          sign > 0 ? 10 : -15,
          -37,
          5,
          5,
          2,
        );
      } else {
        g.fillCircle(-4 + sign * 3, -37, 1.4).fillCircle(
          5 + sign * 3,
          -37,
          1.4,
        );
        g.lineStyle(1, 0xb77461).lineBetween(
          -2 + sign * 3,
          -32,
          3 + sign * 3,
          -32,
        );
      }
    }
  }
}
