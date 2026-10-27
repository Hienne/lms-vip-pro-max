import { Component, input, output } from '@angular/core';
import type { AssetDetail } from '@lms/contracts';
import { Button, FmtBytesPipe, Icon } from '@lms/ui';

/** An `attachment` block: one row per file, downloaded through the content endpoint. */
@Component({
  selector: 'app-attachment-block',
  imports: [Button, FmtBytesPipe, Icon],
  templateUrl: './attachment-block.html',
  styleUrl: './attachment-block.scss',
})
export class AttachmentBlock {
  readonly assets = input.required<readonly AssetDetail[]>();
  /** A download is running; the others wait for it. */
  readonly busy = input(false);

  readonly download = output<AssetDetail>();
}
