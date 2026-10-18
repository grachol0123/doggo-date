---
date: 2026-10-17T16:04:10+02:00
researcher: mgraszek (Copilot CLI)
git_commit: 7154f82743372a02026858d4d69f16b0b09462d9
branch: develop
repository: grachol0123/doggo-date
topic: "ci-cd-code-review — what exists vs. what the m5l3 requirements and templates need"
tags: [research, codebase, ci, github-actions, reviewer]
status: complete
last_updated: 2026-10-17
last_updated_by: mgraszek (Copilot CLI)
---

# Research: ci-cd-code-review

**Date**: 2026-10-17T16:04:10+02:00
**Git Commit**: 7154f82743372a02026858d4d69f16b0b09462d9
**Branch**: develop
**Repository**: grachol0123/doggo-date

## Research Question

Based on `context/changes/ci-cd-code-review/requirements.md`: what does the repo already provide for a GitHub Actions AI code review on PRs, and what gaps must the plan close (starting from `m5l3-review.yml.template` and `m5l3-action.yml.template`)? Promptfoo evals are out of scope.

## Summary

The two templates are close to the requirements, but they cannot run against the current `reviewer/` as-is. For the inspected paths only, there are four gaps and one non-gap: (1) the template action runs `dist/review.js` with a different input/env contract than `reviewer/src/cli.ts`, and no bundle step or `dist/` exists; (2) the workflow targets `master`, while the GitHub default branch is `main`; (3) `LLM_PROVIDER_API_KEY` is not confirmed to be set as a repo secret; (4) branch protection cannot be configured via API on this repo's plan, so the "merge gate" is only a failing check; non-gap: the shared review schema, scores and verdict already match the requirements, so no schema work is needed.

## Detailed Findings

### Requirements → template coverage

- Trigger on PRs to the base branch, types `opened, synchronize, reopened, labeled`; the job runs unless the event is `labeled` with a label other than `ai-cr:review` (`m5l3-review.yml.template:9-11`, `:25`) — covers "run on each new PR" and "retry on demand via `ai-cr:review`".
- Composite action isolates the review step (`m5l3-action.yml.template`, `runs: using: composite`), covering the "composite action" requirement.
- Inputs: PR title, PR body (optional, default `""`), diff via file (`m5l3-action.yml.template` inputs; `m5l3-review.yml.template:44-47`) — matches the requirement's three inputs and the body "cost trade-off".
- Side effects: PR comment, labels `ai-cr:passed` (0E8A16) / `ai-cr:failed` (B60205), removal of the `ai-cr:review` label, and a final "Gate on verdict" step exiting 1 unless the verdict is `pass` (`m5l3-review.yml.template:49-67`).
- Untrusted PR text is passed via `env`, not interpolated into the script (`m5l3-action.yml.template:44-52`). Note the workflow's "Comment and label" step also only uses `env`.
- Concurrency group per PR with `cancel-in-progress: true` (`m5l3-review.yml.template:19-20`). Inspected-path caveat: a `labeled` event for an unrelated label would cancel an in-flight review of the same PR only if its job is not skipped; the `if:` on the job prevents running but the concurrency group is evaluated at workflow level — worth verifying in the plan (unverified).

### Gap 1 — reviewer contract mismatch

- The template action expects `<action dir>/dist/review.js` reading `DIFF_FILE`, `PR_TITLE`, `PR_BODY`, `LLM_PROVIDER_API_KEY`, `REVIEW_MODEL` and printing the review JSON to stdout (`m5l3-action.yml.template:4-5, 44-55`).
- The current CLI reads the diff from **stdin**, key from `OPENROUTER_API_KEY`, model from `OPENROUTER_MODEL`, and prints JSON to stdout plus usage to stderr (`reviewer/src/cli.ts:4-9, 11-14, 17, 23-24`). It does not read the PR title/body at all.
- `reviewDiff(reviewer, diff)` takes only the diff as prompt (`reviewer/src/agent.ts`); the system prompt is Polish and mentions only the diff (`reviewer/src/prompts.ts`). Passing title/body requires changing the prompt composition.
- `reviewer/package.json` has only `dev`, `start` (tsx) and `typecheck` scripts; no build script; `tsconfig.json` has `noEmit: true`. `reviewer/.gitignore` ignores `node_modules` and `.env` only. No `dist/` directory is tracked (git ls-files for `reviewer` lists 10 files, none in `dist/`).
- Because the action runs `$GITHUB_ACTION_PATH/dist/review.js` and the action would live in `.github/actions/ai-reviewer/`, the bundle must either be committed there or built inside the action. `esbuild` is present under `reviewer/node_modules/.bin` (transitively via `tsx`) and root `node_modules/.bin`, so a single-file bundle is feasible without new tooling, but it is not a declared dependency of `reviewer`.
- Output shape matches the schema the gate reads: `verdict` ∈ {pass, fail}, six numeric scores, Markdown `summary` (`reviewer/src/review-schema.ts`), identical to the requirements' six criteria and verdict. The action validates `verdict` and exits non-zero on anything else (`m5l3-action.yml.template:56`).
- Not verified: whether the model-returned scores are range-checked anywhere (schema uses plain `z.number()` by design, see header comment in `review-schema.ts`).

