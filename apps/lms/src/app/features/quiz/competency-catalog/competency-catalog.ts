import { Component, computed, inject, Injectable, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { filter, take } from 'rxjs';
import { assessmentV1Endpoints as api } from '@lms/contracts';
import {
  Button,
  Field,
  Input,
  Select,
  PageHeader,
  Card,
  Alert,
  DataTable,
  DataTableCell,
  DrawerOutlet,
  FormActions,
  Menu,
  Empty,
  ErrorState,
  Icon,
  Badge,
  confirm,
  type MenuEntry,
} from '@lms/ui';
import { z } from 'zod';
import { EndpointClient } from '../../../core/http/endpoint-client';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { SessionStore } from '../../../core/session/session.store';

type Item = z.infer<typeof api.competencies.response>[number];
type Command = z.infer<typeof api.createCompetency.body>;
type Save = { item: Item | null; body: Command };
@Injectable()
export class CompetencyCatalogStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly state = {
    editing: signal<Item | null | undefined>(undefined),
    deleting: signal<Item | null>(null),
    page: signal(1),
    pageSize: signal(10),
  };
  private readonly data = serverData(() =>
    this.client.call(api.competencies, { query: {} }),
  );
  private readonly saveMutation = serverMutation(
    (input: Save) =>
      input.item
        ? this.client.call(api.updateCompetency, {
            params: { id: input.item.id },
            query: { expectedVersion: input.item.rowVersion },
            body: input.body,
          })
        : this.client.call(api.createCompetency, { body: input.body }),
    {
      errors: 'toast',
      success: () => 'Đã lưu nhóm năng lực',
      onSuccess: () => {
        this.state.editing.set(undefined);
        this.data.reload();
      },
    },
  );
  private readonly deleteMutation = serverMutation(
    (item: Item) =>
      this.client.call(api.deleteCompetency, {
        params: { id: item.id },
        query: { expectedVersion: item.rowVersion },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xóa nhóm năng lực',
      onSuccess: () => {
        this.state.deleting.set(null);
        this.state.page.set(1);
        this.data.reload();
      },
    },
  );
  readonly items$ = computed(() => this.data.value() ?? []);
  readonly rows$ = computed(() =>
    this.items$().slice(
      (this.state.page() - 1) * this.state.pageSize(),
      this.state.page() * this.state.pageSize(),
    ),
  );
  readonly page$ = this.state.page.asReadonly();
  readonly pageSize$ = this.state.pageSize.asReadonly();
  page(value: number): void {
    this.state.page.set(value);
  }
  pageSize(value: number): void {
    this.state.pageSize.set(value);
    this.state.page.set(1);
  }
  readonly error$ = this.data.error;
  readonly loading$ = this.data.isLoading;
  readonly editing$ = this.state.editing.asReadonly();
  readonly deleting$ = this.state.deleting.asReadonly();
  readonly busy$ = computed(
    () => this.saveMutation.isPending() || this.deleteMutation.isPending(),
  );
  readonly canEdit$ = computed(
    () => this.session.user$()?.scopeSummary === 'global',
  );
  edit(item: Item | null): void {
    this.state.editing.set(item);
  }
  cancel(): void {
    this.state.editing.set(undefined);
    this.state.deleting.set(null);
  }
  save(item: Item | null, body: Command): void {
    if (this.canEdit$() && !this.busy$()) this.saveMutation.run({ item, body });
  }
  askDelete(item: Item): void {
    confirm(this.dialog, {
      title: 'Xóa nhóm năng lực',
      message: `Xóa “${item.name}”? Nếu nhóm đang được sử dụng, hệ thống sẽ từ chối xóa.`,
      confirmLabel: 'Xóa',
      tone: 'danger',
    })
      .pipe(filter(Boolean), take(1))
      .subscribe(() => {
        this.state.deleting.set(item);
        this.remove();
      });
  }
  remove(): void {
    const item = this.state.deleting();
    if (item && this.canEdit$() && !this.busy$()) this.deleteMutation.run(item);
  }
  reload(): void {
    this.data.reload();
  }
}

@Component({
  selector: 'app-competency-catalog',
  imports: [
    RouterLink,
    Button,
    Field,
    Input,
    Select,
    PageHeader,
    Card,
    Alert,
    DataTable,
    DataTableCell,
    DrawerOutlet,
    FormActions,
    Menu,
    Empty,
    ErrorState,
    Icon,
    Badge,
  ],
  providers: [CompetencyCatalogStore],
  templateUrl: './competency-catalog.html',
  styleUrl: './competency-catalog.scss',
})
export class CompetencyCatalog {
  protected readonly store = inject(CompetencyCatalogStore);
  protected readonly actions: readonly MenuEntry<'edit' | 'delete'>[] = [
    { kind: 'item', value: 'edit', label: 'Sửa', icon: 'pen-line' },
    {
      kind: 'item',
      value: 'delete',
      label: 'Xóa',
      icon: 'trash-2',
      tone: 'danger',
    },
  ];
  protected act(item: Item, action: 'edit' | 'delete'): void {
    if (action === 'edit') this.open(item);
    else this.store.askDelete(item);
  }
  protected readonly model = signal<Command>({
    code: '',
    name: '',
    description: null,
    parentId: null,
    sortNo: 0,
    status: 'ACTIVE',
  });
  protected open(item: Item | null): void {
    this.model.set(
      item
        ? {
            code: item.code,
            name: item.name,
            description: item.description,
            parentId: item.parentId,
            sortNo: item.sortNo,
            status: item.status,
          }
        : {
            code: '',
            name: '',
            description: null,
            parentId: null,
            sortNo: 0,
            status: 'ACTIVE',
          },
    );
    this.store.edit(item);
  }
  protected change(key: keyof Command, value: string): void {
    this.model.update((m) => ({
      ...m,
      [key]: key === 'parentId' ? (value ? Number(value) : null) : value,
    }));
  }
  protected submit(): void {
    const item = this.store.editing$();
    if (
      item !== undefined &&
      this.model().code.trim() &&
      this.model().name.trim()
    )
      this.store.save(item, this.model());
  }
  protected name(id: number | null): string {
    return this.store.items$().find((item) => item.id === id)?.name ?? '—';
  }
}
