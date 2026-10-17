# Reviewer ToolLoopAgent Refactor — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

Turn the single-file reviewer CLI into modular code built on the AI SDK `ToolLoopAgent`, with the prompt and schema in separate modules. The reviewer must be importable so promptfoo evals can drive it later.

## Starting Point

`reviewer/src/index.ts` does stdin, env, OpenRouter wiring and a `generateText` call in one file. `review-schema.ts` holds both the contract and the system prompt. It works against a free OpenRouter model.

## Desired End State

`createReviewer(model)` returns a `ToolLoopAgent`; a side-effect-free barrel exports it with the schema; a thin `cli.ts` keeps `npm run review` working as before.

## Key Decisions Made

| Decision     | Choice                                   | Why                                                |
| ------------ | ---------------------------------------- | -------------------------------------------------- |
| Prompt       | Moved to `src/prompts.ts`                | Schema file stays a pure contract                  |
| Agent API    | `createReviewer(model)` factory          | Evals and tests inject any model; no env in module |
| Tools        | None, `Output.object` only               | Diff is the whole input; loop is one step          |
| Verification | tsc + eslint + manual smoke (free model) | No test runner in scope; evals come later          |

## Scope

**In scope:** prompt/schema split, agent factory, barrel, thin CLI, `process.exitCode` fix.

**Out of scope:** promptfoo/eval setup, tools, unit tests, anything outside `reviewer/`.

## Architecture / Approach

`prompts.ts` + `review-schema.ts` → `agent.ts` (`createReviewer`, `reviewDiff`) → `index.ts` barrel (package `exports`, for evals) and `cli.ts` (stdin/env/OpenRouter).

## Phases at a Glance

| Phase                          | What it delivers                   | Key risk                         |
| ------------------------------ | ---------------------------------- | -------------------------------- |
| 1. Contract and prompt modules | Prompt split from schema           | Missed import of `SYSTEM_PROMPT` |
| 2. Agent module and barrel     | `createReviewer`, `reviewDiff`     | Result shape differs from docs   |
| 3. Thin CLI and verification   | `cli.ts`, script update, smoke run | Free-model rate limits           |

**Prerequisites:** `reviewer/.env` with key and model (done).
**Estimated effort:** ~1 session, 3 small phases.

## Open Risks & Assumptions

- Free OpenRouter models can be rate-limited or unstable during the smoke run.
- Assumes `ToolLoopAgent` supports `output` with `Output.object` on this model (docs say yes).

## Success Criteria (Summary)

- `git diff | npm run review` returns the same valid review JSON as today.
- The reviewer is importable from `src/reviewer.ts` with no side effects.
- tsc and ESLint are clean.
