# Dashboard sidebar navigation Implementation Plan

## Overview

Extract the current dashboard navigation controls into a reusable sidebar and
introduce a dashboard-specific layout shared by `/dashboard` and
`/dashboard/dog`. This keeps the existing authenticated information and dog
profile access intact while freeing the main dashboard content area for the
future browse-dogs view.

## Current State Analysis

The authenticated dashboard is currently a single centered card that mixes page
content with persistent navigation controls, including the dog profile link and
sign-out form (`src/pages/dashboard.astro:2-27`). The dog profile page has its
own standalone layout wrapper and card, even though it belongs to the same
dashboard area (`src/pages/dashboard/dog.astro:2-63`). The base layout is
purposefully generic and only provides document chrome plus config banners, so a
dashboard shell belongs in a dedicated wrapper rather than `Layout.astro`
(`src/layouts/Layout.astro:1-46`). Existing style conventions for authenticated
UI already use `Astro.locals.user` plus glassmorphism classes in Astro
components (`src/components/Topbar.astro:2-13`).

## Desired End State

Authenticated dashboard pages render inside a shared `DashboardLayout` that
wraps `Layout.astro`, paints the existing dark theme container, and places a
reusable `Sidebar.astro` next to page-specific main content. The sidebar owns
the user's email, the `/dashboard/dog` navigation link, and the existing
sign-out form, while `/dashboard` keeps only the welcome copy in its main area
and `/dashboard/dog` keeps its current form logic unchanged inside the new shell.

### Key Discoveries:

- `src/pages/dashboard.astro:2-27` already contains every element that needs to
  move into shared navigation, so no new route or data dependency is required.
- `src/pages/dashboard/dog.astro:2-63` already resolves all data server-side
  before rendering `DogProfileForm`, which means the change is layout-only.
- `src/components/Topbar.astro:2-13` shows the repository's preferred
  `Astro.locals.user` access pattern and the glassmorphism styling vocabulary to
  reuse.
- `context/foundation/roadmap.md:77-88` defines F-02 as a low-risk UI
  foundation that unlocks browse-dogs work and should not introduce new domain
  routes or data changes.

## What We're NOT Doing

- Adding browse-dogs, matches, or any placeholder links for routes that do not
  exist yet
- Changing auth middleware, Supabase queries, or dog profile form behavior
- Introducing new dependencies, data models, or API routes
- Reworking unrelated shared UI such as `Topbar.astro`, `Banner.astro`, or auth
  pages

## Implementation Approach

Create a dashboard-only composition layer instead of extending the global
layout. The sidebar will be a simple Astro component that reads the authenticated
user the same way other server-rendered components do, while `DashboardLayout`
will be responsible for the responsive two-column shell and theme container.
Once that shell exists, migrate both dashboard pages into it and leave their
page-specific content focused on the main slot.

## Phase 1: Create the shared dashboard shell

### Overview

Introduce the reusable sidebar and dashboard layout that establish the shared
navigation contract for current and future `/dashboard/*` pages.

### Changes Required:

#### 1. Sidebar navigation component

**File**: `src/components/Sidebar.astro`

**Intent**: Add a reusable dashboard sidebar that centralizes the authenticated
navigation controls currently duplicated in page content. This keeps the
navigation surface stable as later dashboard subviews are added.

