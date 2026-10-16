# Angular v22 Conventions & Guardrails

These rules apply to every Angular v22 project. When this file conflicts with a
project's own README or architecture doc, the project doc wins for that project.

**Verify before writing.** Use the APIs exported by the installed `@angular/*`
packages. Check the local type definitions instead of copying syntax from
older Angular versions or from memory.

---

## 1. Framework defaults (v22)

- **Standalone only.** No `NgModule`. Do not write `standalone: true`, because it is the default.
- **Zoneless.** Do not add `zone.js` or `provideZoneChangeDetection()`. UI updates
  come from signals, inputs, template events, and `async` pipe, never from
  `setTimeout` or other zone-triggered refreshes.
- **OnPush is the default.** Do not write `changeDetection` at all. Never use
  `ChangeDetectionStrategy.Eager`.
- **HttpClient uses Fetch by default.** Do not add `withFetch()`.
- **DI via `inject()`.** No constructor parameter injection.
- **Signal Forms are the default** (`@angular/forms/signals`). Use Reactive or
  Template-driven forms only when maintaining existing code that already uses them.
- **Angular Aria is the default** for accessible interactive widgets (see §8).

## 2. Naming & files

- File and folder names use kebab-case. **No type suffix for components**:

  | Kind          | File                         | Class                 |
  | ------------- | ---------------------------- | --------------------- |
  | Component     | `course-detail.ts` + `.html` | `CourseDetail`        |
  | Store         | `course-detail.store.ts`     | `CourseDetailStore`   |
  | API service   | `course.api.ts`              | `CourseApi`           |
  | Models        | `course.model.ts`            | `Course`, `SaveCourseCommand` |
  | Routes        | `course.routes.ts`           | default export `Routes` |
  | Guard / resolver / interceptor | `auth.guard.ts`, `error.interceptor.ts` | `authGuard`, `errorInterceptor` (functions) |
  | Pipe / directive | `relative-time.pipe.ts`, `autofocus.directive.ts` | `RelativeTimePipe`, `Autofocus` |
  | Test          | `<file>.spec.ts` beside the file | — |

- One component per file. Templates go in a separate `.html` file unless they
  are a few lines. A component with its own look has a `.scss` beside it that
  starts with `@use 'ui';` (ui-library.md → Styling).
- Selectors use the project prefix (`app-` by default), in kebab-case.
- Signals and computed values are nouns (`course`, `isSaving`, `hasError`).
  Store selectors add a `$` suffix (`course$`, `isSaving$`). Store setters are
  `setX`, and store commands are verbs (`save`, `selectLesson`).
- Outputs are named after the event (`saved`, `closed`), with no `on` prefix.

## 3. Components & templates

- Use `input()`, `input.required()`, `output()`, `model()`. Use `viewChild()`,
  `viewChildren()`, `contentChild()`, `contentChildren()`. Do not use `@Input`,
  `@Output`, `@ViewChild`, `@HostBinding`, or `@HostListener`. Put host
  bindings and listeners in the `host: {}` metadata.
- Members used only by the template are `protected`. Signals and injected
  dependencies are `readonly`.
- Use built-in control flow (`@if`, `@for` with `track <stable id>`, `@switch`,
  `@let`, `@defer`). Do not use `*ngIf`, `*ngFor`, `ngSwitch`, `ngClass`, or
  `ngStyle`. Use `[class.x]` and `[style.x]` bindings instead.
- Do not call methods in templates except signal reads. Derive values with
  `computed()` or use a pure pipe.
- Do not use `ngOnChanges`. Derive display values from inputs with `computed()`.
  Use `DestroyRef` for teardown.
- **Presentational components** (inputs/outputs only, no store, no services)
  are preferred for reusable UI.
- Use `NgOptimizedImage` for content images. Use `@defer` for heavy content
  below the fold or behind interactions.

## 4. Project & route-module structure

```text
src/app/
├── app.ts / app.html / app.config.ts / app.routes.ts
├── core/                     # app-wide singletons: interceptors, guards, error handler
├── shared/                   # reusable presentational UI, pipes, directives; no feature state
│   └── ui/
└── features/
    └── course/
        ├── course.routes.ts
        ├── data-access/                 # API services + models used by ≥ 2 routes
        │   ├── course.api.ts
        │   └── course.model.ts
        └── course-detail/               # one route module
            ├── course-detail.ts         # exactly one main component
            ├── course-detail.html
            ├── course-detail.spec.ts
            ├── data-access/             # only when this route needs a store
            │   └── course-detail.store.ts
            └── components/
                └── lesson-editor/
                    ├── lesson-editor.ts
                    ├── lesson-editor.html
                    ├── lesson-editor.spec.ts
                    └── data-access/     # only when this child needs a store
                        └── lesson-editor.store.ts
```

