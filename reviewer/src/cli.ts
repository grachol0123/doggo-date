import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createReviewer, reviewDiff } from "./index.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_MODEL;
  if (!apiKey || !modelId) {
    throw new Error("Set OPENROUTER_API_KEY and OPENROUTER_MODEL (e.g. in reviewer/.env).");
  }

  const diff = await readStdin();
  if (!diff.trim()) throw new Error("Empty diff on stdin. Usage: git diff | npm start");

  const openrouter = createOpenRouter({ apiKey });
  const { review, usage } = await reviewDiff(createReviewer(openrouter(modelId)), diff);

  console.log(JSON.stringify(review, null, 2));
  console.error("usage:", JSON.stringify(usage));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
