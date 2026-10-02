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
