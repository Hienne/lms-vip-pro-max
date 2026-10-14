import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button, Empty, Icon } from '@lms/ui';

/**
 * The 404 page (the mockup's `notFound`), the target of the wildcard route. The wildcard consumes
 * every segment, so the route's own URL is the path the visitor asked for.
 */
@Component({
  selector: 'app-not-found',
  imports: [Empty, Button, Icon, RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {
  protected readonly description = `Đường dẫn "/${inject(ActivatedRoute)
    .snapshot.url.map((segment) => segment.path)
    .join('/')}" không tồn tại hoặc đã bị thay đổi.`;
}
