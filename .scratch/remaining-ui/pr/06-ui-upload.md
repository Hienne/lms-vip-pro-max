## Summary

`[uiDropzone]` on a label with a hidden file input (drop + picker emit `files`, Enter/Space opens picker); `ui-upload-item` (uploading/done/error, `fmt.bytes` sizes).

```text
<label uiDropzone accept multiple (files)>
  <input type=file hidden>
<ui-upload-item name size state progress>msg</ui-upload-item>
```

## Evidence

- **Before:** the piece is a "Chưa migrate" placeholder on `/design-system`.
  **After:** demo rendered in light and dark at 375 px (checked in the browser); `npx nx run-many -t lint typecheck test build` green.

```text
dropzone.spec.ts: drop emits File[] and prevents default; dragleave onto a child keeps `is-over`; Enter opens picker.
```

## Merge Danger

**Door:** two-way

Validation stays with the caller.

**Blast Radius:** `/design-system` forms section
