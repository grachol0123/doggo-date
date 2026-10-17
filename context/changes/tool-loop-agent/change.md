---
change_id: tool-loop-agent
title: Refactor the reviewer CLI into a modular AI SDK ToolLoopAgent
status: implementing
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

M5L2 step 2. Refactor `reviewer/src/index.ts` into a modular code-review agent built
on the AI SDK `ToolLoopAgent`. `reviewer/src/review-schema.ts` stays the single
contract. Reviewer must be exported for future promptfoo evals; eval environment is
out of scope.
