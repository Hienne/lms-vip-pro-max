import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { AppTitleStrategy } from './page-title.strategy';

@Component({ template: '' })
class Page {}

describe('AppTitleStrategy', () => {
  async function navigate(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'catalog', title: 'Danh mục khóa học', component: Page },
          { path: 'plain', component: Page },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
  }

  it('appends the app name to the route title', async () => {
    await navigate('/catalog');
    expect(document.title).toBe('Danh mục khóa học · CHAN Academy');
  });

  it('falls back to the app name for a route without a title', async () => {
    await navigate('/plain');
    expect(document.title).toBe('CHAN Academy');
  });
});
