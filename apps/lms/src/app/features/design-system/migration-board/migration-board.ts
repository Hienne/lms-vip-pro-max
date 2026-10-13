import { Component } from '@angular/core';
import { Table, TableWrap } from '@lms/ui';
import { STATUS_LABEL, STATUS_ORDER } from '../data-access/migration-registry';
import { buildBoard } from './data-access/board-view';

/**
 * Progress board of the migration checklist: development and staging only
 * (registered when `devTools` is true, see app.routes.ts).
 */
@Component({
  selector: 'app-migration-board',
  imports: [Table, TableWrap],
  templateUrl: './migration-board.html',
  styleUrl: './migration-board.scss',
})
export class MigrationBoard {
  protected readonly board = buildBoard();
  protected readonly statuses = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
  }));
}
