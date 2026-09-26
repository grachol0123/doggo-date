---
date: 2026-09-26
researcher: Copilot CLI (10x-ui)
git_commit: HEAD
branch: develop
repository: grachol0123/doggo-date
topic: "Internal audit + external theme reference for ui-dashboard-tokens"
tags: [research, ui, tokens, dashboard]
status: complete
---

# Research: ui-dashboard-tokens

## 1. Token source (internal audit)

- File: `src/styles/global.css`. Tailwind v4, `@import "tailwindcss"`, tokens defined in
  `:root` / `.dark` (lines 6-64) and published via `@theme inline` (lines 66-104). The
  bridge is correctly wired — every `--x` in `:root`/`.dark` has a matching
  `--color-x: var(--x)` in `@theme inline`. No missing-bridge bug here.
- Current values are the **factory shadcn "neutral" palette**: every color is `oklch(_ 0 _)`
  (zero chroma) — literally grayscale. `--primary` in light mode is near-black
  (`oklch(0.205 0 0)`), `--ring` is a mid-gray. No `--destructive-foreground`,
  `--success*`, or `--warning*` tokens exist yet.
- `@utility bg-cosmic` (global.css:106-108) defines a **hardcoded dark-navy→purple gradient**
  (`#0a0e1a, #0f1529, #0a0e1a`) as an escape hatch outside the token system. This is the
  "generic AI gradient" the lesson describes almost verbatim.

## 2. Components present (internal audit)

`src/components/ui/`: `button.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `checkbox.tsx`,
`textarea.tsx`, `LibBadge.astro`. All of these **already** consume semantic tokens correctly
(`border-input`, `bg-primary`, `focus-visible:ring-ring/50`, `text-muted-foreground`, etc.) —
they are not part of the problem. No `Card`, `Alert`, or `Badge` (shadcn `Badge`, distinct
from the pre-existing `LibBadge.astro`) component exists yet; both are needed for the two
in-scope views (card container, error/success banners).

## 3. Hardcoded-class inventory (files that ignore the token file)

In scope for this change:

| File | Lines | Hardcoded classes | Role |
|---|---|---|---|
| `src/pages/dashboard.astro` | 8-26 | `bg-cosmic`, `border-white/10`, `bg-white/10`, `from-blue-200`/`to-purple-200` gradient text, `text-blue-100/80`, `text-blue-100/50`, `text-white`, `border-white/20`, `hover:bg-white/20` | Whole page: background, card, heading, body text, both buttons |
| `src/pages/dashboard/dog.astro` | 37-61 | same `bg-cosmic` + glass-card pattern, plus `border-red-500/30`/`bg-red-900/30`/`text-red-300` (error banner), `border-green-400/30`/`bg-green-900/30`/`text-green-200` (success banner), `text-blue-100/60`, `text-purple-300` | Page shell + inline status banners |
| `src/components/dog/DogProfileForm.tsx` | 146, 160, 164, 175, 180, 196, 199, 215, 231 | `text-blue-100/80` (all labels), `text-red-300` (field error), `border-white/20 bg-white/10 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400` (temperament input — the one field not using the shared `Input`), `file:bg-white/10 file:text-white` (file input) | Form rendered inside dog.astro |
| `src/components/auth/SubmitButton.tsx` | 18, 22 | `bg-purple-600 ... hover:bg-purple-500`, `border-white/30 border-t-white` (spinner) | Submit button used by `DogProfileForm` |

Out of scope (confirmed present but not touched by this change, per change.md):
`src/pages/auth/{signin,signup,confirm-email}.astro`, `src/components/Welcome.astro`.

`SubmitButton.tsx` and the temperament field in `DogProfileForm.tsx` are technically shared
by both in-scope views (dog.astro is reached from dashboard.astro), so fixing them is
required to make dog.astro coherent — not scope creep.

## 4. States already exercised by these views

- `dog.astro` already has distinct **error** (`pageError`, `role="alert"`) and **success**
  (`saved`, `role="status"`) banners — both currently styled with raw red/green, not tokens.
- `DogProfileForm` renders a per-field **error** state (`errors.description`) with raw
  `text-red-300`.
- `SubmitButton` has a **loading** state (spinner + "Zapisywanie...") — confirmed present,
  currently hardcoded colors, not a missing state.
- No visible **disabled** state is applied to the dashboard/dog-profile buttons today
  (`Button`'s `disabled:opacity-50` already exists in the shared component and requires no
  new code, only needs to actually be exercised/verified during implementation).
- No **empty state** applies here (dashboard always shows the signed-in user; dog.astro
  handles the "no dog yet" case via the form's own default-empty fields, not a separate
  empty-state UI) — no new empty-state markup is required.

## 5. External reference (theme values)

Per shadcn/ui theming docs conventions (paired `--x` / `--x-foreground`, OKLCH color space):
custom warm amber/coral accent chosen for a dog-dating app, distinct from the existing
grayscale `--primary`. Exact OKLCH numbers are recorded directly in `global.css` next to the
edited block with a source comment (per skill's "deposit values in the repo" rule), not only
here — see plan.md Phase 2.

## Conclusion

This is the "fresh starter, token file exists but nothing reads it" scenario. No missing
`@theme` bridge to fix. Work is: (a) add missing semantic tokens for destructive/success
banners, (b) pick warm primary/accent values, (c) rewire the two views + the two shared
pieces they depend on (`DogProfileForm`, `SubmitButton`) to read tokens/components instead of
one-off classes, (d) add the missing `Card`/`Badge`/`Alert` primitives via
`npx shadcn@latest add`.
