# CI/CD AI Code Review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Every PR to `main`/`master` gets an automated AI review (six 1–10 scores, binding pass/fail, Markdown summary) posted as a comment, labelled `ai-cr:passed`/`ai-cr:failed`, with a failing check on `fail`. This gives reviewers a consistent first pass (lesson m5l3).

## Starting Point

A working scaffold exists uncommitted: workflow, composite action, CI entrypoint using the Copilot CLI, and a promptfoo config. It typechecks, builds and evals locally, but has never run in Actions and the secret is missing.

## Desired End State

Opening a PR triggers the check; the comment and label match the verdict; `ai-cr:review` re-runs it. Proven on two real PRs.

## Key Decisions Made

| Decision       | Choice                                   | Why                                        | Source      |
| -------------- | ---------------------------------------- | ------------------------------------------ | ----------- |
| Model provider | Copilot CLI, no tools                    | GitHub Models retired; OpenRouter declined | Plan (user) |
| Auth           | `COPILOT_GITHUB_TOKEN` PAT secret        | Copilot CLI's documented Actions auth      | Plan        |
| Bundle         | Built in the action (`npm ci` + esbuild) | No committed `dist`                        | Research    |
| Base branches  | `main` and `master`                      | Default is `main`; matches `ci.yml`        | Research    |
| Merge gate     | Failing check only                       | Branch protection API 403 on this plan     | Research    |
| Forks          | Skipped                                  | Secrets are not exposed to fork PRs        | Plan        |
| Large diffs    | Truncate at 90k chars, flag in summary   | argv size limit                            | Plan        |

## Scope

**In scope:** entrypoint hardening, workflow/action hardening, promptfoo evals, live validation.

**Out of scope:** OpenRouter, business/architecture criteria, branch protection, promptfoo in CI, fork PRs.

## Architecture / Approach

`review.yml` computes the PR diff to a file, calls `./.github/actions/ai-reviewer`, which builds `reviewer/` and runs `dist/review.js` (Copilot CLI, no tools). The workflow then comments, swaps labels and gates on the verdict.

## Phases at a Glance

| Phase                   | What it delivers                          | Key risk                                 |
| ----------------------- | ----------------------------------------- | ---------------------------------------- |
| 1. Entrypoint hardening | Deterministic failures, score range check | Model returns malformed JSON             |
| 2. Workflow hardening   | Fork/secret guard, pinned CLI             | Premium-request billing on the PAT owner |
| 3. Promptfoo evals      | Three-model comparison runs clean         | Models miss the `defaultProps` flaw      |
| 4. Live validation      | Proven on two PRs                         | Copilot CLI behaviour on runners         |

**Prerequisites:** Copilot plan, PAT with "Copilot Requests", repo secret.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Assumed the PAT owner's Copilot plan covers the usage.
- Copilot CLI model ids differ by version; pin and recheck.
- Prompt injection via diff is mitigated by disabling all tools.

## Success Criteria (Summary)

- A flawed PR ends red with `ai-cr:failed`; a clean PR ends green with `ai-cr:passed`.
- Label re-run works without cancelling unrelated runs.
