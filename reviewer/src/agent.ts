import { Output, ToolLoopAgent, type LanguageModel } from "ai";
import { buildReviewPrompt, SYSTEM_PROMPT, type PullRequestMeta } from "./prompts.js";
import { REVIEW_SCHEMA, type Review } from "./review-schema.js";

export function createReviewer(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    output: Output.object({ schema: REVIEW_SCHEMA }),
  });
}

export type Reviewer = ReturnType<typeof createReviewer>;

export async function reviewDiff(reviewer: Reviewer, diff: string, pr?: PullRequestMeta) {
  const { output, usage } = await reviewer.generate({ prompt: buildReviewPrompt(diff, pr) });
  return { review: output satisfies Review, usage };
}