- Every route UI is a **route module** with exactly one main component.
- Every child component has its own folder under its owner's `components/`.
  Nest `components/` again for deeper owned UI (e.g. a dialog).
- Put APIs and models in the **narrowest** `data-access/` shared by all their
  consumers. Promote them to the feature level only when ≥ 2 routes use them.
- `shared/` must not depend on `features/`. A feature must not import from
  another feature's internals. Promote shared code to `shared/` or `core/` instead.
- Do not model sibling routes as parent/child merely because their URLs share a prefix.

## 5. Data flow: API service → Store → Component

```text
HttpClient ─► XApi (service) ─► XStore (state + logic + serverData/serverMutation) ─► Component (view)
```

**Core principle: the store owns all state and all state logic.** The component
is a thin view layer. It renders signals from the store, and it forwards user
events to store commands.

### 5.1 API service layer

- Use `@Service()`, which is root-provided. **Stateless**: no signals, no caching
  fields, no subscriptions.
- One method per endpoint. Return `Observable<T>` from `HttpClient` with typed
  request and response models. Map DTOs to domain models here when they differ.
- Never subscribe inside a service. Never inject a store into a service.

```ts
@Service()
export class CourseApi {
  private readonly http = inject(HttpClient);

  getById(id: string): Observable<Course> {
    return this.http.get<Course>(`/api/courses/${id}`);
  }

  getFeatured(): Observable<Course> {
    return this.http.get<Course>('/api/courses/featured');
  }

  update(command: SaveCourseCommand): Observable<Course> {
    return this.http.put<Course>(`/api/courses/${command.id}`, command);
  }
}
```

### 5.2 Store layer

- Use `@Injectable()` **without `providedIn`**, provided at the component level
  (`providers: [XStore]`). **Never use `@Service()` or `providedIn: 'root'` for a store.**
- Every API call goes through the core data-access primitives
  (`core/data-access/`), called in field initializers like `rxResource`:
  - **`invalidation()`**: a change token. The store that owns the data creates
    it, mutations bump it, reads reload on it. Another store may receive it
    as a read-only `ChangeToken`.
  - **`serverData(load, { reloadOn })`**: reads one value. Exposes `value`,
    `isLoading` (true only until the first value arrives), `error` (already an
    `AppError`) and `reload()`. The last value stays on screen during a reload.
  - **`serverMutation(run, { errors, success, onSuccess, invalidates })`**:
    runs a command. `errors` is required: `'toast'` shows the server message as
    a toast, `'inline'` exposes it as `error` for the form. On success it runs
    `onSuccess`, then bumps `invalidates`, then shows the `success(input,
    result)` toast. Exposes `run(input)`, `isPending`, `error` and `reset()`.
  - Use raw `rxResource` only where they do not fit, with a comment giving the
    reason. `serverData` has no `params` yet, so a read keyed by a signal (a
    route param that can change while the component lives) is a raw
    `rxResource`: `params` returns `undefined` to keep it idle, and its
    `value()` is read behind `hasValue()`, because reading the value of an
    errored resource throws.
- **Store shape.** Organize every store in this order:
  1. **`private readonly state = { ... }`**: one object that holds **all**
     writable signals of the store, and only **screen state** (editing, filters,
     sort, page, tab). Requests, change counters and server values are not
     state: the primitives own them. Do not declare writable signals anywhere
     else in the store.
  2. **Resources**: private `invalidation()`, `serverData()` and
     `serverMutation()` fields. Their callbacks may read `state`.
  3. **Selectors**: public readonly signals with a **`$` suffix**. For each state
     key, write `readonly x$ = this.state.x.asReadonly()`. Derived values use
     `computed()`, and primitive signals are re-exposed as `$` fields too.
  4. **Setters**: one `setX(value)` method per state key. A setter is the **only**
     place that calls `.set()` / `.update()` on that key.
  5. **Commands**: intent-named methods (`save`, `selectLesson`, `retryLoad`) that
     compose setters and call `mutation.run(...)`. Commands never call `.set()`
     on `state` directly. Confirm dialogs live in commands.
