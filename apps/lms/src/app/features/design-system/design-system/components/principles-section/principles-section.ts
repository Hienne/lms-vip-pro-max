import { Component } from '@angular/core';
import { Card, CardHeader, Table, TableWrap } from '@lms/ui';
import { DsSection } from '../section/section';
import { CHANGE_LOG, PRINCIPLES } from './data-access/principles';

@Component({
  selector: 'app-principles-section',
  imports: [DsSection, Card, CardHeader, Table, TableWrap],
  templateUrl: './principles-section.html',
  styleUrl: './principles-section.scss',
})
export class PrinciplesSection {
  protected readonly principles = PRINCIPLES;
  protected readonly changeLog = CHANGE_LOG;
}
