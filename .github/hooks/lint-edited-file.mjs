#!/usr/bin/env node
// postToolUse (GitHub Copilot CLI) / PostToolUse (VS Code Local): lint only
// the file(s) this edit touched.
//
// Serves both runtimes from one script: the path field inside the tool
// arguments is undocumented for either runtime, so this recursively collects
// any file_path / filePath / path value from the parsed tool arguments.
// Self-locates the repo root from this script's own path, independent of cwd.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NO_COLOR = "1";
process.env.FORCE_COLOR = "0";

// Extensions covered by eslint.config.js (base + react + astro + scripts configs).
const LINTED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".astro"]);
const READ_ONLY_TOOL = /read|view|search|grep|list|glob|fetch|get_/i;
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

function maybeParseJSON(value) {
  if (value == null) return undefined;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Walk any nested object/array and collect file_path / filePath / path strings
// (multi-file edits nest paths, e.g. replacements[].filePath).
function collectPaths(node, out = new Set()) {
  if (node == null) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectPaths(item, out);
    return out;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if ((key === "file_path" || key === "filePath" || key === "path") && typeof value === "string") {
        out.add(value);
      } else {
        collectPaths(value, out);
      }
    }
  }
  return out;
}

const payload = parsePayload(readStdin());

const toolName = String(payload.toolName ?? payload.tool_name ?? "").toLowerCase();
if (READ_ONLY_TOOL.test(toolName)) process.exit(0);

const toolArgs =
  payload.tool_input ??
  maybeParseJSON(payload.toolArgs) ??
  (typeof payload.toolArgs === "object" ? payload.toolArgs : {}) ??
  {};

const files = [...collectPaths(toolArgs)]
  .filter((f) => LINTED_EXT.has(path.extname(f)))
  .map((f) => (path.isAbsolute(f) ? f : path.resolve(repoRoot, f)))
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
  const msg = failed.trim();
  // CLI reads top-level additionalContext; VS Code Local reads the nested
  // hookSpecificOutput form. Exit 0 either way — non-zero "fails open" on
  // the CLI for postToolUse, so the message must travel via stdout JSON.
  process.stdout.write(
    JSON.stringify({
      additionalContext: msg,
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg },
    }),
  );
}
process.exit(0);
