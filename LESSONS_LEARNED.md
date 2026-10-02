# Lessons Learned

> Incident log from AI-agent sessions working on this repository. Append new entries at the bottom with a date heading. Distinct from `context/foundation/lessons.md`, which holds durable planning/implementation rules re-read by the `/10x-*` skills — this file documents concrete incidents, root causes, and the fix applied, for future agents (and humans) operating in this repo.

## 2026-09-26 — S-02 (browse-and-match) planning & F-02 (dashboard-sidebar-nav) parallel work

### 1. Background agents share the same git working tree — not an isolated worktree

- **What happened**: A background agent (`task` tool, `mode: "background"`) was asked to build the sidebar nav on its own branch. It ran `git checkout -b feature/dashboard-sidebar-nav` inside the **same working directory** as the main session. This switched branches for both the main session and the subagent simultaneously, while the main session had unrelated uncommitted work in progress (`match-data-foundation`). A `git status`/`npm run lint` in the main session then reported unrelated errors from files it never touched, because the branch had silently changed underneath it.
- **Root cause**: This CLI's background agents are not sandboxed/isolated — they operate on the same checkout as the parent session. Any git branch/checkout operation is a shared, global side effect.
- **Fix / mitigation**: Verified no files were lost (both slices' work was later found intact — the subagent's files on its branch, the main session's files carried over as untracked/modified on `develop`). Did not run concurrent git/lint/build from two agents against the tree at the same time going forward.
- **Rule for next time**: Never delegate git branch-switching work to a background agent sharing the main working tree. Use `git worktree add <path> <branch>` to give a background agent (or yourself) a truly isolated checkout, or restrict background agents to read-only/non-git tasks in a shared tree.

### 2. `write_agent` messages to a running background agent are queued, not delivered mid-turn

- **What happened**: After noticing the shared-tree branch switch, a "STOP" message was sent to the background agent via `write_agent`. The agent had already finished its task before the message was processed (it went idle immediately after finishing), so the message was never actually acted on mid-task.
- **Fix**: No harm resulted this time (the agent's task completed cleanly before the message arrived), but this cannot be relied upon as an interruption mechanism.
- **Rule for next time**: Treat `write_agent` as fire-and-forget for the _next_ turn, never as a real-time interrupt. Design delegated tasks so that a mid-flight stop is never required (fully spec'd, narrow scope, isolated worktree) instead of depending on being able to cancel them.

### 3. Two branches independently edited the same roadmap section → merge conflict

- **What happened**: `develop` (main session) and `feature/dashboard-sidebar-nav` (background agent) both edited `context/foundation/roadmap.md`'s F-02/S-02 status lines and the "Implementation split" note, with different (correct-at-the-time) values. `gh pr view` reported `mergeStateStatus: DIRTY` / `mergeable: CONFLICTING`.
- **Fix**: Merged `origin/develop` into the feature branch locally, manually resolved the conflict by reconciling to the actually-accurate combined state (not blindly picking "ours" or "theirs"), reran `npm run lint` + `npm run build` to confirm the merge didn't break anything, pushed, then merged the PR via `gh pr merge --merge --delete-branch`.
- **Rule for next time**: When two branches modify a shared status/tracking file (like a roadmap) in parallel, expect a conflict on merge and budget time to reconcile it by hand — don't `git merge -X ours/theirs`, since both sides usually contain partially-correct, non-overlapping information.

### 4. `git mv` failed with "Permission denied" on Windows during archive

- **What happened**: Running `/10x-archive` on `dog-profile-crud`, `git mv "context/changes/dog-profile-crud" "context/archive/2026-09-26-dog-profile-crud"` failed twice with `fatal: renaming ... failed: Permission denied`, even after a short retry delay. Likely cause: a file handle held open by an editor/IDE (VS Code) or file watcher on Windows, which blocks a rename of the containing directory.
- **Fix**: Fell back to PowerShell's `Move-Item` (per the skill's documented fallback), then `git add -A` on both the old and new paths so git could still detect the change as a set of renames (preserving history in the diff), instead of losing the rename detection entirely.
- **Rule for next time**: On Windows, if `git mv` fails with a permission error on a directory rename, don't loop-retry indefinitely — fall back to a plain filesystem move immediately, then `git add -A` both paths to recover rename detection before committing.

### 5. Unrelated pre-existing dirty files in the shared working tree

- **What happened**: At several points, `git status` showed modified/untracked files unrelated to the current task (`.github/.10x-cli-manifest.json`, `.github/copilot-instructions.md`, a stray `research.md` edit, leftover skill folders, a seed migration, a stray markdown file) — leftovers from other sessions/agents using the same checkout.
- **Fix**: Never used `git add -A` / `git add .` blindly. Always staged only the specific files intended for each commit, and used `git stash push --include-untracked -m "..." -- <specific paths>` to temporarily set aside unrelated dirty files before operations (like an archive or merge) that have hard preconditions on a clean subtree, restoring the stash afterward.
- **Rule for next time**: In a shared/long-lived working tree, always diff `git status --porcelain` against what you _expect_ to have changed before committing or running any skill with a "no uncommitted changes" precondition (e.g. `/10x-archive`). Stage explicitly, never wildcard-stage.

### 6. No local Supabase/Docker instance available — DB-level verification blocked

- **What happened**: `match-data-foundation`'s migration (RLS policies + a `SECURITY DEFINER` trigger for atomic match creation) could not be verified end-to-end because `docker ps` failed — no local Supabase stack was running or startable in this environment.
- **Fix**: Did not skip or fake the verification. Marked the specific manual/DB-dependent Progress checklist items as explicitly unchecked with a "blocked, no local Supabase instance available" note in `plan.md`, while still checking off everything that _could_ be automatically verified (`lint`, `build`, type-checks).
- **Rule for next time**: When a plan's manual verification step requires infrastructure unavailable in the current environment, document the blocker precisely in the plan's Progress section rather than marking it done or silently omitting it — leaves an honest, auditable trail for whoever runs the DB-level check later.

### 7. Mid-session collision with another actively-running agent

- **What happened**: While preparing to merge PR #10, the user reported another agent was concurrently modifying files on `feature/dashboard-sidebar-nav` in the same shared tree (a live example of lesson #1 above, but from the human-visible side this time).
- **Fix**: Immediately stopped all git operations, used `list_agents` to confirm the other agent's status, and checked `git stash list` / `git status` to verify that nothing already in flight from that other agent had been touched or lost. Resumed only after the user confirmed the other agent had finished.
- **Rule for next time**: Treat "another agent is working" as a hard stop for any git-mutating command until explicitly confirmed clear — read-only checks (`git status`, `list_agents`) are safe to run while waiting, mutating commands (`checkout`, `merge`, `stash`, `mv`) are not.

## 2026-09-27 — Running the local Supabase stack via Podman instead of Docker

### 8. `docker` binary missing, but Podman (with a running machine) works as a drop-in for `supabase start`

- **What happened**: `docker ps` / `Get-Command docker` failed (Docker Desktop not installed in this environment), which previously (see lesson #6) was treated as a hard blocker for any local Supabase/DB work. This environment actually had Podman installed instead, with a running `podman-machine-default` WSL machine exposing a Docker-API-compatible socket over SSH.
- **Fix**: Ran `podman system connection list` to get the machine's SSH URI to its Docker-compatible socket (e.g. `ssh://user@127.0.0.1:<port>/run/user/1000/podman/podman.sock`), then set `$env:DOCKER_HOST` to that URI **before** invoking any `supabase` CLI command in the same PowerShell call (env vars don't persist across separate `powershell` tool calls in this harness — must be set in the same command chain, e.g. `$env:DOCKER_HOST="..."; npx supabase start`). The Supabase CLI's Docker Go SDK honors `DOCKER_HOST` and talks to Podman transparently — no `docker` shim/alias binary needed.
- **Second issue hit**: `supabase start` then failed because the bundled `vector` (analytics/log-shipping) container tries to bind-mount `/var/run/docker.sock` to tail other containers' logs — a path Podman's rootless socket doesn't provide at that location, causing `supabase_vector_..._container is not ready` and an eventual rollback ("Stopping containers...").
- **Fix**: Set `enabled = false` under `[analytics]` in `supabase/config.toml`. This skips starting the `vector` container entirely; it is not required for local dev (DB, Auth, REST, Storage, Studio all start and work fine without it). This is a local working-tree config change — treat it as environment-specific, not something to blindly commit/ship, unless the team has standardized on Podman.
- **Rule for next time**: Don't treat "no `docker` binary" as an automatic hard blocker for local Supabase — check for Podman (`Get-Command podman`, `podman machine list`) first. To use it: (1) get the socket URI via `podman system connection list`, (2) export it as `DOCKER_HOST` in the _same_ shell invocation as the `supabase`/`docker` command, (3) if `supabase start` fails on the `vector` container specifically, disable `[analytics]` in `supabase/config.toml` — it's optional for local dev.
