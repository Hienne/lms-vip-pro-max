import { Component } from '@angular/core';
import { Alert, AlertAction, Button, Skeleton, Spinner, Tip } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { MenuDemo } from './menu-demo/menu-demo';

@Component({
  selector: 'app-feedback-section',
<<<<<<< HEAD
  imports: [DsSection, DsDemo, Skeleton, Spinner, MenuDemo],
=======
  imports: [
    DsSection,
    DsDemo,
    Alert,
    AlertAction,
    Button,
    Skeleton,
    Spinner,
    Tip,
  ],
>>>>>>> integration/base-libraries
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {}
