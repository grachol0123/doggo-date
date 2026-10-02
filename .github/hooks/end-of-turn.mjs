#!/usr/bin/env node
// agentStop (GitHub Copilot CLI) / Stop (VS Code Local): sweep everything
// this turn changed, send the agent back once.
//
// Covers edits made via shell commands too (never reach the per-edit hook).
// Respects stop_hook_active so the agent gets exactly one retry.
//
// Typecheck is scoped to files changed in this turn: the project baseline
// (npx tsc --noEmit) has a pre-existing, out-of-scope error in
// src/pages/api/dogs/save.ts, so an unscoped check would block on a clean
// tree. See 10x-configure-hook SKILL.md step 3 ("never ship a Stop hook
// that blocks on a clean tree").
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NO_COLOR = "1";
process.env.FORCE_COLOR = "0";

const LINTED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".astro"]);
const IS_WIN = process.platform === "win32";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { cwd: repoRoot, stdio: "pipe", shell: IS_WIN, encoding: "utf8" });
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function succeed() {
  // No output on success: valid for both the CLI (nothing to append) and
  // VS Code Local (no block requested).
  process.exit(0);
}

const payload = parsePayload(readStdin());
if (payload.stop_hook_active === true) succeed();

let changed = [];
try {
  const tracked = execSync("git diff --name-only HEAD", { cwd: repoRoot, encoding: "utf8" });
  const untracked = execSync("git ls-files -o --exclude-standard", { cwd: repoRoot, encoding: "utf8" });
  changed = [...new Set([...tracked.split(/\r?\n/), ...untracked.split(/\r?\n/)])].map((f) => f.trim()).filter(Boolean);
} catch {
  succeed();
}

if (changed.length === 0) succeed();

const changedSet = new Set(changed.map((f) => f.replace(/\\/g, "/")));
const lintFiles = changed.filter((f) => LINTED_EXT.has(path.extname(f)) && existsSync(path.resolve(repoRoot, f)));

let report = "";

if (lintFiles.length > 0) {
  const lintResult = run("npx", ["eslint", "--quiet", ...lintFiles]);
  if (!lintResult.ok) report += `\nESLint errors in changed files:\n${lintResult.out}`;
}

// No unit/integration test runner is wired yet (test-plan.md §4, §3 Phase 2
// "not started") — nothing to run here until that lands.

// Generated Astro content types are gitignored; regenerate before typecheck.
run("npx", ["astro", "sync"]);

const tscResult = run("npx", ["tsc", "--noEmit", "--pretty", "false"]);
if (!tscResult.ok) {
  const relevant = tscResult.out.split(/\r?\n/).filter((line) => {
    const m = /^([^():]+)\((\d+),(\d+)\)/.exec(line);
    return m ? changedSet.has(m[1].replace(/\\/g, "/")) : false;
  });
  if (relevant.length > 0) report += `\nTypecheck fails in changed files:\n${relevant.join("\n")}`;
}

if (report) {
  const msg = `Fix these before you finish:${report}`;
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: msg,
      hookSpecificOutput: { hookEventName: "Stop", decision: "block", reason: msg },
    }),
  );
}
succeed();
