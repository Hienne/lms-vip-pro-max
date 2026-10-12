import { Component } from '@angular/core';
import {
  Alert,
  AlertAction,
  Button,
  Card,
  Empty,
  ErrorState,
  Skeleton,
  Spinner,
  Tip,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { ConfirmDemo } from './components/confirm-demo/confirm-demo';
import { DrawerDemo } from './components/drawer-demo/drawer-demo';
import { MenuDemo } from './menu-demo/menu-demo';

@Component({
  selector: 'app-feedback-section',
  imports: [
    DsSection,
    DsDemo,
    Alert,
    AlertAction,
    Button,
    Card,
    Empty,
    ErrorState,
    Skeleton,
    Spinner,
    Tip,
    MenuDemo,
    ConfirmDemo,
    DrawerDemo,
  ],
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {}