### Gap 2 — base branch

- Templates trigger only on `master` (`m5l3-review.yml.template:10`). `gh repo view` reports the default branch as `main`. The existing `ci.yml` triggers on both `main` and `master` (`.github/workflows/ci.yml:8-11`). Local checkout is `develop`; a `master` branch was not seen in the first 10 branches listed (list was truncated by `select -first 10`, so its absence is not proven).
- The diff step uses `origin/$BASE_REF...HEAD` with `fetch-depth: 0` (`m5l3-review.yml.template:32, 37`); this works for any base name.

### Gap 3 — secret and cost

- `gh secret list` returned no entries; I could not confirm `LLM_PROVIDER_API_KEY` exists (the call produced empty output, not an explicit "none"). The plan must include creating it (OpenRouter key).
- Default model in the action is `z-ai/glm-5.3` (`m5l3-action.yml.template:26`); the CLI has no default and requires `OPENROUTER_MODEL`.
- Fork PRs do not receive secrets in `pull_request` workflows; not tested here (general GitHub behavior, not repo-specific evidence). The repo is private, so this may be moot.

### Gap 4 — merge gate

- `gh api repos/grachol0123/doggo-date/branches/master/protection` returned HTTP 403: "Upgrade to GitHub Pro or make this repository public". Under this plan, requiring the check in branch protection is not available via that API; the verdict can fail the check but not hard-block merge. (Not checked for `main` or via rulesets.)

### Conventions to follow

- Existing `ci.yml` uses `actions/checkout@v7`, `actions/setup-node@v7` with `.nvmrc` (`ci.yml:15-20`); templates pin by full SHA with a tag comment and use Node 24 (`m5l3-action.yml.template:35-37`), while `.nvmrc` pins a different Node (22.14.0 per repo docs). The plan should choose one; `reviewer/package.json` requires `node >=22`.
- Workflows must not add a deploy step (comment in `ci.yml:3-5`).

## Code References

- `.github/config-templates/m5l3-review.yml.template:9-11` - triggers (`master`, labeled)
- `.github/config-templates/m5l3-review.yml.template:32-37` - full-depth checkout and diff computation
- `.github/config-templates/m5l3-review.yml.template:49-67` - comment, labels, gate
- `.github/config-templates/m5l3-action.yml.template:4-5, 44-56` - reviewer contract and verdict validation
- `reviewer/src/cli.ts:4-28` - stdin/OPENROUTER_* CLI
- `reviewer/src/agent.ts` - `createReviewer`, `reviewDiff`
- `reviewer/src/review-schema.ts` - six scores + verdict + summary
- `reviewer/package.json` - scripts (no build)
- `.github/workflows/ci.yml:3-11` - existing CI triggers and no-deploy rule

## Architecture Insights

- The reviewer package already exports a clean library surface (`reviewer/src/index.ts`), so a second entrypoint (e.g. `src/review.ts`) for CI can reuse `createReviewer`/`reviewDiff` without touching the local CLI.
- Contract between action and workflow is file-based (diff file in, review JSON file out), which keeps large diffs/newlines out of step outputs.

## Historical Context (from prior changes)

- `context/changes/tool-loop-agent/change.md` - status `impl_reviewed`; the reviewer was refactored into a modular ToolLoopAgent (source of the current `reviewer/src` layout). Its plan/research were not re-read here.
- `context/changes/ci-cd-code-review/requirements.md` - copy of `.github/prompts/m5l3-requirements.md`.
- No prior change under `context/changes/` or `context/archive/` was found by filename for GitHub review workflows (directory listing only, content not grepped).

## Related Research

None checked beyond the above.

## Open Questions

1. Base branch: `main` only, or `main` + `master` like `ci.yml`?
2. Where does the bundle live: committed `dist/review.js` in `.github/actions/ai-reviewer/` or built in-action (adds `npm ci` + esbuild per run)?
3. Is `LLM_PROVIDER_API_KEY` set; which model default and PR-body policy (include body or title+diff only)?
4. Node version in the action: 24 (template) vs `.nvmrc`.
5. Accept "failing check" as the gate given branch protection is unavailable on this plan?
6. Large-diff handling (token limits/truncation) is not covered by the requirements or templates.