**Contract**: The component reads the current user via `Astro.locals.user`,
renders the user's email, renders a `/dashboard/dog` link labeled `Mój profil
psa`, preserves the existing `POST /api/auth/signout` form flow, and includes a
single HTML comment marking where future `Przeglądaj` / `Matche` items will be
added.

#### 2. Dashboard layout wrapper

**File**: `src/layouts/DashboardLayout.astro`

**Intent**: Create a dashboard-scoped layout that wraps `Layout.astro` and
provides the shared shell for authenticated dashboard pages without modifying
the base document layout.

**Contract**: The layout accepts an optional `title` prop, renders the cosmic
background container with `flex-col md:flex-row`, places `<Sidebar />` beside
`<main class="flex-1">`, and exposes the page body through a slot.

### Success Criteria:

#### Automated Verification:

- `src/components/Sidebar.astro` exists and contains the `/dashboard/dog` link
  plus the existing sign-out form action.
- `src/layouts/DashboardLayout.astro` exists, wraps `Layout.astro`, and renders
  `Sidebar.astro` beside a slotted `<main class="flex-1">` region.

#### Manual Verification:

- On desktop widths, the sidebar reads as a fixed-width glass panel beside the
  main content area.
- On mobile widths, the sidebar stacks above the main content without requiring
  client-side interactivity.

## Phase 2: Migrate dashboard pages and validate the shell

### Overview

Apply the shared layout to existing dashboard pages, remove navigation controls
from page bodies, and verify that the authenticated dashboard experience remains
unchanged apart from the new shell structure.

### Changes Required:

#### 1. Main dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the current all-in-one card with page content that lives in
the dashboard layout's main slot. The page should keep only the welcome heading
and authenticated helper text because navigation now belongs to the sidebar.

**Contract**: The page imports `DashboardLayout` instead of `Layout.astro`,
removes the `/dashboard/dog` CTA and sign-out form from its body, and preserves
the `Dashboard` heading, `Welcome, {user?.email}` copy, and authenticated-only
message inside the main content card.

#### 2. Dog profile dashboard page

**File**: `src/pages/dashboard/dog.astro`

**Intent**: Bring the dog profile page into the shared dashboard shell so every
current dashboard route exposes the same navigation frame.

**Contract**: The page imports `DashboardLayout`, keeps the current server-side
Supabase lookup and `DogProfileForm` rendering logic intact, and moves its card
into the shared layout's main slot without changing form contracts or routes.

#### 3. Change tracking artifacts

**Files**:

- `context/changes/dashboard-sidebar-nav/change.md`
- `context/foundation/roadmap.md`

**Intent**: Keep the 10x change record and roadmap state synchronized with the
planning and execution lifecycle for F-02.

**Contract**: `change.md` advances from `new` to `planned` during plan save and
later to implementation-active state during execution, while the F-02 roadmap
entry moves forward-only from `proposed` to `planning` and then `in-progress`.

### Success Criteria:

#### Automated Verification:

- `src/pages/dashboard.astro` and `src/pages/dashboard/dog.astro` both import
  `DashboardLayout`.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- `/dashboard` shows the welcome content in the main panel with no duplicate dog
  profile link or sign-out button in the page body.
- `/dashboard/dog` shows the existing dog profile form in the main panel while
  the shared sidebar remains visible and usable.

## Testing Strategy

### Unit Tests:

- No dedicated unit-test suite exists for this UI-only refactor; rely on
  existing static analysis and build checks.

### Integration Tests:

- Run `npm run lint` to catch Astro/TypeScript/template issues.
- Run `npm run build` to verify the SSR app compiles with the new layout shell.

### Manual Testing Steps:

1. Open `/dashboard` as an authenticated user and confirm the sidebar shows the
   email, `Mój profil psa`, and `Wyloguj`.
2. Confirm the `/dashboard` main area still shows the dashboard heading,
   welcome message, and authenticated-only helper text.
3. Open `/dashboard/dog` and confirm the dog profile form still renders with
   the shared sidebar visible.

## Performance Considerations

This change is server-rendered composition only and does not add new client-side
JavaScript or new network requests. The only performance concern is keeping the
shell purely presentational so the dog profile page's existing form hydration
remains the only interactive island.

## Migration Notes

No data migration or route migration is required. Existing authenticated URLs
stay the same; only their surrounding layout hierarchy changes.

## References

- Roadmap item: `context/foundation/roadmap.md`
- Current dashboard implementation: `src/pages/dashboard.astro:2-27`
- Current dog profile page: `src/pages/dashboard/dog.astro:2-63`
- Base layout wrapper: `src/layouts/Layout.astro:1-46`
- Styling/user pattern reference: `src/components/Topbar.astro:2-13`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Create the shared dashboard shell

#### Automated

- [x] 1.1 Sidebar.astro exists with dog profile link and sign-out form — 5c97ea3
- [x] 1.2 DashboardLayout.astro wraps Layout and renders Sidebar beside slotted main content — 5c97ea3

#### Manual

- [x] 1.3 Sidebar reads as a fixed-width glass panel on desktop — 5c97ea3
- [x] 1.4 Sidebar stacks above the main content on mobile — 5c97ea3

### Phase 2: Migrate dashboard pages and validate the shell

#### Automated

- [x] 2.1 Dashboard and dog pages import DashboardLayout — 5c97ea3
- [x] 2.2 npm run lint passes — 5c97ea3
- [x] 2.3 npm run build passes — 5c97ea3

#### Manual

- [x] 2.4 Dashboard main panel shows welcome content without duplicate navigation controls — 5c97ea3
- [x] 2.5 Dog profile form renders inside the shared dashboard shell — 5c97ea3
