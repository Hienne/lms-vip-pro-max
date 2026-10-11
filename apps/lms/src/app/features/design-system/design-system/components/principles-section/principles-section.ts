import { Component } from '@angular/core';
import { Card, CardHeader, Icon, Table, TableWrap } from '@lms/ui';
import { DsSection } from '../section/section';
import { CHANGE_LOG, PRINCIPLES } from './data-access/principles';

@Component({
  selector: 'app-principles-section',
  imports: [DsSection, Icon, Card, CardHeader, Table, TableWrap],
  templateUrl: './principles-section.html',
})
export class PrinciplesSection {
  protected readonly principles = PRINCIPLES;
  protected readonly changeLog = CHANGE_LOG;
}
