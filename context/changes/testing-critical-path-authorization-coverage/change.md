---
change_id: testing-critical-path-authorization-coverage
title: Rollout Phase 1 - critical-path authorization coverage
status: implementing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical-path authorization coverage".
Risks covered: #1 (unauthenticated/cross-user access to dog/match/message data), #5 (guessable photo storage paths).
Test types planned: integration.
Risk response intent:
- #1: prove unauthenticated request → 401/redirect never data; owner A cannot read/mutate owner B's rows even via direct API call, not just hidden UI.
- #5: prove photo storage paths stay non-sequential/non-guessable and write/update/delete stay scoped to the owner.
After creating the folder, follow the downstream continuation rule.
