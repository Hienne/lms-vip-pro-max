import { Component, computed, input, output } from '@angular/core';
import type { BlockType } from '@lms/contracts';
import { Select } from '@lms/ui';
import type { BlockView } from '../../data-access/lesson.store';

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  video: 'Video',
  pdf: 'Tài liệu PDF',
  text: 'Bài đọc',
  process: 'Quy trình',
  image: 'Hình ảnh',
  attachment: 'Tệp đính kèm',
};

/**
 * The lesson's blocks as one compact row, "Khối 2/3" and a select of the blocks, for the screens
 * where "Mục lục" is not beside the content (a narrow screen, or focus mode). Choosing a block moves
 * the study session to it. On a wide screen the blocks are listed in the outline instead.
 */
@Component({
  selector: 'app-block-list',
  imports: [Select],
  templateUrl: './block-list.html',
  styleUrl: './block-list.scss',
})
export class BlockList {
  readonly blocks = input.required<readonly BlockView[]>();
  readonly activeId = input<number | undefined>();

  readonly selected = output<number>();

  protected readonly typeLabel = BLOCK_TYPE_LABEL;

  /** 1-based place of the active block, 0 when none is active. */
  protected readonly position = computed(
    () => this.blocks().findIndex((b) => b.id === this.activeId()) + 1,
  );

  protected choose(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    if (id && id !== this.activeId()) this.selected.emit(id);
  }
}
