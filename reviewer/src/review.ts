// CI entrypoint (bundled to dist/review.js by `npm run build`). Called by the
// ai-reviewer composite action; prints the review JSON to stdout.
// Auth: the Copilot CLI reads COPILOT_GITHUB_TOKEN from the environment.
import { readFile } from "node:fs/promises";
import { reviewWithCopilot } from "./copilot.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}.`);
  return value;
}

async function main() {
  requireEnv("COPILOT_GITHUB_TOKEN");
  const diff = await readFile(requireEnv("DIFF_FILE"), "utf8");
  if (!diff.trim()) throw new Error("Empty diff in DIFF_FILE.");

  const review = await reviewWithCopilot(
    diff,
    { title: requireEnv("PR_TITLE"), body: process.env.PR_BODY },
    process.env.REVIEW_MODEL,
  );
  console.log(JSON.stringify(review, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
