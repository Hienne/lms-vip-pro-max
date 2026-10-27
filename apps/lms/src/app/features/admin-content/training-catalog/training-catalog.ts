import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  DataTableCell,
  DrawerOutlet,
  Empty,
  ErrorState,
  FormActions,
  Icon,
  PageHeader,
  Select,
  Spinner,
  TablePrimary,
  TableSub,
  TabPanel,
  Tabs,
  type TabItem,
} from '@lms/ui';
import { CatalogStatus } from '../../../shared/status/catalog-status';
import { CatalogItemForm } from './components/catalog-item-form/catalog-item-form';
import { TrainingCatalogStore } from './data-access/training-catalog.store';

/**
 * The training catalogue (the mockup's `adminCatalog`): the fields, business modules and programs
 * courses are filed under. The backend keeps three flat lists, so the mockup's tree becomes three
 * tabs; courses are managed on their own screen.
 */
@Component({
  selector: 'app-training-catalog',
  imports: [
    Button,
    Card,
    CardHeader,
    CatalogItemForm,
    CatalogStatus,
    DataTable,
    DataTableCell,
    DrawerOutlet,
    Empty,
    ErrorState,
    FormActions,
    Icon,
    NgTemplateOutlet,
    PageHeader,
    Select,
    Spinner,
    TablePrimary,
    TableSub,
    TabPanel,
    Tabs,
  ],
  providers: [TrainingCatalogStore],
  templateUrl: './training-catalog.html',
  styleUrl: './training-catalog.scss',
})
export class TrainingCatalog {
  protected readonly store = inject(TrainingCatalogStore);

  protected readonly tabs = computed((): readonly TabItem[] => {
    const counts = this.store.counts$();
    return [
      { id: 'fields', label: 'Lĩnh vực', count: counts.fields },
      { id: 'modules', label: 'Phân hệ', count: counts.modules },
      { id: 'programs', label: 'Chương trình', count: counts.programs },
    ];
  });
}