- Because every write goes through a setter, one breakpoint or log line in
  `setX()` shows every change to `x`.
- In this convention, `$` marks a **readonly signal exposed by a store**. Do not
  use `$` for observables or for anything else.
- Never expose a writable signal, the `state` object, or a primitive itself.
- **Mutations** (POST/PUT/DELETE) use `serverMutation`.
  - `run(input)` always sets a fresh request, so resubmitting the same payload
    calls the server again.
  - A new run cancels the in-flight one. Disable the trigger in the UI while
    `isSaving$()` is true.
  - Close a drawer or navigate from `onSuccess`, reload data through
    `invalidates`. Never use an `effect()` for this.
  - Call `reset()` when a form reopens, so an old error does not show.
- The route store reads route params itself (`ActivatedRoute` + `toSignal`), so
  the component does not forward them.

```ts
@Injectable()
export class CourseDetailStore {
  private readonly api = inject(CourseApi);

  // 1. State: screen state only
  private readonly state = {
    selectedLessonId: signal<string | null>(null),
    editorOpen: signal(false),
  };

  // 2. Resources: data-access primitives
  private readonly changes = invalidation();

  private readonly courseData = serverData(() => this.api.getFeatured(), {
    reloadOn: this.changes,
  });

  private readonly saveMutation = serverMutation(
    (command: SaveCourseCommand) => this.api.update(command),
    {
      errors: 'inline',
      success: () => 'Course saved',
      onSuccess: () => this.setEditorOpen(false),
      invalidates: this.changes,
    },
  );

  // 3. Selectors
  readonly selectedLessonId$ = this.state.selectedLessonId.asReadonly();
  readonly editorOpen$ = this.state.editorOpen.asReadonly();

  readonly course$ = this.courseData.value;
  readonly selectedLesson$ = computed(() =>
    this.course$()?.lessons.find((l) => l.id === this.selectedLessonId$()),
  );
  readonly isLoading$ = this.courseData.isLoading;
  readonly loadError$ = this.courseData.error;
  readonly isSaving$ = this.saveMutation.isPending;
  readonly saveError$ = this.saveMutation.error;

  // 4. Setters: the only writers of state
  setSelectedLessonId(id: string | null): void {
    this.state.selectedLessonId.set(id);
  }

  setEditorOpen(open: boolean): void {
    this.state.editorOpen.set(open);
  }

  // 5. Commands: intent, composed from setters
  selectLesson(id: string): void {
    this.setSelectedLessonId(id);
    this.setEditorOpen(true);
  }

  save(command: SaveCourseCommand): void {
    this.saveMutation.run(command);
  }

  retryLoad(): void {
    this.courseData.reload();
  }

  // Optional debug selector: whole state as one plain object
  readonly snapshot$ = computed(() =>
    Object.fromEntries(Object.entries(this.state).map(([key, s]) => [key, s()])),
  );
}
```

### 5.3 Component layer

- **No state logic in components.** A component does not declare writable
  `signal()` / `linkedSignal()` values, and it does not contain business rules,
  state transitions, or derivations of state. All of these go to its store. The
  only exception is the form model (§6).
- Event handlers are one-liners that call a store command
  (`(click)="store.selectLesson(lesson.id)"`). If a handler needs `if`/`else`
  logic about state, move that logic into the store.
- Components may inject non-state UI services for navigation and presentation,
  such as `Router`, the CDK `Dialog`, or `LiveAnnouncer`. They must not inject
  `HttpClient` or API services, because API calls belong to the store.
- A component may use `computed()` over its own **inputs** for display-only
  formatting. Derivations of store state belong in the store.
- The component renders loading, error (with retry), empty, and success states
  from store signals.

### 5.4 When a store is required

| Component has… | Decision |
| --- | --- |
| Any writable state, state logic, or API call | **Store** (in its `data-access/`) |
| Only inputs/outputs and display formatting of inputs | Presentational component, no store |

- A store may be small. One or two signals with their commands is a valid store.
- Do not create pass-through stores that own no state or behavior. A component
  whose store would only forward calls should be presentational instead.

### 5.5 Parent/child ownership

- Each state aggregate has exactly **one writable owner**.
- The route store owns route orchestration and canonical route state. A child
  store owns only its component's transient state and request lifecycle.
- A child component injects only its own store. That store may inject the parent
  store through the element-injector hierarchy and call **narrow, intent-based
  commands** on it (`saveLesson(draft)`, `applySelection(ids)`).
