import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Input,
  PageHeader,
  SectionCard,
  Skeleton,
  TabPanel,
  Tabs,
  type TabItem,
} from '@lms/ui';
import { GuideStore } from './data-access/guide.store';

/**
 * `/tro-ly-ngoai`: how to connect a Trợ lý ngoài with one URL (ADR 0005), for Claude App and Claude
 * Code, and the questions authors ask about it. Steps are words and copyable commands, no
 * screenshots: Claude's own screens change too often for pictures to stay right.
 */
@Component({
  selector: 'app-external-assistant-guide',
  imports: [
    Button,
    Empty,
    ErrorState,
    Field,
    Icon,
    IconButton,
    Input,
    PageHeader,
    RouterLink,
    SectionCard,
    Skeleton,
    TabPanel,
    Tabs,
  ],
  providers: [GuideStore],
  templateUrl: './guide.html',
  styleUrl: './guide.scss',
})
export class Guide {
  protected readonly store = inject(GuideStore);

  protected readonly tabs: readonly TabItem[] = [
    { id: 'claude-app', label: 'Claude App' },
    { id: 'claude-code', label: 'Claude Code' },
  ];
}
