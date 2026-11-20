import { Dialog } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FLOW_LIMITS,
  type FlowKind,
  type FlowModel,
  type FlowObject,
  type FlowStep,
} from '@lms/contracts';
import { confirm } from '@lms/ui';
import { filter, map } from 'rxjs';
import {
  emptyFlow,
  FLOW_EDITOR_WIDE_QUERY,
  FLOW_KIND_NAME,
  stepRouteShort,
} from '../../../../../../shared/flow/flow-support';

/** The free cells tried in order around the centre, two cells apart so plinths never touch. */
function* spiral(): Generator<{ x: number; z: number }> {
  for (let ring = 0; ring * 3 <= FLOW_LIMITS.grid; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === ring)
          yield { x: cellOf(dx), z: cellOf(dz) };
      }
    }
  }
}

/**
 * The document of one Mô phỏng luồng block while an author edits it. Every change goes through a
 * command here; the editor reports `flow$` back to the lesson form. A step made by a drag is "fresh"
 * until its form is saved, and cancelling it removes it.
 */
@Injectable()
export class FlowEditorStore {
  private readonly state = {
    flow: signal<FlowModel>(emptyFlow()),
    selectedId: signal<string | null>(null),
    editingStepId: signal<string | null>(null),
    freshStepId: signal<string | null>(null),
    previewIndex: signal<number | null>(null),
    previewing: signal(false),
  };

  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly flow$ = this.state.flow.asReadonly();
  readonly selectedId$ = this.state.selectedId.asReadonly();
  readonly editingStepId$ = this.state.editingStepId.asReadonly();
  readonly freshStepId$ = this.state.freshStepId.asReadonly();
  readonly previewIndex$ = this.state.previewIndex.asReadonly();
  readonly previewing$ = this.state.previewing.asReadonly();
  /** The step the author last clicked or linked: its packet runs in the editing scene. */
  readonly activeStep$ = computed(() => {
    const index = this.state.previewIndex();
    return index === null ? null : (this.state.flow().steps[index] ?? null);
  });
  /** The 3D editor needs the `lg` width; below it only the list and the form edit. */
  readonly wide$ = toSignal(
    inject(BreakpointObserver)
      .observe(FLOW_EDITOR_WIDE_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: true },
  );
  readonly objects$ = computed(() => this.state.flow().objects);
  readonly steps$ = computed(() => this.state.flow().steps);
  readonly selected$ = computed(
    () =>
      this.state.flow().objects.find((o) => o.id === this.state.selectedId()) ??
      null,
  );
  readonly canAddObject$ = computed(
    () => this.state.flow().objects.length < FLOW_LIMITS.objects,
  );
  readonly canAddStep$ = computed(
    () => this.state.flow().steps.length < FLOW_LIMITS.steps,
  );
  /** Each step with its route by names, as the step list shows it. */
  readonly rows$ = computed(() => {
    const flow = this.state.flow();
    return flow.steps.map((step) => ({
      step,
      route: stepRouteShort(flow, step),
    }));
  });
  readonly objectCount$ = computed(
    () =>
      `${this.state.flow().objects.length}/${FLOW_LIMITS.objects} đối tượng`,
  );
  readonly stepCount$ = computed(
    () =>
      `Bước chuyển (${this.state.flow().steps.length}/${FLOW_LIMITS.steps})`,
  );

  // ---- setters ----

  setFlow(flow: FlowModel): void {
    this.state.flow.set(flow);
  }

  setSelectedId(id: string | null): void {
    this.state.selectedId.set(id);
  }

  setEditingStepId(id: string | null): void {
    this.state.editingStepId.set(id);
  }

  setFreshStepId(id: string | null): void {
    this.state.freshStepId.set(id);
  }

  setPreviewIndex(index: number | null): void {
    this.state.previewIndex.set(index);
  }

  setPreviewing(previewing: boolean): void {
    this.state.previewing.set(previewing);
  }

  // ---- commands ----

  /** "Xem thử": plays the flow as a learner sees it, in place of the editing scene. */
  togglePreview(): void {
    this.setPreviewing(!this.state.previewing());
    this.closeStep(false);
  }

  /** Takes the document the lesson form holds, unless it is the one this store just reported. */
  load(flow: FlowModel): void {
    if (flow !== this.state.flow()) this.setFlow(flow);
  }

  nameOf(id: string): string {
    return this.state.flow().objects.find((o) => o.id === id)?.name ?? id;
  }

  /** Adds a Đối tượng at a cell, or at the next free spot; refused past 30 or on an occupied cell. */
  addObject(kind: FlowKind, cell?: { x: number; z: number }): string | null {
    const flow = this.state.flow();
    if (!this.canAddObject$()) return null;
    const at =
      cell && !this.occupied(cell) ? cell : cell ? null : this.freeCell();
    if (!at || !inGrid(at)) return null;
    const id = freshId(
      'o',
      flow.objects.map((o) => o.id),
    );
    const base = FLOW_KIND_NAME[kind];
    const taken = new Set(flow.objects.map((o) => o.name));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
    const object: FlowObject = {
      id,
      name,
      kind,
      x: at.x,
      z: at.z,
    };
    this.setFlow({ ...flow, objects: [...flow.objects, object] });
    this.setSelectedId(id);
    return id;
  }