- Do not expose the parent store through a child store. Sibling stores never
  inject each other.
- Keep request, retry, and error state in the store of the component that renders them.
- Treat 300 lines as a **review threshold** for a store. Above it, move
  child-owned state down, and extract pure calculations and adapters. Never split
  only to satisfy a line count.

### 5.6 RxJS

- RxJS belongs in API services and inside `serverData`/`serverMutation` (or `rxResource`) streams. Use `toSignal()`
  to bridge other observables (router, third-party) in stores.
- No manual `subscribe()` in components. If a store must subscribe, use
  `takeUntilDestroyed()`.
- No global `BehaviorSubject`/`Subject` state. No NgRx Store/Effects for local state.

## 6. Forms (Signal Forms)

- The form model (`signal<T>`), `form()`, the validation schema, and submission
  all live in the **component that renders the form**.
- Bind fields with the `FormField` directive (`[formField]`). Show errors only
  after the field is touched.
- To prefill from server data, use a `linkedSignal` from the store's readonly
  signal as the form model.
- On submit, validate with `submit()`, convert the value into a form-agnostic
  command, and call a store command.
- A store never creates, exposes, reads, or validates a form. Do not copy form
  values into store state.
- Every validator provides a user-facing `message`.

```ts
export class CourseDetail {
  protected readonly store = inject(CourseDetailStore);

  private readonly model = linkedSignal(() => toCourseFormValue(this.store.course$()));
  protected readonly courseForm = form(this.model, (path) => {
    required(path.title, { message: 'Title is required' });
    maxLength(path.title, 120, { message: 'Max 120 characters' });
  });

  protected onSubmit(event: Event): void {
    event.preventDefault();
    submit(this.courseForm, async () => {
      this.store.save(toSaveCourseCommand(this.store.course$()!.id, this.model()));
    });
  }
}
```

```html
<form (submit)="onSubmit($event)">
  <input id="title" [formField]="courseForm.title" />
  @if (courseForm.title().touched() && courseForm.title().invalid()) {
    @for (error of courseForm.title().errors(); track error.kind) {
      <p class="field-error">{{ error.message }}</p>
    }
  }
  <button type="submit" [disabled]="store.isSaving$()">Save</button>
</form>
```

## 7. Effects & reactive derivation

`effect()` is an escape hatch for syncing signals with **non-reactive, imperative
APIs**. It is not a state-management tool. Pick the first option that fits:

1. Readonly value derived from state → `computed()`
2. Writable state that resets from or follows another signal → `linkedSignal()`
3. Async data in the store → `serverData()` / `serverMutation()` (`rxResource()` for a read keyed by a signal)
4. Work triggered by a user action → a store command
5. Sync with `localStorage`, analytics, a third-party widget, or another
   non-reactive boundary → `effect()`
6. DOM work after render → `afterRenderEffect()`

Effects that synchronize state live in the **store**. Components may contain
only `afterRenderEffect()` for DOM work.

When an effect is justified:

**Scope: one effect = one boundary concern.**

- Never put several concerns in one effect, such as persisting filters, sending
  analytics, and rendering a chart together. Write one effect per concern, so that
  each one re-runs only for its own triggers.
- An effect reads **at most 3 trigger signals**. When a concern needs more
  inputs, combine them into one `computed()` payload in the store with an `equal`
  function. The effect then reads only that payload, and it re-runs only when
  the payload actually changes.
- Read all trigger signals at the **top** of the callback. Wrap everything after
  that, including any method or third-party call that might read signals, in
  `untracked()`.

**Cleanup: every effect owns and releases its work.**

- Any effect that starts a timer, listener, subscription, observer, animation
  frame, or cancelable request must register `onCleanup`. Angular runs the
  cleanup before the next execution and when the effect is destroyed.
- Create effects only in an injection context, as a store or component field
  initializer or in the constructor. This way they are destroyed automatically
  with their owner. Never create effects inside methods, callbacks, or `setTimeout`.
- If an effect must stop before its owner is destroyed, keep the `EffectRef` and
  call `destroy()` from a command.

**Other rules**

- Never make the callback `async`. Keep it short and delegate to a named method.
- Do not use third-party effect helpers (e.g. ngxtension `explicitEffect`).

> Note: Angular batches effect runs. If several trigger signals change in the
> same turn, the effect still runs **once**. The real risks are over-tracking,
> meaning the effect re-runs on signals unrelated to its job, and missing
> cleanup, meaning work from earlier runs keeps piling up. The rules above
> prevent both.

