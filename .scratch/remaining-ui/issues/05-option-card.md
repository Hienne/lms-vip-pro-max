# 05: Option card molecule

**What to build:** `ui-option-card`: a `label` wrapping a projected native radio or checkbox atom plus title, description and an optional letter badge (A, B, C…); `tone` `correct | wrong` renders the `.answer` review row with check/x icon and "Bạn chọn"/"Đáp án đúng" text. Replaces the option card placeholder in **Form & nhập liệu**. See spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Whole card toggles the native control; Signal Forms binding untouched
- [x] Checked, focus-visible and disabled states match the mockup
- [x] Review tones never rely on colour alone
- [x] Spec covers selection via label click, keyboard, and review tones
- [x] Demo shows radio, checkbox and review rows; checklist entry `option-card` done
- [x] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [x] `npm run check` green; own pull request
