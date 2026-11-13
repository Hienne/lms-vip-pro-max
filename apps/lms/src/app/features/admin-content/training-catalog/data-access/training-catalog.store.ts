import { Dialog } from '@angular/cdk/dialog';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  trainingCatalogEndpoints,
  type CatalogStatus,
  type CatalogTreeCourse,
  type CatalogTreeField,
  type CatalogTreeProgram,
  type SaveCatalogItemCommand,
} from '@lms/contracts';
import { confirm, type IconName, type TreeNode } from '@lms/ui';
import { filter, type Observable } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/** What a node of the tree stands for. A course is shown here and edited on its own screens. */
export type CatalogNode =
  | { readonly kind: 'field'; readonly field: CatalogTreeField }
  | {
      readonly kind: 'program';
      readonly field: CatalogTreeField;
      readonly program: CatalogTreeProgram;
    }
  | {
      readonly kind: 'course';
      readonly field: CatalogTreeField;
      readonly program: CatalogTreeProgram;
      readonly course: CatalogTreeCourse;
    };

/** The add/edit drawer: a field, or a program under `fieldId`. `item` is `null` when adding. */
export type CatalogEditing =
  | { readonly kind: 'field'; readonly item: CatalogTreeField | null }
  | {
      readonly kind: 'program';
      readonly fieldId: number;
      readonly item: CatalogTreeProgram | null;
    };

/** What the drawer form hands back: everything but the owner org, which the store adds. */
export type SaveCatalogItem = Omit<SaveCatalogItemCommand, 'ownerOrgId'>;

/** A field or a program, which share the shape of what a PUT needs. */
type Editable = CatalogTreeField | CatalogTreeProgram;

const ICON: Record<CatalogNode['kind'], IconName> = {
  field: 'layers',
  program: 'network',
  course: 'book-open',
};

export const NODE_NOUN = {
  field: 'lĩnh vực',
  program: 'chương trình',
  course: 'khóa học',
} as const;

const fieldId = (id: number) => `field-${id}`;
const programId = (id: number) => `program-${id}`;
const courseId = (id: number) => `course-${id}`;

/**
 * The training catalogue (the mockup's `adminCatalog`): the fields, programs and courses of the
 * caller's org as one tree with a detail panel. The tree comes in one call; a field or program
 * changes status through the same PUT as an edit, is copied (programs) or deleted when empty and
 * archived otherwise. A course is edited, copied and paused on the course screens, so its node
 * only links there.
 */