```ts
// ✅ Boundary sync with cleanup
effect((onCleanup) => {
  const draft = this.draft();
  const timer = setTimeout(() => this.draftStorage.save(draft), 800);
  onCleanup(() => clearTimeout(timer));
});

// ✅ Incidental reads untracked (third-party call reads theme())
effect(() => {
  const data = this.chartData();
  untracked(() => this.chart.render(data, this.theme()));
});

// ❌ One effect, many concerns: every signal re-triggers everything
effect(() => {
  localStorage.setItem('filters', JSON.stringify({ q: this.query(), sort: this.sort() }));
  this.analytics.track('view', { page: this.page() });
  this.chart.render(this.data(), this.theme());
});

// ✅ One concern, one combined trigger (in the store)
private readonly persistedFilters = computed(
  () => ({ q: this.state.query(), sort: this.state.sort() }),
  { equal: (a, b) => a.q === b.q && a.sort === b.sort },
);
private readonly persistFilters = effect(() => {
  const filters = this.persistedFilters();
  untracked(() => this.filterStorage.save(filters));
});

// ❌ State propagation
effect(() => this.total.set(this.price() * this.quantity()));
// ✅
readonly total = computed(() => this.price() * this.quantity());
```

## 8. Accessibility

- Use native elements first: `<button>` for actions, `<a>` for navigation. Never
  put click handlers on a `<div>`.
- Build composite widgets (tabs, menu, listbox, combobox, tree, grid, accordion,
  toolbar…) with **`@angular/aria`**. Do not hand-roll keyboard, focus, or ARIA
  behavior that Aria already provides.
- Use `@angular/cdk` for overlay, dialog, portal, drag-drop, and a11y utilities
  (`FocusTrap`, `LiveAnnouncer`).
- Icon-only controls need an accessible name (`aria-label`) and a tooltip.
  Decorative icons use `aria-hidden="true"`.
- Every input has a `<label>`, and errors are linked with `aria-describedby`.
- Return focus after closing a dialog. Keep focus states visible.
- Meet WCAG 2.2 AA contrast. Respect `prefers-reduced-motion`.

## 9. Styling

- Style with SCSS only. Read design tokens through the `ui` Sass module
  (`@use 'ui';`, then `ui.color(primary)`, `ui.space(3)`, `@include ui.bp(md)`);
  **do not hardcode** color, spacing, radius, shadow, or font values.
- Templates carry semantic BEM class names styled in the component's `.scss`.
  The only other classes are the closed set of layout helpers (`stack`, `row`,
  `row-between`, `grow`, `grid-2/3/4`, `span-2`, `sr-only`, `skip-link`) and
  their `--gap-<spacing key>` modifiers, for wrappers that only arrange children.
  TypeScript returns modifier names (`due-date--danger`), never style values.
- Write BEM nested: one root block per rule, with elements and modifiers as
  `&__element` / `&--modifier` inside it (and states as `&:hover`), not as flat
  sibling selectors.
- Keep default view encapsulation. Do not use `::ng-deep` or `!important`.
- Do not add a pre-styled UI library (Material, PrimeNG, NG-ZORRO…) unless the
  project already declares it.

## 10. Routing

- Lazy-load features in `app.routes.ts` with
  `loadChildren: () => import('./features/course/course.routes')`, which loads
  a default export. Load route components with `loadComponent`.
- Use functional guards and resolvers (`CanActivateFn`, `ResolveFn`), not class
  guards. Prefer store resources over resolvers for page data.
- Put providers needed by a whole route subtree in the route's `providers`.
- In v22, child routes inherit params from parent routes by default. Read params
  from the current route and do not walk `route.parent`.
- Every app has a wildcard / not-found route.

### 10.1 Router behaviours every page gets

- **Title.** Set `title` on the route; `AppTitleStrategy` (`core/routing/page-title.strategy.ts`)
  makes it `"<title> · Core Banking Academy"`. Do not call `Title.setTitle` in a page.
- **Focus.** After each navigation the shell focuses the page's `h1` (or `main` when there is
  none), so a page needs exactly one `h1` and must not move focus on load. The skip link
  "Bỏ qua tới nội dung chính" focuses `main#main`.
- **Scroll.** `withInMemoryScrolling` restores the scroll position on back/forward and scrolls to
  the top on a new page.
