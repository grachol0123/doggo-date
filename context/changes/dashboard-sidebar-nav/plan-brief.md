# Dashboard sidebar navigation — Plan Brief

> Full plan: `context/changes/dashboard-sidebar-nav/plan.md`

## What & Why

This change extracts the current dashboard navigation controls into a reusable
sidebar and introduces a shared dashboard layout for authenticated pages. The
goal is to free `/dashboard` from acting as both navigation hub and page body so
later browse-dogs work can use the main content area without reworking the shell
again.

## Starting Point

Today `/dashboard` is a single centered card that mixes welcome copy with the
dog profile link and sign-out action, while `/dashboard/dog` renders as a
separate standalone page with its own wrapper. The generic `Layout.astro`
already handles document chrome, so the missing piece is a dashboard-specific
shell rather than a global layout change.

## Desired End State

Both `/dashboard` and `/dashboard/dog` render inside `DashboardLayout.astro`,
which places a glassmorphism sidebar next to page-specific main content. The
sidebar shows the user's email, links to `Mój profil psa`, and preserves the
current sign-out flow, while `/dashboard` keeps only its welcome messaging in
the main panel.

## Key Decisions Made

| Decision               | Choice                                                         | Why (1 sentence)                                                                                |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Shared shell location  | Add `DashboardLayout.astro` instead of changing `Layout.astro` | The base layout is intentionally generic and should not absorb dashboard-only structure.        |
| Sidebar implementation | Use an Astro component reading `Astro.locals.user`             | Existing authenticated UI already follows this server-rendered pattern in `Topbar.astro`.       |
| Navigation scope       | Include only email, `Mój profil psa`, and sign-out             | Future browse and matches routes do not exist yet, so adding placeholders would create dead UI. |
| Dog page migration     | Keep current data-fetching and form logic unchanged            | F-02 is explicitly a UI/architecture change and should not couple to dog-profile behavior.      |

## Scope

**In scope:**

- Create `src/components/Sidebar.astro`
- Create `src/layouts/DashboardLayout.astro`
- Move dashboard navigation controls into the sidebar
- Apply the shared layout to `/dashboard` and `/dashboard/dog`
- Sync the related change and roadmap status artifacts

**Out of scope:**

- New routes, browse-dogs UI, or matches navigation
- Changes to middleware, auth pages, or domain data models
- New dependencies or client-side interactivity

## Architecture / Approach

The implementation adds a dashboard-only shell layer above existing page
content. `DashboardLayout.astro` wraps `Layout.astro`, renders the cosmic
background container, and composes `Sidebar.astro` beside a slotted main region.
Existing page logic stays where it already lives; only navigation ownership and
page composition move.

## Phases at a Glance

| Phase                                             | What it delivers                                                     | Key risk                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Create the shared dashboard shell              | Reusable sidebar component and dashboard layout wrapper              | Styling drift from the established glassmorphism theme         |
| 2. Migrate dashboard pages and validate the shell | Both dashboard pages use the shared shell and keep existing behavior | Accidental regression of the dog-profile link or sign-out flow |

**Prerequisites:** Existing `/dashboard` and `/dashboard/dog` pages remain the source of truth; no backend changes are required.
**Estimated effort:** ~1 session across 2 small phases

## Open Risks & Assumptions

- Assumes the existing authenticated user is always present on protected
  dashboard routes, matching current middleware behavior.
- Manual verification is still needed for responsive layout polish because the
  repository has no visual regression suite.

## Success Criteria (Summary)

- Authenticated dashboard pages share one reusable sidebar/layout shell.
- `/dashboard` keeps its welcome information while navigation moves entirely to
  the sidebar.
- Lint and build pass without introducing new dependencies or route changes.
