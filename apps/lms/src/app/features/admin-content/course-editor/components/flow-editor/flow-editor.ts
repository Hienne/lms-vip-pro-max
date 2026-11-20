import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import {
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import {
  FlowKindSchema,
  type FlowKind,
  type FlowModel,
  type FlowStep,
} from '@lms/contracts';
import {
  Alert,
  Button,
  Card,
  Field,
  Icon,
  IconButton,
  Input,
  SectionCard,
  Select,
} from '@lms/ui';
import { FlowCanvas } from '../../../../../shared/flow/flow-canvas/flow-canvas';
import { FlowPlayer } from '../../../../../shared/flow/flow-player/flow-player';
import {
  FLOW_KIND_ICON,
  FLOW_KIND_LABEL,
  FLOW_WEBGL,
} from '../../../../../shared/flow/flow-support';
import { FlowEditorStore } from './data-access/flow-editor.store';
import { FlowStepForm } from './flow-step-form/flow-step-form';

const DRAG_TYPE = 'application/x-flow-kind';

/**
 * The author's editor of a Mô phỏng luồng block (variant A): the palette and the selected Đối tượng
 * on the left, the author-mode scene (or "Xem thử") in the centre, the Bước chuyển on the right.
 * It edits a copy in its store and reports every change through `flowChange`.
 */
@Component({
  selector: 'app-flow-editor',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Alert,
    Button,
    Card,
    Field,
    Icon,
    IconButton,
    Input,
    SectionCard,
    Select,
    FlowCanvas,
    FlowPlayer,
    FlowStepForm,
  ],
  providers: [FlowEditorStore],
  templateUrl: './flow-editor.html',
  styleUrl: './flow-editor.scss',
})
export class FlowEditor {
  readonly flow = input.required<FlowModel>();
  readonly flowChange = output<FlowModel>();

  protected readonly store = inject(FlowEditorStore);
  protected readonly webgl = inject(FLOW_WEBGL);
  protected readonly kinds = FlowKindSchema.options;
  protected readonly kindLabel = FLOW_KIND_LABEL;
  protected readonly kindIcon = FLOW_KIND_ICON;
  private readonly canvas = viewChild(FlowCanvas);

  constructor() {
    // The lesson form's value comes in; the store's edits go back out.
    effect(() => {
      const flow = this.flow();
      untracked(() => this.store.load(flow));
    });
    effect(() => {
      const flow = this.store.flow$();
      untracked(() => {
        if (flow !== this.flow()) this.flowChange.emit(flow);
      });
    });
  }

  protected route(step: FlowStep): string {
    return `${this.store.nameOf(step.from)} → ${
      step.to ? this.store.nameOf(step.to) : 'tự xử lý'
    }`;
  }

  protected dragKind(event: DragEvent, kind: FlowKind): void {
    event.dataTransfer?.setData(DRAG_TYPE, kind);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  protected allowDrop(event: DragEvent): void {
    if (event.dataTransfer?.types.includes(DRAG_TYPE)) event.preventDefault();
  }

  protected dropKind(event: DragEvent): void {
    const kind = FlowKindSchema.safeParse(
      event.dataTransfer?.getData(DRAG_TYPE),
    );
    if (!kind.success) return;
    event.preventDefault();
    const cell = this.canvas()?.floorAt(event.clientX, event.clientY);
    if (cell) this.store.addObject(kind.data, cell);
  }

  protected rename(id: string, event: Event): void {
    this.store.renameObject(id, (event.target as HTMLInputElement).value);
  }

  protected changeKind(id: string, event: Event): void {
    const kind = FlowKindSchema.safeParse(
      (event.target as HTMLSelectElement).value,
    );
    if (kind.success) this.store.setKind(id, kind.data);
  }

  protected reorder(event: CdkDragDrop<unknown>): void {
    this.store.moveStep(event.previousIndex, event.currentIndex);
  }

  protected saveStep(
    id: string,
    change: Pick<FlowStep, 'from' | 'to' | 'title' | 'description'>,
  ): void {
    this.store.updateStep(id, change);
    this.store.closeStep(true);
  }

  protected reframe(): void {
    this.canvas()?.fit();
  }
}
