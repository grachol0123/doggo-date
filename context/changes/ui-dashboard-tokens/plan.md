---
change_id: ui-dashboard-tokens
based_on: research.md
---

# Plan: ui-dashboard-tokens

## Phase 1 — Environment & missing primitives

1. Add missing shadcn primitives needed by the two views: `card`, `badge`, `alert`.
   Command: `npx shadcn@latest add card badge alert` (adds to `src/components/ui/`).
2. Verify `npm run lint` and `npm run build` still pass after the add (no manual edits yet).

**Automated verification**: `npm run lint`, `npm run build` succeed; the three new files
exist under `src/components/ui/`.

## Phase 2 — Base tokens in `src/styles/global.css`

1. Replace the grayscale `--primary`/`--primary-foreground`/`--ring`/`--accent`/
   `--accent-foreground` pairs in `:root` and `.dark` with a warm amber/coral accent (OKLCH),
   keeping every other existing token name unchanged (`--background`, `--card`, `--border`,
   etc. stay as-is — no unrelated rebrand).
2. Add new semantic pairs not yet present: `--success` / `--success-foreground`, reuse the
   existing `--destructive` / add `--destructive-foreground` (currently missing) for the two
   banner states found in research.md §4. Follow the same paired-token convention as the
   `dashboard-page`'s support-panel example in the lesson.
3. Publish all new/changed variables in `@theme inline` (`--color-primary`,
   `--color-success`, `--color-success-foreground`, `--color-destructive-foreground`, etc.) —
   verify no variable is defined in `:root`/`.dark` without a matching `@theme inline` entry.
4. Add a one-line comment above the edited block citing the source
   (shadcn theming docs conventions, OKLCH, hand-picked warm accent — not a named preset).
5. Leave `@utility bg-cosmic` in place (still used by out-of-scope pages) but stop referencing
   it from the two in-scope views in Phase 3.

**Automated verification**: `npm run build` succeeds (Tailwind compiles the new `@theme`
block without errors).
**Manual verification**: open `/dashboard` and confirm background/card no longer show the
navy/purple gradient in either color scheme (light class toggle / OS dark-mode).

## Phase 3 — Rewire the two views to tokens + components

1. `src/pages/dashboard.astro`: replace the `bg-cosmic` + glass-card `div`s with `bg-background`
   page wrapper and the new `Card`/`CardHeader`/`CardContent` components; replace the
   gradient-text `<h1>` with plain `text-foreground` heading; replace `text-blue-100/*` body
   text with `text-muted-foreground`; replace both `border-white/20 bg-white/10` links/buttons
   with the existing `Button` component (`variant="outline"` for both actions, matching current
   visual weight).
2. `src/pages/dashboard/dog.astro`: same shell replacement; replace the raw error banner with
   `Alert variant="destructive"`; replace the raw success banner with `Alert` using the new
   `--success` token (or `Badge` if a compact inline confirmation reads better — decide during
   implementation, keep semantics: role="alert"/"status" preserved); replace the footer link's
   `text-purple-300` with `text-primary`.
3. `src/components/dog/DogProfileForm.tsx`: replace every `text-blue-100/80` label wrapper
   class with `text-muted-foreground` (or drop the override if `Label`'s own default already
   matches); replace the hand-rolled temperament `<input>` styling with the shared `Input`
   component; replace `text-red-300` field error with `text-destructive`; replace
   `file:bg-white/10 file:text-white` with token-based file-input classes consistent with
   `Input`'s own file: styles.
4. `src/components/auth/SubmitButton.tsx`: replace `bg-purple-600 hover:bg-purple-500` with the
   shared `Button` component (or, if it must stay a bare `<button>` for form-submission
   semantics, restyle with `bg-primary text-primary-foreground hover:bg-primary/90`); replace
   the spinner's `border-white/30 border-t-white` with `border-primary-foreground/30
   border-t-primary-foreground`.

**Automated verification**: `npm run lint`, `npm run build` succeed.
**Manual verification**: `/dashboard` and `/dashboard/dog` render with the new warm token
palette, no leftover `bg-cosmic`/`purple-*`/`blue-100`/raw hex in the two pages or the two
shared components (grep confirms zero matches).

## Phase 4 — Interactive states

1. Exercise and confirm on `/dashboard/dog`: default, focus (tab through fields — visible
   ring from `--ring`), disabled (submit while `pending` — spinner + disabled pointer-events),
   error (invalid description → per-field `text-destructive` + top `Alert variant="destructive"`),
   loading (submit spinner), success (`saved=1` query param → success `Alert`).
2. Confirm dark mode: toggle `.dark` and re-check contrast for the new `--primary`,
   `--success`, `--destructive-foreground` pairs (label vs. background must stay readable in
   both modes).
3. Build a small kitchen-sink note (screenshot set) in `context/changes/ui-dashboard-tokens/`
   covering: default, error, success, loading, disabled, light, dark — matching the skill's
   named-states list.

**Automated verification**: none beyond existing lint/build.
**Manual verification**: screenshots attached/described for each of the 7 named states,
both color schemes for the two pages.

## Progress

- [x] Phase 1 — shadcn primitives added (`card`, `badge`, `alert` via `npx shadcn@latest add`; lint/build pass)
- [x] Phase 2 — base tokens (`src/styles/global.css`: warm amber/coral `--primary`/`--accent`/`--ring`
      in `:root`+`.dark`, new `--success`/`--success-foreground`/`--destructive-foreground`
      pairs, all published in `@theme inline`; `bg-cosmic` kept for out-of-scope pages)
- [x] Phase 3 — views + shared components rewired (`dashboard.astro`, `dashboard/dog.astro`
      → `Card`/`Button`/`Alert` + semantic classes; `DogProfileForm.tsx` fields moved off
      `FormField` onto token-aware `Input`/`Label` + `text-destructive` errors + `Alert`;
      `SubmitButton.tsx` hardcoded `bg-purple-600` override removed in favor of `Button`'s
      already-tokenized default variant. `grep` confirms zero `bg-cosmic`/`purple-*`/
      `blue-100`/`white/NN` matches left in the 4 in-scope files. `npm run lint` and
      `npm run build` both pass.)
- [x] Phase 4 — states verified via a temporary kitchen-sink route
      (`context/changes/ui-dashboard-tokens/kitchen-sink.astro.snapshot`, not part of the app)
      rendering default/focus/disabled/error/success/loading side by side; HTML inspection
      confirmed `bg-primary`, `text-destructive`, `border-success/30 bg-success/10`,
      `aria-invalid`, `border-input` all present and resolving to the new token values.
      **Gap**: could not capture an actual browser screenshot or exercise the authenticated
      `/dashboard` and `/dashboard/dog` routes end-to-end in this environment — the app's
      Supabase project requires email confirmation before a session is issued, and no
      headless browser was available locally. Automated (lint/build) and static
      (grep + rendered-HTML class inspection) verification substitute for this gap; a human
      should do one real click-through in a browser (with a confirmed test account or local
      Supabase + "Confirm email" disabled) before merge.

