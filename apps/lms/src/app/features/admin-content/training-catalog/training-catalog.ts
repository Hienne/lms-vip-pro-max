import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Card,
  CardHeader,
  DrawerOutlet,
  Empty,
  ErrorState,
  FormActions,
  Icon,
  PageHeader,
  Pagination,
  Search,
  Spinner,
  Tree,
} from '@lms/ui';
import {
  CatalogStatus,
  courseCatalogStatus,
} from '../../../shared/status/catalog-status';
import { CatalogItemForm } from './components/catalog-item-form/catalog-item-form';
import {
  NODE_NOUN,
  TrainingCatalogStore,
} from './data-access/training-catalog.store';

/**
 * The training catalogue (the mockup's `adminCatalog`): the tree Lĩnh vực → Chương trình → Khóa
 * học with a detail panel for the picked node. Fields and programs are added, edited, published,
 * paused, archived and (when empty) deleted here, programs are copied; courses have their own
 * screens and are linked.
 */
@Component({
  selector: 'app-training-catalog',
  imports: [
    Button,
    Card,
    CardHeader,
    CatalogItemForm,
    CatalogStatus,
    DrawerOutlet,
    Empty,
    ErrorState,
    FormActions,
    Icon,
    PageHeader,
    Pagination,
    RouterLink,
    Search,
    Spinner,
    Tree,
  ],
  providers: [TrainingCatalogStore],
  templateUrl: './training-catalog.html',
  styleUrl: './training-catalog.scss',
})
export class TrainingCatalog {
  protected readonly store = inject(TrainingCatalogStore);
  protected readonly noun = NODE_NOUN;
  protected readonly courseStatus = courseCatalogStatus;
}
