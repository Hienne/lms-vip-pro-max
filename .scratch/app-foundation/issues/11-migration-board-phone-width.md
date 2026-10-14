# 11: Migration board at phone width

**What to build:** the migration progress board reads well at 375 px: below the `sm` breakpoint each entry renders as a stacked card (id, kind, status, owner, pull request, verify checks), with no horizontal page scroll; from `sm` up the table stays as it is. Styling only, with tokens and BEM through the `ui` Sass module. Closes the "board layout at 375 px" gap from the foundation review (`docs/specs/base-libraries.md`, Out of Scope).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] At 375 px no element overflows the viewport (`document.documentElement.scrollWidth` equals the viewport width)
- [ ] Every field visible in the table is also visible on the card, with its label
- [ ] Table layout unchanged at 768 and 1280 px
- [ ] Checked in the browser at 375/768/1280 px, light and dark, keyboard only
- [ ] `npm run check` green; own pull request