@Injectable()
export class TrainingCatalogStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = {
    /** Ids of the nodes opened by hand. */
    expanded: signal<readonly string[]>([]),
    selectedId: signal<string | undefined>(undefined),
    search: signal(''),
    editing: signal<CatalogEditing | null>(null),
  };

  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  private readonly changes = invalidation();

  private readonly treeData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.tree, {
        query: { ownerOrgId },
      }),
    { params: () => this.orgId(), reloadOn: this.changes },
  );

  private readonly saveMutation = serverMutation(
    (input: { editing: CatalogEditing; command: SaveCatalogItem }) =>
      this.send(input.editing, input.command),
    {
      errors: 'toast',
      success: ({ editing }) =>
        editing.item
          ? `Đã cập nhật ${NODE_NOUN[editing.kind]}`
          : `Đã thêm ${NODE_NOUN[editing.kind]}`,
      onSuccess: (saved) => {
        const editing = this.state.editing();
        this.setEditing(null);
        if (editing?.item === null) {
          this.setSelectedId(
            editing.kind === 'field' ? fieldId(saved.id) : programId(saved.id),
          );
        }
      },
      invalidates: this.changes,
    },
  );

  private readonly statusMutation = serverMutation(
    (input: { node: CatalogNode; status: CatalogStatus }) =>
      this.putStatus(input.node, input.status),
    {
      errors: 'toast',
      success: ({ status }) => STATUS_DONE[status],
      invalidates: this.changes,
    },
  );

  private readonly copyMutation = serverMutation(
    (program: CatalogTreeProgram) =>
      this.client.call(trainingCatalogEndpoints.copyProgram, {
        params: { id: program.id },
      }),
    {
      errors: 'toast',
      success: (_, copy) => ({
        title: 'Đã sao chép',
        detail: `Bản sao ở trạng thái Nháp: ${copy.name}`,
      }),
      onSuccess: (copy) => this.setSelectedId(programId(copy.id)),
      invalidates: this.changes,
    },
  );

  private readonly deleteMutation = serverMutation(
    (node: CatalogNode) => this.remove(node),
    {
      errors: 'toast',
      success: () => 'Đã xóa',
      onSuccess: () => this.setSelectedId(undefined),
      invalidates: this.changes,
    },
  );

  // Selectors
  readonly search$ = this.state.search.asReadonly();
  readonly editing$ = this.state.editing.asReadonly();
  readonly fields$ = computed(() => this.treeData.value()?.fields ?? []);

  readonly isLoading$ = this.treeData.isLoading;
  readonly loadError$ = this.treeData.error;
  readonly isBusy$ = computed(
    () =>
      this.saveMutation.isPending() ||
      this.statusMutation.isPending() ||
      this.copyMutation.isPending() ||
      this.deleteMutation.isPending(),
  );
  readonly isSaving$ = this.saveMutation.isPending;

  /** Every node by id, to find the selected one and the ancestors of a match. */
  private readonly index = computed(() => {
    const index = new Map<string, CatalogNode>();
    for (const field of this.fields$()) {
      index.set(fieldId(field.id), { kind: 'field', field });
      for (const program of field.programs) {
        index.set(programId(program.id), { kind: 'program', field, program });
        for (const course of program.courses) {
          index.set(courseId(course.id), {
            kind: 'course',
            field,
            program,
            course,
          });
        }
      }
    }
    return index;
  });

  private readonly allNodes = computed((): readonly TreeNode<CatalogNode>[] =>
    this.fields$().map((field) => ({
      id: fieldId(field.id),
      label: field.name,
      icon: ICON.field,
      data: this.index().get(fieldId(field.id)),
      children: field.programs.map((program) => ({
        id: programId(program.id),
        label: program.name,
        icon: ICON.program,
        data: this.index().get(programId(program.id)),
        children: program.courses.map((course) => ({
          id: courseId(course.id),
          label: course.title,
          icon: ICON.course,
          data: this.index().get(courseId(course.id)),
        })),
      })),
    })),
  );

  /** The tree cut to the search text: a match keeps its ancestors, and its own children. */
  readonly nodes$ = computed((): readonly TreeNode<CatalogNode>[] => {
    const query = this.state.search().trim().toLowerCase();
    return query
      ? prune(this.allNodes(), query, this.index())
      : this.allNodes();
  });

  /** The nodes the user opened, plus every node with a match below it while searching. */
  readonly expanded$ = computed((): readonly string[] => {
    const manual = this.state.expanded();
    if (!this.state.search().trim()) return manual;
    const open = new Set(manual);
    const visit = (nodes: readonly TreeNode<CatalogNode>[]) => {
      for (const node of nodes) {
        if (node.children?.length) {
          open.add(node.id);
          visit(node.children);
        }
      }
    };
    visit(this.nodes$());
    return [...open];
  });

  /** The picked node, or the first field until one is picked (or when the picked one is gone). */
  readonly selectedId$ = computed((): string | undefined => {
    const id = this.state.selectedId();
    if (id !== undefined && this.index().has(id)) return id;
    const first = this.fields$()[0];
    return first ? fieldId(first.id) : undefined;
  });

  readonly selected$ = computed((): CatalogNode | undefined => {
    const id = this.selectedId$();
    return id === undefined ? undefined : this.index().get(id);
  });

  readonly editorTitle$ = computed(() => {
    const editing = this.state.editing();
    if (!editing) return '';
    return editing.item
      ? `Sửa ${NODE_NOUN[editing.kind]} ${editing.item.code}`
      : `Thêm ${NODE_NOUN[editing.kind]}`;
  });

  // Setters
  private setExpanded(ids: readonly string[]): void {
    this.state.expanded.set(ids);
  }

  private setSelectedId(id: string | undefined): void {
    this.state.selectedId.set(id);
  }

  private setSearch(text: string): void {
    this.state.search.set(text);
  }

  private setEditing(editing: CatalogEditing | null): void {
    this.state.editing.set(editing);
  }

  // Commands
  expand(ids: readonly string[]): void {
    this.setExpanded(ids);
  }

  select(id: string | undefined): void {
    this.setSelectedId(id);
  }

  search(text: string): void {
    this.setSearch(text);
  }

  /** Opens the drawer to add a field (no field given) or a program under `field`. */
  add(field?: CatalogTreeField): void {
    this.saveMutation.reset();
    this.setEditing(
      field
        ? { kind: 'program', fieldId: field.id, item: null }
        : { kind: 'field', item: null },
    );
  }

  edit(node: CatalogNode): void {
    if (node.kind === 'course') return;
    this.saveMutation.reset();
    this.setEditing(
      node.kind === 'field'
        ? { kind: 'field', item: node.field }
        : { kind: 'program', fieldId: node.field.id, item: node.program },
    );
  }

  cancelEdit(): void {
    this.setEditing(null);
  }

  save(command: SaveCatalogItem): void {
    const editing = this.state.editing();
    if (!editing) return;
    this.saveMutation.run({ editing, command });
  }

  /** Asks first; publishing and resuming say who sees the change, pausing and archiving what stays. */
  changeStatus(node: CatalogNode, status: CatalogStatus): void {
    if (node.kind === 'course') return;
    const copy = STATUS_CONFIRM[status];
    confirm(this.dialog, {
      title: `${copy.verb} ${NODE_NOUN[node.kind]} này?`,
      message: copy.message,
      confirmLabel: copy.verb,
      tone: status === 'published' ? 'primary' : 'warning',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.statusMutation.run({ node, status }));
  }

  copyProgram(program: CatalogTreeProgram): void {
    this.copyMutation.run(program);
  }

  /** Asks first. Only an empty field or program is offered; the server checks again. */
  delete(node: CatalogNode): void {
    if (node.kind === 'course') return;
    confirm(this.dialog, {
      title: `Xóa ${NODE_NOUN[node.kind]} này?`,
      message:
        'Thao tác không thể hoàn tác. Hệ thống sẽ chặn xóa nếu còn mục con hoặc nội dung đang dùng; khi đó hãy chuyển sang Lưu trữ.',
      confirmLabel: 'Xóa',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.deleteMutation.run(node));
  }

  retryLoad(): void {
    this.treeData.reload();
  }

  private send(
    editing: CatalogEditing,
    command: SaveCatalogItem,
  ): Observable<{ readonly id: number }> {
    const body: SaveCatalogItemCommand = {
      ...command,
      ownerOrgId: this.orgId() ?? 0,
      ...(editing.kind === 'program' ? { fieldId: editing.fieldId } : {}),
      ...(editing.item?.sortNo != null ? { sortNo: editing.item.sortNo } : {}),
    };
    if (editing.kind === 'field') {
      return editing.item
        ? this.client.call(trainingCatalogEndpoints.updateField, {
            params: { id: editing.item.id },
            query: { expectedVersion: editing.item.rowVersion },
            body,
          })
        : this.client.call(trainingCatalogEndpoints.createField, { body });
    }
    return editing.item
      ? this.client.call(trainingCatalogEndpoints.updateProgram, {
          params: { id: editing.item.id },
          query: { expectedVersion: editing.item.rowVersion },
          body,
        })
      : this.client.call(trainingCatalogEndpoints.createProgram, { body });
  }

  /** A status change is the update PUT with the row as the tree last read it. */
  private putStatus(
    node: CatalogNode,
    status: CatalogStatus,
  ): Observable<unknown> {
    if (node.kind === 'course') {
      throw new Error('A course changes state on the course screens.');
    }
    const item: Editable = node.kind === 'field' ? node.field : node.program;
    const body: SaveCatalogItemCommand = {
      ownerOrgId: item.ownerOrgId,
      code: item.code,
      name: item.name,
      status,
      ...(item.description ? { description: item.description } : {}),
      ...(item.sortNo != null ? { sortNo: item.sortNo } : {}),
      ...(node.kind === 'program' ? { fieldId: node.program.fieldId } : {}),
    };
    const update = {
      params: { id: item.id },
      query: { expectedVersion: item.rowVersion },
      body,
    };
    return node.kind === 'field'
      ? this.client.call(trainingCatalogEndpoints.updateField, update)
      : this.client.call(trainingCatalogEndpoints.updateProgram, update);
  }

  private remove(node: CatalogNode): Observable<null> {
    if (node.kind === 'field') {
      return this.client.call(trainingCatalogEndpoints.deleteField, {
        params: { id: node.field.id },
        query: { expectedVersion: node.field.rowVersion },
      });
    }
    if (node.kind === 'program') {
      return this.client.call(trainingCatalogEndpoints.deleteProgram, {
        params: { id: node.program.id },
        query: { expectedVersion: node.program.rowVersion },
      });
    }
    throw new Error('A course is not deleted from the catalogue tree.');
  }
}

const STATUS_DONE: Record<CatalogStatus, string> = {
  draft: 'Đã chuyển về nháp',
  published: 'Đã xuất bản',
  paused: 'Đã tạm dừng',
  archived: 'Đã lưu trữ',
};

const STATUS_CONFIRM: Record<
  CatalogStatus,
  { readonly verb: string; readonly message: string }
> = {
  draft: {
    verb: 'Chuyển về nháp',
    message:
      'Chuyển về nháp sẽ chặn học và làm bài kiểm tra của các khóa thuộc danh mục này, kể cả học viên đã được giao khóa. Tiến độ và lịch sử được giữ nguyên.',
  },
  published: {
    verb: 'Xuất bản',
    message:
      'Học viên trong phạm vi được giao sẽ nhìn thấy nội dung ngay lập tức, không cần triển khai lại website.',
  },
  paused: {
    verb: 'Tạm dừng',
    message:
      'Tạm dừng sẽ chặn học và làm bài kiểm tra của các khóa thuộc danh mục này, kể cả học viên đang học. Tiến độ được giữ nguyên; xuất bản lại danh mục để mở học.',
  },
  archived: {
    verb: 'Lưu trữ',
    message:
      'Lưu trữ sẽ chặn học và làm bài kiểm tra của các khóa thuộc danh mục này, kể cả học viên đang học. Tiến độ và lịch sử được giữ nguyên; xuất bản lại danh mục để mở học.',
  },
};

/** Keeps the nodes whose label or code matches, and every ancestor of one. */
function prune(
  nodes: readonly TreeNode<CatalogNode>[],
  query: string,
  index: ReadonlyMap<string, CatalogNode>,
): TreeNode<CatalogNode>[] {
  const matches = (node: TreeNode<CatalogNode>) => {
    const data = index.get(node.id);
    const code =
      data?.kind === 'field'
        ? data.field.code
        : data?.kind === 'program'
          ? data.program.code
          : data?.kind === 'course'
            ? data.course.code
            : '';
    return `${node.label} ${code}`.toLowerCase().includes(query);
  };
  return nodes.flatMap((node) => {
    if (matches(node)) return [node];
    const children = prune(node.children ?? [], query, index);
    return children.length ? [{ ...node, children }] : [];
  });
}
