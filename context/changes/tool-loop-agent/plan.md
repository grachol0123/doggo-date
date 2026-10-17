# Reviewer ToolLoopAgent Refactor Implementation Plan

## Overview

Refactor the single-file `reviewer/src/index.ts` (`generateText` + `Output.object`) into small modules built on the AI SDK `ToolLoopAgent`. The schema stays the single contract, the prompt moves to its own module, and the reviewer is exported as a factory so promptfoo evals can later import it with any model.

## Current State Analysis

- `reviewer/src/index.ts` mixes stdin reading, env handling, OpenRouter wiring, the model call and output printing in one file.
- `reviewer/src/review-schema.ts` holds both the contract (`REVIEW_SCHEMA`, `REVIEW_JSON_SCHEMA`, `Review`) and `SYSTEM_PROMPT`.
- Package is ESM, NodeNext, strict TS, `ai@^7`, `@openrouter/ai-sdk-provider@^3`, `zod@^4`. Script `review` runs `tsx --env-file=.env src/index.ts`.
- No tests, no tools. Verified working against `nvidia/nemotron-3-super-120b-a12b:free`.

## Desired End State

- `createReviewer(model)` returns a `ToolLoopAgent` configured with the prompt instructions and `Output.object({ schema: REVIEW_SCHEMA })`; `reviewDiff` runs it and returns a typed `Review`.
- The package entry `src/index.ts` (`exports["."]`) is a barrel that exports only the reusable surface (no env, no stdin, no side effects on import).
- `src/cli.ts` is the only place that reads stdin/env and builds the OpenRouter model. `npm run review` behaves as before.
- Verified by `tsc`, ESLint and a smoke run with the free model.

### Key Discoveries:

- `ToolLoopAgent` accepts `model`, `instructions`, `output`, optional `tools`; invoked via `agent.generate({ prompt })` (`reviewer/node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`, `03-agents/02-building-agents.mdx`).
- `ai-sdk` skill requires verifying APIs against bundled docs in `node_modules/ai/docs/`, not memory.
- `review-schema.ts` is shared by later lessons (M5L3 CI gate, promptfoo), so its exports must stay backward compatible except `SYSTEM_PROMPT`.
- Repo ESLint/prettier needs LF endings: run `npx eslint --fix` on new files from repo root.

## What We're NOT Doing

- No promptfoo config, eval datasets or eval environment.
- No tools for the agent (single-step structured output only).
- No unit-test runner or mock-model tests.
- No changes outside `reviewer/` (Astro app untouched).
- No change to the schema fields or scoring rubric.

## Implementation Approach

Three small phases: split contract from prompt, introduce the agent module and barrel, then thin the CLI over them and verify. Check the exact `generate` result shape (`output`, `usage`) in the bundled docs/types before writing code.

## Phase 1: Contract and prompt modules

### Overview

Make `review-schema.ts` a pure contract and give the prompt its own module.

### Changes Required:

#### 1. Prompt module

**File**: `reviewer/src/prompts.ts`

**Intent**: Hold the reviewer system prompt as a named export so it is edited and eval-varied independently of the schema.

**Contract**: `export const SYSTEM_PROMPT: string` with the text currently in `review-schema.ts`, unchanged.

#### 2. Schema module

**File**: `reviewer/src/review-schema.ts`

**Intent**: Keep only the contract; remove the prompt.

