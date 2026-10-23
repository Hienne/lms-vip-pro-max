import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  trainingCatalogEndpoints,
  type BusinessModule,
  type SaveCatalogItemCommand,
  type TrainingField,
  type TrainingProgram,
} from '@lms/contracts';
import type { Observable } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/** The three lists of the screen, one per tab. */
export type CatalogKind = 'fields' | 'modules' | 'programs';

/** A row of any tab, as the table and the form read it. */
export type CatalogItem = (TrainingField | BusinessModule | TrainingProgram) & {
  readonly description?: string | null;
  readonly fieldId?: number | null;
};

export interface CatalogRow {
  readonly id: string;
  readonly item: CatalogItem;
  /** The parent field's name: the module's, or the program's when it has one. */
  readonly fieldName: string;
}

export interface CatalogEditing {
  readonly kind: CatalogKind;
  /** `null` adds a new row. */
  readonly item: CatalogItem | null;
}

export interface SaveCatalogItem {
  readonly kind: CatalogKind;
  readonly item: CatalogItem | null;
  /** Everything but the owner org, which the store adds. */
  readonly command: Omit<SaveCatalogItemCommand, 'ownerOrgId'>;
}

const NOUN: Record<CatalogKind, string> = {
  fields: 'lĩnh vực',
  modules: 'phân hệ',
  programs: 'chương trình',
};

/** One page holds every row: the catalogue of one org is a few dozen entries. */
const ALL = 100;

/**
 * The training catalogue (the mockup's `adminCatalog`): fields, business modules and programs of
 * the caller's org, each a flat list the server keeps. Rows are added and edited, never deleted
 * (the backend has no delete); a status change is an edit.
 */
@Injectable()
export class TrainingCatalogStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);

  private readonly state = {
    tab: signal<CatalogKind>('fields'),
    /** Modules are listed per field: the first field until another is picked. */
    moduleFieldId: linkedSignal<number | undefined>(
      () => this.fieldsData.value()?.items[0]?.id,
    ),
    editing: signal<CatalogEditing | null>(null),
  };

  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  private readonly changes = invalidation();

  private readonly fieldsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listFields, {
        query: { ownerOrgId, size: ALL },
      }),
    { params: () => this.orgId(), reloadOn: this.changes },
  );

  private readonly programsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listPrograms, {
        query: { ownerOrgId, size: ALL },
      }),
    { params: () => this.orgId(), reloadOn: this.changes },
  );

  private readonly modulesData = serverData(
    (fieldId: number) =>
      this.client.call(trainingCatalogEndpoints.listModules, {
        query: { fieldId, size: ALL },
      }),
    { params: () => this.state.moduleFieldId(), reloadOn: this.changes },
  );

  private readonly saveMutation = serverMutation(
    (input: SaveCatalogItem) => this.send(input),
    {
      errors: 'toast',
      success: ({ kind, item }) =>
        item ? `Đã cập nhật ${NOUN[kind]}` : `Đã thêm ${NOUN[kind]}`,
      onSuccess: () => this.setEditing(null),
      invalidates: this.changes,
    },
  );

  // Selectors
  readonly tab$ = this.state.tab.asReadonly();
  readonly moduleFieldId$ = this.state.moduleFieldId.asReadonly();
  readonly editing$ = this.state.editing.asReadonly();

  readonly fields$ = computed(() => this.fieldsData.value()?.items ?? []);

  private readonly fieldNames = computed(
    () => new Map(this.fields$().map((f) => [f.id, f.name])),
  );

  private readonly current = computed(() => {
    switch (this.state.tab()) {
      case 'fields':
        return this.fieldsData;
      case 'modules':
        return this.modulesData;
      case 'programs':
        return this.programsData;
    }
  });

  readonly rows$ = computed((): readonly CatalogRow[] =>
    ((this.current().value()?.items ?? []) as readonly CatalogItem[]).map(
      (item) => ({
        id: String(item.id),
        item,
        fieldName: (item.fieldId && this.fieldNames().get(item.fieldId)) || '',
      }),
    ),
  );

  readonly counts$ = computed(() => ({
    fields: this.fieldsData.value()?.totalElements,
    modules: this.modulesData.value()?.totalElements,
    programs: this.programsData.value()?.totalElements,
  }));

  readonly isLoading$ = computed(
    () => this.fieldsData.isLoading() || this.current().isLoading(),
  );
  readonly loadError$ = computed(
    () => this.fieldsData.error() ?? this.current().error(),
  );
  readonly isSaving$ = this.saveMutation.isPending;

  readonly noun$ = computed(() => NOUN[this.state.tab()]);
  readonly editorTitle$ = computed(() => {
    const editing = this.state.editing();
    if (!editing) return '';
    return editing.item
      ? `Sửa ${NOUN[editing.kind]} ${editing.item.code}`
      : `Thêm ${NOUN[editing.kind]}`;
  });

  // Setters
  private setTab(tab: CatalogKind): void {
    this.state.tab.set(tab);
  }

  private setModuleFieldId(fieldId: number | undefined): void {
    this.state.moduleFieldId.set(fieldId);
  }

  private setEditing(editing: CatalogEditing | null): void {
    this.state.editing.set(editing);
  }

  // Commands
  showTab(tab: string): void {
    if (tab === 'fields' || tab === 'modules' || tab === 'programs') {
      this.setTab(tab);
    }
  }

  showModulesOf(value: string): void {
    const id = Number(value);
    this.setModuleFieldId(Number.isInteger(id) && id > 0 ? id : undefined);
  }

  /** Opens the add (`null`) or edit drawer for the current tab. */
  edit(item: CatalogItem | null): void {
    this.saveMutation.reset();
    this.setEditing({ kind: this.state.tab(), item });
  }

  cancelEdit(): void {
    this.setEditing(null);
  }

  save(input: SaveCatalogItem): void {
    this.saveMutation.run(input);
  }

  retryLoad(): void {
    this.fieldsData.reload();
    this.current().reload();
  }

  private send({ kind, item, command }: SaveCatalogItem): Observable<unknown> {
    const body: SaveCatalogItemCommand = {
      ...command,
      ownerOrgId: this.orgId() ?? 0,
    };
    const update = item
      ? {
          params: { id: item.id },
          query: { expectedVersion: item.rowVersion },
          body,
        }
      : undefined;
    switch (kind) {
      case 'fields':
        return update
          ? this.client.call(trainingCatalogEndpoints.updateField, update)
          : this.client.call(trainingCatalogEndpoints.createField, { body });
      case 'modules':
        return update
          ? this.client.call(trainingCatalogEndpoints.updateModule, update)
          : this.client.call(trainingCatalogEndpoints.createModule, { body });
      case 'programs':
        return update
          ? this.client.call(trainingCatalogEndpoints.updateProgram, update)
          : this.client.call(trainingCatalogEndpoints.createProgram, { body });
    }
  }
}
