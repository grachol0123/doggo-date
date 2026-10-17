# Reviewer

AI code review for pull requests, powered by the GitHub Copilot CLI.

## CI

`.github/workflows/review.yml` runs on every PR to `main`/`master` (same-repo PRs only) and:

1. computes the diff (fixtures, lockfiles and `context/` are excluded),
2. runs `reviewer/dist/review.js` through the `ai-reviewer` composite action,
3. posts the review as a PR comment, sets `ai-cr:passed` / `ai-cr:failed`, and fails the check on a `fail` verdict.

Add the `ai-cr:review` label to re-run a review.

**Required secret:** `COPILOT_GITHUB_TOKEN` — a fine-grained PAT with the "Copilot Requests" permission, from an account with Copilot.

## Local commands

```powershell
cd reviewer
npm ci
npm run typecheck
npm test            # parseReview unit tests
npm run build       # bundles dist/review.js
```

## Promptfoo evals

Compares models on the fixtures in `fixtures/`. On Windows point `COPILOT_JS` at the installed CLI:

```powershell
$env:COPILOT_JS = "C:\Program Files\nodejs\node_modules\@github\copilot\index.js"
npx promptfoo eval --no-cache -j 2
```

The React fixture is a known soft spot: models often miss that React 19 ignores `defaultProps`.
Keep `prompts/review.txt` in sync with `SYSTEM_PROMPT` in `src/copilot.ts`.
