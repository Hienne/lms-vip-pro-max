import { Component } from '@angular/core';
import { Skeleton, Spinner } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { ConfirmDemo } from './components/confirm-demo/confirm-demo';
import { DrawerDemo } from './components/drawer-demo/drawer-demo';

@Component({
  selector: 'app-feedback-section',
  imports: [DsSection, DsDemo, Skeleton, Spinner, ConfirmDemo, DrawerDemo],
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {}
