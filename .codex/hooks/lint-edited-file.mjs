#!/usr/bin/env node
// PostToolUse (apply_patch): lint only the file(s) this edit touched.
//
// Codex's apply_patch payload has no tool_input.file_path — the edited
// paths must be parsed from the raw patch text in tool_input.command
// (see .codex/hooks.json + references/codex.md). Self-locates the repo
// root from this script's own path, so it works regardless of the
// session's current working directory.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NO_COLOR = "1";
process.env.FORCE_COLOR = "0";

// Extensions covered by eslint.config.js (base + react + astro + scripts configs).
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

function extractPaths(patch) {
  if (typeof patch !== "string" || !patch) return [];
  const re = /^\*\*\* (?:Update File|Add File|Move to): (.+)$/gm;
  const out = [];
  let m;
  while ((m = re.exec(patch))) out.push(m[1].trim());
  return out;
}

const payload = parsePayload(readStdin());
const files = extractPaths(payload?.tool_input?.command)
  .filter((f) => LINTED_EXT.has(path.extname(f)))
  .map((f) => path.resolve(repoRoot, f))
  .filter((f) => existsSync(f));

if (files.length === 0) process.exit(0);

let failed = "";
for (const file of files) {
  try {
    execFileSync("npx", ["eslint", "--fix", "--quiet", file], {
      cwd: repoRoot,
      stdio: "pipe",
      shell: IS_WIN,
      encoding: "utf8",
    });
  } catch (err) {
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    failed += `\nESLint reported errors in ${path.relative(repoRoot, file)}:\n${out}`;
  }
}

if (failed) {
  process.stderr.write(failed.trim() + "\n");
  process.exit(2);
}
process.exit(0);