- **Unsaved changes.** A routed component with a form implements
  `hasUnsavedChanges(): boolean` (`HasUnsavedChanges`). Every table route has
  `unsavedChangesGuard`, which asks "Rời trang khi chưa lưu?" (warning tone) when it returns true,
  and the shell warns on reload or tab close through `beforeunload`. Nothing else is needed.
- **Offline.** `NetworkStore` (root) follows the window `online`/`offline` events and the dev
  toolbar; the shell shows the banner. Pages do not render their own offline notice.

## 11. HTTP & error handling

- Configure HTTP with `provideHttpClient(withInterceptors([...]))` and functional
  interceptors in `core/` for auth headers, error mapping, and similar
  cross-cutting concerns.
- Map `HttpErrorResponse` to a typed app error in one place. Stores expose that
  error, and components render it with a retry action.
- Provide a global `ErrorHandler` for unexpected errors. Never swallow errors silently.

## 12. TypeScript & security

- `strict` mode. No `any`. Use `unknown` and narrow it. Prefer `readonly` and
  union types over enums.
- Never bind untrusted HTML. Use `bypassSecurityTrust*` only with a written justification.
- Never commit secrets. Read environment config from the project's config mechanism.

## 13. Testing

- Use the project's runner (Vitest by default for new v22 projects). Place each
  spec next to the file it tests.
- Test behavior through the DOM and public API, not internals or the number of
  times an effect runs.
- **API services:** `provideHttpClient()` + `provideHttpClientTesting()` +
  `HttpTestingController`.
- **Stores:** provide the store with a fake API (or HttpTestingController), call
  commands, flush with `TestBed.tick()` / `await fixture.whenStable()`, and
  assert the exposed signals for loading, success, error, and retry.
- **Components:** replace the store through component providers
  (`TestBed.overrideComponent(X, { set: { providers: [{ provide: XStore, useValue: fake }] } })`).
  Assert the rendered states and that the right commands are called.
- Zoneless means there is no `fakeAsync`. Use the runner's fake timers instead.
- Test effect cleanup and form validation messages.

## 14. Checklist before reporting completion

- [ ] No NgModule, `standalone: true`, `changeDetection`, zone.js, or legacy decorators/control flow?
- [ ] Files follow §2 naming (no `.component.ts`)?
- [ ] Route has its own folder with one main component, and each child has its own folder?
- [ ] Components hold no writable state or state logic (other than the form model), and handlers only call store commands?
- [ ] Components never inject HttpClient or API services?
- [ ] API services are stateless `@Service()`, and stores are `@Injectable()` provided at the component level?
- [ ] Every API call goes through `serverData`/`serverMutation` (or `rxResource` with a comment giving the reason), and every mutation declares `errors: 'toast' | 'inline'`?
- [ ] All writable state (screen state only) is in one `private readonly state = {}` object, exposed as `x$` via `asReadonly()`/`computed()`, and written only through `setX()` setters that commands compose?
- [ ] Loading, error + retry, and empty states are rendered?
- [ ] Forms use Signal Forms, and the form plus submit logic stay in the component?
- [ ] Every `effect()` crosses a non-reactive boundary, handles one concern, reads ≤ 3 triggers (or one combined `computed`), uses `untracked()` for everything else, and cleans up its work in `onCleanup`?
- [ ] Interactive widgets use `@angular/aria`, and icon-only controls have accessible names?
- [ ] No hardcoded design values?
- [ ] Specs cover the new or changed behavior?

## 15. Never

- `NgModule`, `*ngIf`/`*ngFor`, `ngClass`/`ngStyle`, `@Input`/`@Output`/`@ViewChild`/`@HostBinding`/`@HostListener`, constructor injection.
- `ChangeDetectionStrategy.Eager`, zone.js, or `setTimeout` used to "refresh" the UI.
- `@Service()` / `providedIn: 'root'` for a store. Exposing writable signals, the `state` object, or resource objects.
- Writable signals outside the store's `state` object. Calling `.set()`/`.update()` on state anywhere except its `setX()` setter. Using `$` for anything other than a store's readonly signal.
- Writable `signal()`/`linkedSignal()` or state logic in components (except the form model). HttpClient or API services in components. `subscribe()` in components.
- `effect()` to copy, mirror, or propagate state, or to model a user command. `async` effect callbacks. ngxtension `explicitEffect`.
- Form models inside stores. Multiple writable owners of one state aggregate. Sibling stores injecting each other.
- Hand-rolled ARIA/keyboard behavior where `@angular/aria` provides it. Hardcoded design values