**Contract**: Exports `REVIEW_SCHEMA`, `REVIEW_JSON_SCHEMA`, `Review` unchanged; `SYSTEM_PROMPT` no longer exported from here.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit -p reviewer`
- Lint passes on changed files: `npx eslint reviewer/src`

#### Manual Verification:

- `review-schema.ts` contains no prompt text and `prompts.ts` contains the prompt verbatim

---

## Phase 2: Agent module and public barrel

### Overview

Build the reusable reviewer on `ToolLoopAgent`.

### Changes Required:

#### 1. Agent factory

**File**: `reviewer/src/agent.ts`

**Intent**: Encapsulate agent construction so any caller (CLI, promptfoo provider) supplies the model.

**Contract**: `createReviewer(model: LanguageModel): ToolLoopAgent` using `instructions: SYSTEM_PROMPT`, `output: Output.object({ schema: REVIEW_SCHEMA })`, no tools. `reviewDiff(agent, diff: string): Promise<{ review: Review; usage }>` calls `agent.generate({ prompt: diff })` and returns the typed output. Confirm exact types and result fields in the bundled docs.

#### 2. Barrel

**File**: `reviewer/src/index.ts` (rewritten from the old CLI into the package entry)

**Intent**: Single import point (`exports["."]`) for future promptfoo evals; no side effects.

**Contract**: Re-exports `createReviewer`, `reviewDiff`, `REVIEW_SCHEMA`, `REVIEW_JSON_SCHEMA`, `Review`, `SYSTEM_PROMPT`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit -p reviewer`
- Lint passes on changed files: `npx eslint reviewer/src`

#### Manual Verification:

- Importing `index.ts` reads no env and no stdin

---

## Phase 3: Thin CLI and verification

### Overview

Move all I/O and OpenRouter wiring into the CLI and prove it end to end.

### Changes Required:

#### 1. CLI entry point

**File**: `reviewer/src/cli.ts` (new; logic moved out of the old `index.ts`)

**Intent**: Read the diff from stdin, build the OpenRouter model from env, call `reviewDiff`, print JSON to stdout and usage to stderr; behavior identical to today.

**Contract**: Errors set `process.exitCode = 1` instead of `process.exit(1)` (avoids the Windows libuv assertion). Same env vars: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.

#### 2. Package script

**File**: `reviewer/package.json`

**Intent**: Align package metadata with the new layout (already applied): `exports["."]` → `./src/index.ts`, scripts `dev` (`tsx watch --env-file=.env src/cli.ts`), `start` (`tsx --env-file=.env src/cli.ts`), `typecheck` (`tsc --noEmit`); old `review` and `test` stub removed.

**Contract**: Phase 3 verifies `npm start` and `npm run typecheck` instead of `npm run review`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit -p reviewer`
- Lint passes on changed files: `npx eslint reviewer/src`

#### Manual Verification:

- `git diff | npm start` (from `reviewer/`) prints a valid review JSON with the free model
- Empty stdin and missing env vars give a clear error and a non-zero exit code

## Testing Strategy

### Unit Tests:

- None in this change (evals come later).

### Manual Testing Steps:

1. Pipe a small diff into `npm run review` and check six scores, verdict and summary.
2. Run with empty stdin and confirm the error message.
3. Unset `OPENROUTER_MODEL` and confirm the error message.

## Performance Considerations

None; single model call per review.

## References

- AI SDK docs: `reviewer/node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`
- Skill: `.agents/skills/ai-sdk/SKILL.md`
- Lesson prompt: `.github/prompts/m5l2-agent.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract and prompt modules

#### Automated

- [x] 1.1 Type check passes: `npx tsc --noEmit -p reviewer`
- [x] 1.2 Lint passes on changed files: `npx eslint reviewer/src`

#### Manual

- [x] 1.3 `review-schema.ts` contains no prompt text and `prompts.ts` contains the prompt verbatim

### Phase 2: Agent module and public barrel

#### Automated

- [ ] 2.1 Type check passes: `npx tsc --noEmit -p reviewer`
- [ ] 2.2 Lint passes on changed files: `npx eslint reviewer/src`

#### Manual

- [ ] 2.3 Importing `index.ts` reads no env and no stdin

### Phase 3: Thin CLI and verification

#### Automated

- [ ] 3.1 Type check passes: `npx tsc --noEmit -p reviewer`
- [ ] 3.2 Lint passes on changed files: `npx eslint reviewer/src`

#### Manual

- [ ] 3.3 `git diff | npm start` (from `reviewer/`) prints a valid review JSON with the free model
- [ ] 3.4 Empty stdin and missing env vars give a clear error and a non-zero exit code
