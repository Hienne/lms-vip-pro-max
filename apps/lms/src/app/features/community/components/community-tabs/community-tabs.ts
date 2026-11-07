import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** The four destinations of the community area, as a row of route links under the page title. */
@Component({
  selector: 'app-community-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './community-tabs.html',
  styleUrl: './community-tabs.scss',
})
export class CommunityTabs {
  protected readonly tabs = [
    { path: '/community/questions', label: 'Hỏi đáp' },
    { path: '/community/articles', label: 'Bài viết' },
    { path: '/community/reviews', label: 'Review kiến trúc' },
    { path: '/community/me', label: 'Của tôi' },
  ] as const;
}
