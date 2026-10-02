---
starter_id: 10x-astro-starter
package_manager: npm
project_name: doggo-date
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: custom
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: true
  has_ai: true
  has_background_jobs: false
---

## Why this stack

Doggo Date is a solo, after-hours web-app MVP with a 3-week timeline that needs
email+password auth, a Postgres-backed data model (dog profiles, matches,
messages), and a fast, cheap path to first deploy. The 10x Astro Starter
(Astro + React islands + TypeScript + Supabase + Cloudflare) covers auth,
database, and edge deployment out of the box, satisfies the solo user's stated
preference for React, and clears all four agent-friendly criteria (typed,
convention-based, popular in training data, well-documented). It was chosen
over T3 and Next.js after a direct framework comparison, since it bundles the
same needs with less manual wiring. Deployment defaults to Cloudflare Pages
per the starter's own default; CI runs on GitHub Actions with auto-deploy on
merge to main.

Messages between matched owners must be delivered instantly (sent and
received in real time), so the stack uses WebSocket-based delivery via
Supabase Realtime (built on top of the same Postgres/Supabase instance
already used for auth and data), avoiding the need for a separate realtime
service or polling.
