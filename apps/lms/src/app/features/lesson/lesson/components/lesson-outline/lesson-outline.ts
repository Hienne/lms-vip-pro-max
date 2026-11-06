import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Icon, Tree, type IconName, type TreeNode } from '@lms/ui';
import type {
  BlockView,
  OutlineChapter,
  ProgressState,
} from '../../data-access/lesson.store';
import { BLOCK_TYPE_LABEL } from '../block-list/block-list';

/** What a tree row carries beyond its label: where it leads, its state and a small note. */
export interface OutlineNodeData {
  readonly kind: 'chapter' | 'lesson' | 'block' | 'final';
  readonly state?: ProgressState;
  readonly link?: string;
  readonly blockId?: number;
  readonly note?: string;
}

const BLOCK_ICON: Record<string, IconName> = {
  video: 'video',
  pdf: 'file',
};

const FINAL_ID = 'final';

/**
 * "Mục lục" as a tree: chapters, their lessons with the server's status, and the course's final
 * exam when it has one. Under the current lesson it lists that lesson's blocks, so moving between
 * blocks lives here and not in a strip above the content (SPEC-learning-ui). A lesson, the final
 * exam and a block open on selection; a chapter only folds and unfolds.
 */
@Component({
  selector: 'app-lesson-outline',
  imports: [Icon, Tree],
  templateUrl: './lesson-outline.html',
  styleUrl: './lesson-outline.scss',
})
export class LessonOutline {
  readonly chapters = input.required<readonly OutlineChapter[]>();
  /** The current lesson's blocks; listed only when there are two or more to move between. */
  readonly blocks = input<readonly BlockView[]>([]);
  readonly activeBlockId = input<number | undefined>();
  /** The course's `FINAL_EXAM`, when its revision has one: it must be passed to complete. */
  readonly finalQuizId = input<number | null>(null);

  readonly blockSelected = output<number>();

  private readonly router = inject(Router);
  private readonly tree = viewChild(Tree);

  private readonly showBlocks = computed(() => this.blocks().length > 1);

  protected readonly nodes = computed(
    (): readonly TreeNode<OutlineNodeData>[] => {
      const showBlocks = this.showBlocks();
      const chapters = this.chapters().map(
        (chapter): TreeNode<OutlineNodeData> => ({
          id: `chapter:${chapter.id}`,
          label: chapter.title,
          icon: 'layers',
          data: { kind: 'chapter' },
          children: chapter.lessons.map(
            (lesson): TreeNode<OutlineNodeData> => ({
              id: `lesson:${lesson.id}`,
              label: lesson.title,
              icon: lesson.quiz ? 'clipboard-check' : 'file-text',
              data: { kind: 'lesson', state: lesson.state, link: lesson.link },
              children:
                lesson.current && showBlocks
                  ? this.blocks().map(
                      (block): TreeNode<OutlineNodeData> => ({
                        id: `block:${block.id}`,
                        label: block.title,
                        icon:
                          BLOCK_ICON[block.detail.block.blockType] ??
                          'file-text',
                        data: {
                          kind: 'block',
                          state: block.status,
                          blockId: block.id,
                          note:
                            BLOCK_TYPE_LABEL[block.detail.block.blockType] +
                            (block.status === 'in_progress' && block.percent
                              ? ` · ${block.percent}%`
                              : ''),
                        },
                      }),
                    )
                  : undefined,
            }),
          ),
        }),
      );
      const finalQuizId = this.finalQuizId();
      return finalQuizId === null
        ? chapters
        : [
            ...chapters,
            {
              id: FINAL_ID,
              label: 'Bài thi cuối khóa',
              icon: 'trophy',
              data: { kind: 'final', link: `/quiz/${finalQuizId}` },
            },
          ];
    },
  );

  /** The row of what is on screen: the active block of a lesson with several, else the lesson. */
  protected readonly selectedId = computed(() => {
    const activeBlock = this.activeBlockId();
    if (this.showBlocks() && activeBlock !== undefined) {
      return `block:${activeBlock}`;
    }
    const current = this.chapters()
      .flatMap((chapter) => chapter.lessons)
      .find((lesson) => lesson.current);
    return current ? `lesson:${current.id}` : undefined;
  });

  /**
   * Every chapter and the current lesson start open. The learner's own folding lasts until the
   * chapters or the current lesson change.
   */
  protected readonly expanded = linkedSignal<readonly string[]>(() => [
    ...this.chapters().map((chapter) => `chapter:${chapter.id}`),
    ...this.chapters()
      .flatMap((chapter) => chapter.lessons)
      .filter((lesson) => lesson.current)
      .map((lesson) => `lesson:${lesson.id}`),
  ]);

  protected open(id: string | undefined): void {
    // What is already on screen stays: this also swallows the echo of putting the highlight back.
    if (id === undefined || id === this.selectedId()) return;
    const node = this.find(this.nodes(), id);
    switch (node?.data?.kind) {
      case 'block':
        this.blockSelected.emit(node.data.blockId as number);
        return;
      case 'lesson':
      case 'final':
        void this.router.navigateByUrl(node.data.link as string);
        return;
      default:
        // A chapter only folds: the highlight stays on what is on screen.
        this.tree()?.selected.set(this.selectedId());
        if (node) this.fold(id);
    }
  }

  private fold(id: string): void {
    const open = this.expanded();
    this.expanded.set(
      open.includes(id) ? open.filter((other) => other !== id) : [...open, id],
    );
  }

  private find(
    nodes: readonly TreeNode<OutlineNodeData>[],
    id: string,
  ): TreeNode<OutlineNodeData> | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      const inside = this.find(node.children ?? [], id);
      if (inside) return inside;
    }
    return undefined;
  }
}
