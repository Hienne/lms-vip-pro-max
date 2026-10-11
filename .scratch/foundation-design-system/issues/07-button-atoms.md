# 07: Button atoms

**What to build:** `uiButton` on `button` and `a`, `uiIconButton` with a
required label that becomes its accessible name and tooltip text, and
`uiLinkButton`, all as attribute directives keeping native semantics
(`type`, `href`, `routerLink`, `disabled`, events). Variants, sizes, block
width, icon placement and a busy state match the mockup. The **Nút bấm**
section of `/design-system` reproduces the mockup's variant × state table and
the icon-button row. See the spec: `@lms/ui` atoms.

**Blocked by:** 02 — Migration checklist and progress board; 04 — Icon atom with the full icon registry

**Status:** ready-for-agent

- [ ] Variants `primary`, `secondary`, `ghost`, `danger`, `danger-ghost`, `on-dark`; sizes `sm`, `md`, `lg`; `block` flag; look ported from the mockup's button block into one partial
- [ ] Busy state shows a spinner, sets `aria-busy` and blocks activation; disabled works on buttons and is announced on links
- [ ] An icon button without a label does not compile; the label is its accessible name and tooltip text
- [ ] Link button renders as a button or a link with the mockup's look
- [ ] Specs cover classes per variant and size, flags, busy and disabled ARIA, and required label
- [ ] **Nút bấm** section matches the mockup table (default, small, with icon, disabled, busy) and the icon-button row; placeholders removed
- [ ] Keyboard pass over the section: focus ring visible, Enter and Space activate
- [ ] Checklist entries `done` with owner, pull request and the checks performed
- [ ] Checked in the browser side by side with the mockup at 375/768/1280 px, light and dark
- [ ] `npm run check` green; merged through its own pull request
