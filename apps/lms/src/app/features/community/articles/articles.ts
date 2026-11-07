import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Empty,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Search,
  Segmented,
  Select,
  Skeleton,
  type SegmentedOption,
} from '@lms/ui';
import { ContentRow } from '../components/content-row/content-row';
import { CommunityTagOptions } from '../data-access/community-tag-options';
import {
  ARTICLES_PAGE_SIZE,
  ArticlesStore,
  type ArticleType,
} from './data-access/articles.store';

/** Bài viết (CM-04): articles and lessons learned of the whole Ban. */
@Component({
  selector: 'app-community-articles',
  imports: [
    Button,
    ContentRow,
    Empty,
    ErrorState,
    Icon,
    PageHeader,
    Pagination,
    RouterLink,
    Search,
    Segmented,
    Select,
    Skeleton,
  ],
  providers: [ArticlesStore, CommunityTagOptions],
  templateUrl: './articles.html',
  styleUrl: './articles.scss',
})
export class CommunityArticles {
  protected readonly store = inject(ArticlesStore);
  protected readonly tags = inject(CommunityTagOptions);
  protected readonly pageSize = ARTICLES_PAGE_SIZE;
  protected readonly placeholders = [0, 1, 2, 3, 4];

  protected readonly types: readonly SegmentedOption<ArticleType>[] = [
    { value: 'article', label: 'Bài viết' },
    { value: 'lesson', label: 'Bài học sự cố' },
  ];
}
