import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { REVIEW_SCHEMA } from "./review-schema.js";
import { SYSTEM_PROMPT } from "./prompts.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_MODEL;
  if (!apiKey || !modelId) {
    throw new Error("Set OPENROUTER_API_KEY and OPENROUTER_MODEL (e.g. in your shell or via --env-file).");
  }

  const diff = await readStdin();
  if (!diff.trim()) throw new Error("Empty diff on stdin. Usage: git diff | npm run review");

  const openrouter = createOpenRouter({ apiKey });
  const { output, usage } = await generateText({
    model: openrouter(modelId),
    system: SYSTEM_PROMPT,
    prompt: diff,
    output: Output.object({ schema: REVIEW_SCHEMA }),
  });

  console.log(JSON.stringify(output, null, 2));
  console.error("usage:", JSON.stringify(usage));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
