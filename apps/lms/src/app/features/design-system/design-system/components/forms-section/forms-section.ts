import { Component } from '@angular/core';
import { Checkbox, Input, Select, Switch, Textarea } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-forms-section',
  imports: [DsSection, DsDemo, Input, Select, Textarea, Checkbox, Switch],
  templateUrl: './forms-section.html',
})
export class FormsSection {}
