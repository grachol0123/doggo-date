# CI/CD AI Code Review Implementation Plan

## Overview

Run an AI code review on every pull request to `main`/`master` through a composite action backed by the `reviewer/` package, using the **Copilot CLI** as the model provider (GitHub Models is retired; OpenRouter is explicitly not used). The review posts a summary comment, applies `ai-cr:passed` / `ai-cr:failed`, fails the check on `fail`, and can be re-run by adding `ai-cr:review`. Promptfoo evals compare models on the same review prompt.

## Current State Analysis

A first working scaffold already exists in the working tree (uncommitted): `.github/workflows/review.yml`, `.github/actions/ai-reviewer/action.yml`, `reviewer/src/{review,copilot}.ts`, `reviewer/promptfooconfig.yaml`, `reviewer/providers/copilot.mjs`, `reviewer/prompts/`, `reviewer/fixtures/`. `npm run typecheck` and `npm run build` pass; a local promptfoo run completes with no technical errors. Not yet verified: a real run in GitHub Actions, and the `COPILOT_GITHUB_TOKEN` secret does not exist yet.

## Desired End State

Opening a PR to `main`/`master` triggers the `AI Code Review` check; within minutes the PR has a Markdown summary comment and exactly one of `ai-cr:passed` / `ai-cr:failed`; a `fail` verdict turns the check red; adding `ai-cr:review` re-runs the review. Verified on a real PR.

### Key Discoveries:

- Action/reviewer contract is file-in/JSON-out via env: `DIFF_FILE`, `PR_TITLE`, `PR_BODY`, `REVIEW_MODEL`, `COPILOT_GITHUB_TOKEN` (`reviewer/src/review.ts`, `.github/actions/ai-reviewer/action.yml`).
- Review schema already matches the requirements' six criteria + verdict (`reviewer/src/review-schema.ts`).
- Branch protection API returns 403 on this plan, so the gate is a failing check only (research.md, Gap 4).
- Copilot CLI accepts `--available-tools` with no values to disable all tools; used so untrusted diffs cannot trigger actions (`reviewer/src/copilot.ts`).
- Local Copilot CLI rejects model ids it does not know (e.g. `gpt-5.4-mini`); model ids must be validated against the CLI version in CI.

## What We're NOT Doing

- OpenRouter / any other paid provider; GitHub Models (retired).
- Business-fit and architecture-fit review criteria (deferred in requirements).
- Hard merge blocking via branch protection (unavailable on this plan).
- Review of fork PRs (no secrets are exposed to them; the job is skipped).
- Running promptfoo in CI.

## Implementation Approach

Treat the existing scaffold as the baseline: harden it, validate it end-to-end, then commit. Phases: (1) reviewer entrypoint hardening, (2) workflow + action hardening, (3) evals, (4) live validation on a real PR.

## Phase 1: Reviewer entrypoint hardening

### Overview

Make `reviewer/dist/review.js` fail loudly and deterministically.

### Changes Required:

#### 1. Copilot invocation and parsing

**File**: `reviewer/src/copilot.ts`, `reviewer/src/review.ts`

**Intent**: Ensure a malformed or empty model answer exits non-zero with a clear message, and a truncated diff is flagged in the summary. Keep stdout reserved for the review JSON.

**Contract**: `parseReview(output): Review` throws on missing JSON or schema mismatch; scores outside 1–10 are rejected (range is enforced here because the zod schema is intentionally unbounded, `review-schema.ts` header). `reviewWithCopilot(diff, pr, model?)` unchanged.

#### 2. Local CLI stays on its own path

**File**: `reviewer/src/cli.ts`

**Intent**: Leave the OpenRouter-based local CLI untouched; CI does not depend on it.

**Contract**: No change; `npm start` behaviour identical.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `cd reviewer && npm run typecheck`
- Bundle builds: `cd reviewer && npm run build`
- Out-of-range score is rejected by `parseReview` (checked with a one-off `node` call on the bundle or a tsx script)

#### Manual Verification:

- `DIFF_FILE=<diff> PR_TITLE=t COPILOT_GITHUB_TOKEN=… node reviewer/dist/review.js` prints valid review JSON locally

**Implementation Note**: pause for manual confirmation before Phase 2.

---

## Phase 2: Workflow and action hardening

### Overview

Make the workflow safe and correct for real PRs.

### Changes Required:

#### 1. Fork and secret guard

**File**: `.github/workflows/review.yml`

**Intent**: Skip the review for fork PRs and when the secret is absent, instead of failing with an opaque error.

