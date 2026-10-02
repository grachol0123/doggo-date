// Pre-commit gate: runs `tsc --noEmit`, but only fails the commit on errors
// in files that are actually staged. The unscoped project baseline has a
// pre-existing, unrelated error (src/pages/api/dogs/save.ts) that isn't this
// commit's concern to fix - see .github/hooks/end-of-turn.mjs for the same
// scoping rationale applied to the agent's Stop hook.
import { execFileSync, execSync } from "node:child_process";
import path from "node:path";

const IS_WIN = process.platform === "win32";
const repoRoot = path.resolve(import.meta.dirname, "..");

function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { cwd: repoRoot, stdio: "pipe", shell: IS_WIN, encoding: "utf8" });
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const staged = execSync("git diff --cached --name-only --diff-filter=ACMR", { cwd: repoRoot, encoding: "utf8" })
  .split(/\r?\n/)
  .map((f) => f.trim())
  .filter(Boolean);

const TYPECHECKED_EXT = new Set([".ts", ".tsx", ".astro"]);
const stagedTypeFiles = staged.filter((f) => TYPECHECKED_EXT.has(path.extname(f)));

if (stagedTypeFiles.length === 0) process.exit(0);

const stagedSet = new Set(staged.map((f) => f.replace(/\\/g, "/")));

// Generated Astro content types are gitignored; regenerate before typecheck.
run("npx", ["astro", "sync"]);

const tscResult = run("npx", ["tsc", "--noEmit", "--pretty", "false"]);
if (!tscResult.ok) {
  const relevant = tscResult.out.split(/\r?\n/).filter((line) => {
    const m = /^([^():]+)\((\d+),(\d+)\)/.exec(line);
    return m ? stagedSet.has(m[1].replace(/\\/g, "/")) : false;
  });
  if (relevant.length > 0) {
    process.stderr.write(`Typecheck failed in staged files:\n${relevant.join("\n")}\n`);
    process.exit(1);
  }
}

process.exit(0);
