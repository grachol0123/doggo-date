import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildReviewPrompt, SYSTEM_PROMPT, type PullRequestMeta } from "./prompts.js";
import { REVIEW_SCHEMA, type Review } from "./review-schema.js";

const execFileAsync = promisify(execFile);

// The prompt travels as one argv entry; Linux caps a single argument at ~128 KB.
const MAX_DIFF_CHARS = 90_000;

const JSON_INSTRUCTION = `Odpowiedz WYŁĄCZNIE obiektem JSON (bez bloku kodu i bez dodatkowego tekstu) o polach:
implementationCorrectness, idiomaticity, complexity, testRiskCoverage, documentation, securitySafety
(liczby całkowite 1-10), verdict ("pass" | "fail") oraz summary (Markdown).`;

export function buildCopilotPrompt(diff: string, pr?: PullRequestMeta): string {
  const truncated = diff.length > MAX_DIFF_CHARS;
  const body = truncated
    ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff obcięty — oceń tylko widoczną część i wspomnij o tym w summary]`
    : diff;
  return [SYSTEM_PROMPT, JSON_INSTRUCTION, buildReviewPrompt(body, pr)].join("\n\n");
}

export function parseReview(output: string): Review {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Copilot response contains no JSON object.");
  const review = REVIEW_SCHEMA.parse(JSON.parse(output.slice(start, end + 1)));
  const scores = [
    review.implementationCorrectness,
    review.idiomaticity,
    review.complexity,
    review.testRiskCoverage,
    review.documentation,
    review.securitySafety,
  ];
  // The schema keeps scores unbounded (structured-output limitation), so the range is enforced here.
  if (scores.some((s) => !Number.isInteger(s) || s < 1 || s > 10)) {
    throw new Error("Copilot response has a score outside the 1-10 range.");
  }
  return review;
}

export async function reviewWithCopilot(diff: string, pr: PullRequestMeta, model?: string) {
  const args = [
    "-p",
    buildCopilotPrompt(diff, pr),
    "-s",
    "--no-ask-user",
    "--no-custom-instructions",
    "--no-color",
    ...(model ? ["--model", model] : []),
    // No tools: the diff is untrusted input, so the agent must not be able to act on it.
    "--available-tools",
  ];
  const { stdout } = await execFileAsync("copilot", args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
  });
  return parseReview(stdout);
}
