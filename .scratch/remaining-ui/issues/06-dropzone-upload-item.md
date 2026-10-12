# 06: Dropzone and upload item

**What to build:** `[uiDropzone]` behaviour directive on a `label` with a hidden file input: drag-over state (`is-over`), drop and picker emit `File[]`; `accept` and `multiple` pass through. `ui-upload-item`: icon, name, size, optional progress (`ui-progress`), `state` `uploading | done | error` and an error message (`role="alert"`). Replaces the dropzone placeholder in **Form & nhập liệu**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Keyboard opens the picker (Enter/Space on the focused zone); focus ring visible
- [x] Drop and picker emit the same output; no validation inside the library
- [x] Byte size formatting matches `fmt.bytes`
- [x] Spec covers drag-over class, drop event, picker change and upload item states
- [x] Demo copies "Kéo thả hoặc chọn tệp · PDF · tối đa 20 MB" and the sample upload; checklist entry `dropzone` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
