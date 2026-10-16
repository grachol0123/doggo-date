import { execFileSync } from "node:child_process";

/**
 * Runs a single SQL statement against the local Supabase Postgres instance via
 * the already-installed `supabase` CLI (same trusted, RLS-bypassing path the
 * project's own `supabase/seed.sql` and pgTAP suite rely on) and returns the
 * `returning` rows as parsed JSON. Local/CI-only test-harness utility — never
 * used by application code, which only ever talks to Postgres through RLS.
 */
export function runSql<T = Record<string, unknown>>(sql: string): T[] {
  const output = execFileSync("npx", ["supabase", "db", "query", sql, "-o", "json"], {
    encoding: "utf-8",
    shell: true,
  });

  // `npx supabase db query` prints update/npm-config noise on some setups before the
  // JSON array; the array itself is always the last top-level bracketed block.
  const jsonStart = output.indexOf("[");
  const jsonEnd = output.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`supabase db query returned no JSON array:\n${output}`);
  }

  return JSON.parse(output.slice(jsonStart, jsonEnd + 1)) as T[];
}