  moveObject(id: string, x: number, z: number): void {
    if (!inGrid({ x, z }) || this.occupied({ x, z }, id)) return;
    this.patchObject(id, { x, z });
  }

  renameObject(id: string, name: string): void {
    this.patchObject(id, { name: name.slice(0, FLOW_LIMITS.name) });
  }

  setKind(id: string, kind: FlowKind): void {
    this.patchObject(id, { kind });
  }

  select(id: string | null): void {
    this.setSelectedId(id);
  }

  /** Deletes a Đối tượng; when steps use it, asks first and deletes them too. */
  removeObject(id: string): void {
    const object = this.state.flow().objects.find((o) => o.id === id);
    if (!object) return;
    const used = this.state
      .flow()
      .steps.filter((s) => s.from === id || s.to === id).length;
    if (!used) {
      this.dropObject(id);
      return;
    }
    confirm(this.dialog, {
      title: `Xóa “${object.name}”?`,
      message: `${used} bước chuyển có đối tượng này cũng sẽ bị xóa.`,
      confirmLabel: `Xóa đối tượng và ${used} bước`,
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dropObject(id));
  }

  /** A drag from one Đối tượng's port: a new fresh step whose form opens at once. */
  link(from: string, to: string | null): string | null {
    const flow = this.state.flow();
    if (!this.canAddStep$() || !flow.objects.some((o) => o.id === from))
      return null;
    if (to !== null && (to === from || !flow.objects.some((o) => o.id === to)))
      return null;
    const id = freshId(
      's',
      flow.steps.map((s) => s.id),
    );
    const step: FlowStep = {
      id,
      from,
      to,
      title: to
        ? `${this.nameOf(from)} gửi cho ${this.nameOf(to)}`
        : `${this.nameOf(from)} xử lý`,
      description: null,
    };
    this.setFlow({ ...flow, steps: [...flow.steps, step] });
    this.setFreshStepId(id);
    this.setEditingStepId(id);
    this.setPreviewIndex(flow.steps.length);
    return id;
  }

  /** "Thêm bước bằng form": a step between the first two Đối tượng, opened for editing. */
  addStepByForm(): void {
    const [a, b] = this.state.flow().objects;
    if (a) this.link(a.id, b?.id ?? null);
  }

  focusStep(index: number): void {
    this.setPreviewIndex(index);
  }

  editStep(id: string): void {
    this.setFreshStepId(null);
    this.setEditingStepId(id);
  }

  /** Closes the step form; a fresh step that was not saved is removed. */
  closeStep(saved: boolean): void {
    const fresh = this.state.freshStepId();
    if (!saved && fresh) this.dropStep(fresh);
    this.setFreshStepId(null);
    this.setEditingStepId(null);
  }

  updateStep(
    id: string,
    change: Partial<Pick<FlowStep, 'from' | 'to' | 'title' | 'description'>>,
  ): void {
    const flow = this.state.flow();
    this.setFlow({
      ...flow,
      steps: flow.steps.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...change };
        return next.to === next.from ? { ...next, to: null } : next;
      }),
    });
  }

  removeStep(id: string): void {
    if (this.state.editingStepId() === id) this.closeStep(false);
    this.dropStep(id);
  }

  moveStep(from: number, to: number): void {
    const flow = this.state.flow();
    const steps = [...flow.steps];
    const [moved] = steps.splice(from, 1);
    if (!moved) return;
    steps.splice(Math.max(0, Math.min(to, steps.length)), 0, moved);
    this.setFlow({ ...flow, steps });
  }

  /** Moves a step one place up or down: the keyboard way to reorder. */
  moveStepBy(id: string, by: -1 | 1): void {
    const index = this.state.flow().steps.findIndex((s) => s.id === id);
    if (index >= 0) this.moveStep(index, index + by);
  }

  // ---- helpers ----

  private patchObject(id: string, change: Partial<FlowObject>): void {
    const flow = this.state.flow();
    this.setFlow({
      ...flow,
      objects: flow.objects.map((o) => (o.id === id ? { ...o, ...change } : o)),
    });
  }

  private dropObject(id: string): void {
    const flow = this.state.flow();
    this.setFlow({
      ...flow,
      objects: flow.objects.filter((o) => o.id !== id),
      steps: flow.steps.filter((s) => s.from !== id && s.to !== id),
    });
    if (this.state.selectedId() === id) this.setSelectedId(null);
  }

  private dropStep(id: string): void {
    const flow = this.state.flow();
    this.setFlow({ ...flow, steps: flow.steps.filter((s) => s.id !== id) });
    if (this.state.editingStepId() === id) this.setEditingStepId(null);
    if (this.state.freshStepId() === id) this.setFreshStepId(null);
  }

  private occupied(cell: { x: number; z: number }, except?: string): boolean {
    return this.state
      .flow()
      .objects.some((o) => o.id !== except && o.x === cell.x && o.z === cell.z);
  }

  private freeCell(): { x: number; z: number } | null {
    for (const cell of spiral()) if (!this.occupied(cell)) return cell;
    return null;
  }
}

/** A spiral offset as a grid cell, three cells apart; `|| 0` turns -0 into 0. */
const cellOf = (offset: number) => offset * 3 || 0;

const inGrid = (cell: { x: number; z: number }) =>
  Math.abs(cell.x) <= FLOW_LIMITS.grid && Math.abs(cell.z) <= FLOW_LIMITS.grid;

function freshId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
