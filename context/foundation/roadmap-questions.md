---
project: "Doggo Date"
created: 2026-09-22
updated: 2026-09-22
---

# Roadmap Questions

Append-only register of cross-cutting questions and future-extension signals raised
*outside* the initial `/10x-roadmap` generation — discovered via cross-file review of
`prd.md`, `tech-stack.md`, `infrastructure.md`, and the codebase, plus follow-up with the
user. Mirrors `## Open Roadmap Questions` in `context/foundation/roadmap.md`; that section
references this file rather than duplicating it in full.

## RQ-01: AI-driven profile ranking based on conversation similarity

- **Raised:** 2026-09-22 (cross-file review + user)
- **Owner:** product (user)
- **Status:** open — confirmed as a post-M-1 extension candidate
- **Context:** `tech-stack.md` declares `has_ai: true` and `infrastructure.md` provisions
  an `OPENROUTER_API_KEY` secret, but no FR in `prd.md` describes any AI feature — this
  was an orphaned dependency until now. User confirmed the intended use: recommended dog
  profiles should be biased toward similarity with profiles the owner has previously
  matched/conversed with — the more conversations an owner has had, the stronger the
  similarity bias should be in future recommendations, layered on top of (not replacing)
  the user's own filters.
- **Blocks:** Nothing in M-1. S-02's MVP ranking stays as PRD's Business Logic describes
  (newest-first, then basic relevance). This is a **new FR candidate for a future
  milestone**, not required to unblock S-02.
- **Next step:** Needs its own FR in a future PRD revision — define what "similarity"
  means concretely (structured profile attributes? conversation content summarized via
  OpenRouter?) before it can be roadmapped as a slice.
- **GitHub:** #6

## RQ-02: Trust & safety — no report/block mechanism defined

- **Raised:** 2026-09-22 (cross-file review)
- **Owner:** product (user) — decision pending
- **Status:** open — not selected as a confirmed extension candidate; still unresolved
  whether this is an intentional MVP Non-Goal or a real gap
- **Context:** The app enables real-time text messaging between strangers (FR-006), but
  neither `## Functional Requirements` nor `## Non-Goals` in `prd.md` mentions reporting
  or blocking abusive users/profiles. The only stated guardrail concerns data/photo
  consent, not abuse handling.
- **Blocks:** Nothing in M-1 currently (not treated as a blocker for S-03), but flagged
  for explicit resolution before a wider public launch, given the risk profile of
  real-time messaging between strangers.
- **Next step:** Decide and record one of: (a) explicitly move to `## Non-Goals` for MVP
  with a stated rationale, or (b) add as a must-have/nice-to-have FR in a PRD revision.
- **GitHub:** #7

## RQ-03: F-01 data model will need extension for future signals

- **Raised:** 2026-09-22 (cross-file review)
- **Owner:** team
- **Status:** open — informational, does not block F-01
- **Context:** F-01's schema (`dogs` table: name, age, one photo, description) is
  intentionally minimal for M-1. Confirmed post-M-1 extension candidates (usuwanie
  matchy, AI ranking — RQ-01, wiele zdjęć, filtry dopasowania, moduł spacerów) will each
  require schema/RLS extensions beyond F-01's initial scope (e.g. multi-photo storage,
  structured dog attributes for filters/AI similarity, soft-delete on matches,
  event/location tables for group walks).
- **Blocks:** Nothing now. Flag for whoever plans the next milestone: design F-01's
  `dogs` table and RLS policies so they can be extended via additive migrations rather
  than requiring a breaking rewrite.
- **Next step:** No action needed for M-1. Revisit when the next milestone opens and any
  of the confirmed extension candidates get roadmapped.

## Confirmed post-M-1 extension candidates (2026-09-22)

User confirmed the following as candidates for a future milestone (not yet roadmapped,
not yet FRs in `prd.md`):

- Usuwanie matchy (already in PRD `## Non-Goals`; confirmed to return post-MVP)
- AI-owy ranking profili wg podobieństwa do wcześniejszych rozmów (RQ-01)
- Wiele zdjęć w profilu psa (zamiast jednego)
- Moduł spacerów grupowych (GPS + mapa, FR-007 — already nice-to-have in PRD)
- Filtry dopasowania (wiek/zainteresowania/lokalizacja) (already in PRD `## Non-Goals`;
  confirmed to return post-MVP)

These stay in `## Parked` in `roadmap.md` for M-1; they are candidates to open as
milestone M-2 once M-1 is done (per `/10x-roadmap`'s milestone loop).

## Timeline clarification (2026-09-22)

Confirmed: `hard_deadline: 2026-11-04` is correct — this project is built as part of a
training course. `mvp_weeks: 3` describes the intended pace, not a hard stop; MVP scope
is expected to extend after the initial milestone via the candidates above.
