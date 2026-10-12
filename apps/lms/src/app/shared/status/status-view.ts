import type { BadgeTone, IconName } from '@lms/ui';

/** How one status value looks: its copy, colour, and the mockup's optional icon or dot. */
export interface StatusView {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly outline?: boolean;
  readonly dot?: boolean;
  readonly icon?: IconName;
}
