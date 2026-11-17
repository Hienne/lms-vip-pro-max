import { Component, input, output } from '@angular/core';
import { Mai } from '@lms/ui';

interface Point {
  x: number;
  y: number;
}

/** One run of a knowledge pulse along a link (matches `$beat` in the stylesheet). */
const FLOW_SECONDS = 3.2;

/** The viewBox is 520 × 200; the pillar line runs across its middle. */
const LINE_Y = 100;
const PILLAR_X = [70, 180, 290, 400] as const;
/** Where the line ends: the hoa mai, standing for excellence. */
const GOAL: Point = { x: 490, y: LINE_Y };

/** Scattered knowledge: small nodes around the line, linked to each other and into it. */
const NODES: readonly Point[] = [
  { x: 16, y: 36 },
  { x: 22, y: 168 },
  { x: 118, y: 26 },
  { x: 128, y: 174 },
  { x: 236, y: 40 },
  { x: 242, y: 162 },
  { x: 342, y: 24 },
  { x: 352, y: 178 },
  { x: 446, y: 46 },
  { x: 452, y: 158 },
];

const pillar = (index: number): Point => ({
  x: PILLAR_X[index],
  y: LINE_Y,
});

/** Each link joins two points: node to node, node to pillar, node to the goal. */
const LINKS: readonly (readonly [Point, Point])[] = [
  [NODES[0], pillar(0)],
  [NODES[1], pillar(0)],
  [NODES[0], NODES[2]],
  [NODES[1], NODES[3]],
  [NODES[2], pillar(1)],
  [NODES[3], pillar(1)],
  [NODES[2], NODES[4]],
  [NODES[3], NODES[5]],
  [NODES[4], pillar(2)],
  [NODES[5], pillar(2)],
  [NODES[4], NODES[6]],
  [NODES[5], NODES[7]],
  [NODES[6], pillar(3)],
  [NODES[7], pillar(3)],
  [NODES[6], NODES[8]],
  [NODES[7], NODES[9]],
  [NODES[8], GOAL],
  [NODES[9], GOAL],
];

/**
 * The sign-in page's picture of the name: scattered knowledge (small nodes) is connected into the
 * line C → H → A → N, which ends at the hoa mai (excellence). Decorative: the pillar list beside it
 * carries the words, so the picture is hidden from assistive technology.
 */
@Component({
  selector: 'app-chan-network',
  imports: [Mai],
  host: { class: 'chan-network', 'aria-hidden': 'true' },
  templateUrl: './chan-network.html',
  styleUrl: './chan-network.scss',
})
export class ChanNetwork {
  /** The pillar letters, in name order. */
  readonly letters = input.required<readonly string[]>();
  /** The index of the highlighted pillar, or null. */
  readonly active = input<number | null>(null);
  /** Emits the pillar under the pointer, and null when the pointer leaves it. */
  readonly activeChange = output<number | null>();

  protected readonly lineY = LINE_Y;
  protected readonly pillarX = PILLAR_X;
  protected readonly goal = GOAL;
  protected readonly nodes = NODES;
  protected readonly links = LINKS;
  /** The goal's place as a share of the picture, for the flower laid over it. */
  protected readonly goalLeft = `${(GOAL.x / 520) * 100}%`;

  /** Links start their run at staggered times so the flow never pulses in step. */
  protected flowDelay(index: number): string {
    return `${((index * 0.47) % FLOW_SECONDS).toFixed(2)}s`;
  }

  protected twinkleDelay(index: number): string {
    return `${((index * 0.61) % 3).toFixed(2)}s`;
  }

  /** The rings go C, H, A, N in turn, then the flower takes the beat. */
  protected ringDelay(index: number): string {
    return `${(index * 0.5).toFixed(1)}s`;
  }
}
