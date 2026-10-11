import { Component } from '@angular/core';
import { Icon } from '@lms/ui';
import { DsSection } from '../section/section';
import { CHANGE_LOG, PRINCIPLES } from './data-access/principles';

@Component({
  selector: 'app-principles-section',
  imports: [DsSection, Icon],
  templateUrl: './principles-section.html',
})
export class PrinciplesSection {
  protected readonly principles = PRINCIPLES;
  protected readonly changeLog = CHANGE_LOG;
}
