CLAUDE.md

Before starting work, also read `LESSONS_LEARNED.md` at the repo root — an incident log of concrete git/tooling pitfalls hit by prior AI agent sessions in this repo (shared working trees, background-agent git operations, Windows `git mv` failures, etc.) and the fixes applied. It complements `context/foundation/lessons.md` (durable planning/implementation rules used by the `/10x-*` skills).

## Container runtime: Podman, not Docker

This machine has **Podman** installed instead of Docker Desktop (no `docker` CLI
on PATH). The Supabase CLI (`npx supabase start`, used for the local dev stack
and E2E test-user setup) shells out to a Docker-compatible API, so point it at
Podman's exposed named pipe before running it:

```powershell
$env:DOCKER_HOST = "npipe:////./pipe/podman-machine-default"
npx supabase start
```

Ensure the machine is running first (`podman machine list` / `podman machine start`).
Without `DOCKER_HOST` set, `supabase start` fails trying to find Docker.
