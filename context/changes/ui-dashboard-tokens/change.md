---
change_id: ui-dashboard-tokens
title: Connect dashboard and dog-profile views to semantic design tokens
status: implemented
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

Scope (per /10x-ui, user-confirmed 2026-09-26): two views, `src/pages/dashboard.astro` and
`src/pages/dashboard/dog.astro`, both share the same defect — hardcoded `bg-cosmic` gradient
background plus one-off `bg-gradient-to-r from-blue-200 to-purple-200` / `bg-white/10` /
`border-white/10` classes instead of the shadcn semantic tokens already defined in
`src/styles/global.css`. Widening from the skill's default "one view" to these two is
deliberate: they are directly linked (dashboard → dog profile) and identical in defect shape,
not a full app rebrand. Auth pages (`src/pages/auth/*`), `Welcome.astro`, and
`SubmitButton.tsx` also use `bg-cosmic`/gradient classes but are explicitly OUT of scope for
this change.

Theme decision (user-confirmed): current `global.css` ships the factory shadcn "neutral"
palette (zero saturation). Replace with a custom warm accent (amber/coral) suited to a dog
dating app, built per shadcn/ui theming docs conventions (OKLCH, paired `--x` /
`--x-foreground`). Not a copy-pasted tweakcn preset — values derived and justified in
`research.md` / plan, with the source documented next to the tokens.

**2026-09-26 update**: user requested a Tinder-style brown/pink theme instead. Palette
replaced again: hot pink/rose is now `--primary` (buttons, links, focus ring — classic
Tinder accent, vibrant intensity), warm coffee-brown is `--accent`/`--secondary`/`--muted`.
Choice of "pink as primary" (vs. "brown as primary") and "vibrant" (vs. "muted") intensity
were asked via `ask_user` but the user was unavailable when this was applied — defaults
documented here for review, not silently assumed. `--destructive`/`--success` unchanged.
Also fixed a real bug found via user screenshots: `Button asChild` (Radix `Slot`) did not
apply button styling to the wrapped `<a>` in `dashboard.astro` when rendered by Astro
without a `client:` directive — replaced with `buttonVariants({ variant: "outline" })` +
`cn()` applied directly to the anchor's `class`.

Work continues on a dedicated branch `ui/dashboard-tokens-tinder-theme` (separate from
whatever other process/session is also touching styling, per user instruction).

Existing `context/changes/dashboard-page/` is a **different, unrelated** change (the S-02
browse/swipe matching page, roadmap item) — do not confuse the two.

**2026-10-04 follow-up (scope widened to whole app)**: user reported the shipped theme only
showed a plain white page background with pink/brown limited to buttons/accents — confirmed
root cause: `--background`/`--card` were left at the stock shadcn near-white values, and
`Welcome.astro`/auth pages/`Topbar.astro`/`FormField.tsx`/`LibBadge.astro` (explicitly out of
scope in the original note above) still used the old navy `bg-cosmic` gradient plus
blue/purple/indigo accent classes. Resolved by: (1) retinting `--background`/`--card`/
`--border`/`--input`/sidebar tokens in both `:root` and `.dark` to warm cream/brown instead of
neutral gray/white; (2) recoloring the `bg-cosmic` utility gradient from navy to dark brown;
(3) replacing every remaining `purple-*`/`blue-*`/`indigo-*` literal class across
`Welcome.astro`, `auth/{signin,signup,confirm-email}.astro`, `Topbar.astro`, `FormField.tsx`,
`SignUpForm.tsx`, `LibBadge.astro` with rose/amber/pink equivalents (or the `--primary` token
where it's a CTA); (4) `DashboardLayout.astro` now wraps pages in a
`bg-gradient-to-br from-secondary/40 via-background to-primary/10` instead of a flat
`bg-background`, so the dashboard reads as an actual brown/pink mix, not a single tint.
`npm run lint` and `npm run build` both pass after these changes.

**2026-10-04 follow-up #2 (chroma too subtle + production deploy gap)**: user screenshotted
production still showing a white background after the above. Two separate causes: (a) the
above commits had only reached `develop`; production (Cloudflare Workers Builds, native Git
integration) deploys on push to `main`, so none of it had shipped yet — fixed by merging the
`develop → main` release PR (#17); (b) independently, `--background`/`--card` chroma (0.008–
0.02) was so low it read as plain white even when deployed. Raised chroma across
`--background` (0.035), `--card`/`--popover` (0.02), `--secondary`/`--muted`/`--accent` and
all `--sidebar-*` tokens, and strengthened `DashboardLayout.astro`'s gradient to
`from-accent/50 via-background to-primary/25`. Verified post-deploy by fetching the live
`/_astro/*.css` bundle from `doggo-date.maciej-graszek.workers.dev` and confirming it contains
the new `--background:oklch(95% .035 40)` value and the brown `bg-cosmic` hex. `npm run lint`
and `npm run build` pass; shipped via PR #19 (develop) then PR #17 (develop → main).
