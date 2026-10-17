// promptfoo custom provider: answers a prompt through the Copilot CLI (same call as CI).
// Auth: COPILOT_GITHUB_TOKEN, or an existing `copilot login` on the machine.
// On Windows the `copilot` shim is a .cmd/.ps1 that node cannot spawn directly; set
// COPILOT_JS to the CLI entry (e.g. "C:\Program Files\nodejs\node_modules\@github\copilot\index.js").
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default class CopilotProvider {
  constructor(options = {}) {
    this.model = options.config?.model;
  }

  id() {
    return `copilot:${this.model ?? "default"}`;
  }

  async callApi(prompt) {
    const args = [
      "-p",
      prompt,
      "-s",
      "--no-ask-user",
      "--no-custom-instructions",
      "--no-color",
      ...(this.model ? ["--model", this.model] : []),
      "--available-tools",
    ];
    const [command, commandArgs] = process.env.COPILOT_JS
      ? [process.execPath, [process.env.COPILOT_JS, ...args]]
      : ["copilot", args];
    try {
      const { stdout } = await execFileAsync(command, commandArgs, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 5 * 60 * 1000,
      });
      // Same extraction as parseReview in src/copilot.ts: models sometimes wrap JSON in a code fence.
      const text = stdout.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      return { output: start !== -1 && end > start ? text.slice(start, end + 1) : text };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
