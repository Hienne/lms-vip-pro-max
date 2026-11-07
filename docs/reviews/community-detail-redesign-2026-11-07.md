# Community detail redesign

Implemented the approved compact question/article detail layout and the first
"Helpful button" design.

- The title, author/date and quiet save/follow actions precede the reading area.
- Questions, answers and articles use a horizontal helpful button with the server
  score and a separate downvote. Selected controls use primary tokens; pressing
  the selected vote withdraws it. Server capabilities and pending state still
  govern availability. Scores are never calculated in the view.
- The desktop reading column has a metadata sidebar. On narrow screens metadata
  follows the discussion. Related-content suggestions were omitted because the
  current detail response does not provide them.
- Comments use compact author/time rows and indented replies. Existing edit,
  delete, report, accept and lifecycle actions remain available.
- The answer editor uses six rows, a wrapping Markdown toolbar and neutral initial
  validation styling. Long-form authoring retains its fourteen-row default.
- All colors, spacing, typography and breakpoints use the existing UI tokens.
  There are no decorative status colors, gradients, icon tiles or entrance effects.

## Verification

- Node 24.22.1; `nvm` and `npm` are absent from PATH, so local Node CLI entrypoints
  were used. Nx needs `NX_DAEMON=false` and `NX_ISOLATE_PLUGINS=false` in this
  Windows environment.
- Community specs plus the template/style guard: 83 passing tests in 16 files.
- LMS/UI lint and typecheck passed (existing lint warnings remain).
- Production build and production bundle guard passed. The staging bundle guard
  also passed before the final cosmetic refinements.
- Full LMS/UI suite: 2,492 passed, four failures in the existing TargetPicker
  specs, which still query a drawer after that component changed to a dialog.
  This redesign does not change TargetPicker or its dependencies.
- Changed source files pass Prettier and `git diff --check`. The workspace-wide
  format check remains red with 1,191 files outside this change needing format.
- Chrome inspected the actual local production build against the seeded mock
  backend: question 101 and article 110, each at 1280/375px and light/dark.
  All eight views had no horizontal overflow or JavaScript errors. Vote toggling,
  Markdown preview and answer posting were exercised locally. The own-article
  voting controls remained disabled according to server capabilities.
- Screenshots and the browser QA JSON are in the task's visualization directory
  with the `community-detail-` prefix. No production data was modified.

The full repository check is not green because of the unrelated formatting and
TargetPicker failures above.
