import { Component, input, output } from '@angular/core';
import type { BlockType } from '@lms/contracts';
import { Icon } from '@lms/ui';
import type { BlockView } from '../../data-access/lesson.store';

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  video: 'Video',
  pdf: 'Tài liệu PDF',
  text: 'Bài đọc',
  process: 'Quy trình',
  image: 'Hình ảnh',
  attachment: 'Tệp đính kèm',
};

/** The lesson's blocks, one active at a time: choosing one moves the study session to it. */
@Component({
  selector: 'app-block-list',
  imports: [Icon],
  templateUrl: './block-list.html',
  styleUrl: './block-list.scss',
})
export class BlockList {
  readonly blocks = input.required<readonly BlockView[]>();
  readonly activeId = input<number | undefined>();

  readonly selected = output<number>();

  protected readonly typeLabel = BLOCK_TYPE_LABEL;
}