**Contract**: job `if` additionally requires `github.event.pull_request.head.repo.full_name == github.repository`; keeps the existing `labeled` condition for `ai-cr:review`.

#### 2. Pin and consistency

**File**: `.github/workflows/review.yml`, `.github/actions/ai-reviewer/action.yml`

**Intent**: Keep third-party actions pinned (SHA + tag comment) and the Copilot CLI install deterministic.

**Contract**: `npm install -g @github/copilot@<pinned version>` instead of `@latest`; Node from `.nvmrc`.

### Success Criteria:

#### Automated Verification:

- Workflow YAML parses: `npx --yes yaml valid .github/workflows/review.yml .github/actions/ai-reviewer/action.yml` (or `actionlint` if available)
- No untrusted `${{ }}` interpolation inside `run:` blocks: `rg '\$\{\{ *(github\.event|inputs)' .github/workflows/review.yml .github/actions/ai-reviewer/action.yml` shows matches only under `env:`/`with:`

#### Manual Verification:

- Repository secret `COPILOT_GITHUB_TOKEN` (fine-grained PAT, "Copilot Requests") is created

---

## Phase 3: Promptfoo evals

### Overview

Keep the existing three-model comparison runnable and documented.

### Changes Required:

#### 1. Config and provider

**File**: `reviewer/promptfooconfig.yaml`, `reviewer/providers/copilot.mjs`, `reviewer/prompts/review.txt`

**Intent**: Same review prompt on three Copilot-available models; React 16→19 diff with three planted flaws, `llm-rubric` judge, and a static javascript assertion that `verdict === "fail"`. Keep `prompts/review.txt` in sync with `SYSTEM_PROMPT`.

**Contract**: model ids limited to those accepted by the installed Copilot CLI; `COPILOT_JS` env var documented for Windows.

### Success Criteria:

#### Automated Verification:

- Eval completes with 0 errors: `cd reviewer && npx promptfoo eval --no-cache -j 2`

#### Manual Verification:

- Per-model pass/fail results reviewed; the known miss (React 19 ignoring `defaultProps`) is acknowledged rather than hidden by loosening the rubric

---

## Phase 4: Live validation on a real PR

### Overview

Prove the gate end-to-end.

### Changes Required:

#### 1. Test PRs

**Intent**: Open a PR containing the SQL-injection fixture change and one clean PR; confirm both outcomes, then the label re-run.

**Contract**: expected `ai-cr:failed` + red check for the first, `ai-cr:passed` + green for the second.

### Success Criteria:

#### Automated Verification:

- `gh run list --workflow "AI Code Review" --limit 3` shows completed runs

#### Manual Verification:

- Comment, label and check status match the verdict on both PRs
- Adding `ai-cr:review` re-runs the review and removes that label
- Unrelated label events do not cancel a running review

---

## Testing Strategy

### Unit Tests:

- `parseReview`: valid JSON, fenced JSON, missing JSON, out-of-range score.

### Integration Tests:

- Promptfoo evals (Phase 3); live PR runs (Phase 4).

### Manual Testing Steps:

1. Run `dist/review.js` locally on a sample diff.
2. Open a PR with an obviously flawed change.
3. Re-run via `ai-cr:review`.

## Performance Considerations

Diff is truncated to 90,000 characters (argv limit); body is optional to save tokens. Timeout is 5 minutes per review.

## Migration Notes

None. Rollback: delete `.github/workflows/review.yml`.

## References

- Related research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Templates: `.github/config-templates/m5l3-review.yml.template`, `m5l3-action.yml.template`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reviewer entrypoint hardening

#### Automated

- [ ] 1.1 Type checking passes
- [ ] 1.2 Bundle builds
- [ ] 1.3 Out-of-range score is rejected by parseReview

#### Manual

- [ ] 1.4 Local run of dist/review.js prints valid review JSON

### Phase 2: Workflow and action hardening

#### Automated

- [ ] 2.1 Workflow and action YAML parse
- [ ] 2.2 No untrusted interpolation inside run blocks

#### Manual

- [ ] 2.3 COPILOT_GITHUB_TOKEN secret is created

### Phase 3: Promptfoo evals

#### Automated

- [ ] 3.1 Eval completes with 0 errors

#### Manual

- [ ] 3.2 Per-model results reviewed and known miss acknowledged

### Phase 4: Live validation on a real PR

#### Automated

- [ ] 4.1 Workflow runs complete

#### Manual

- [ ] 4.2 Comment, label and check match verdict on both PRs
- [ ] 4.3 ai-cr:review re-runs the review and the label is removed
- [ ] 4.4 Unrelated label events do not cancel a running review
