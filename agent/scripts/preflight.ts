/**
 * Env preflight (`pnpm --filter agent preflight`): verifies every variable a
 * production run needs, grouped by feature. Exits 1 if anything required is
 * missing — wire this before deploy/cron so a half-configured agent never
 * starts. Values are never printed, only presence.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

interface Check {
  name: string;
  required: boolean;
  note?: string;
  ok?: () => boolean;
}

const set = (name: string) => (process.env[name] ?? "").trim().length > 0;

const GROUPS: Record<string, Check[]> = {
  database: [{ name: "DATABASE_URL", required: true }],
  models: [
    { name: "CHEAP_MODEL", required: true, note: "provider/model form" },
    { name: "STRONG_MODEL", required: true, note: "provider/model form" },
    {
      name: "model credentials",
      required: true,
      note: "at least one provider key, or ollama/* models",
      ok: () =>
        ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY", "MISTRAL_API_KEY", "DASHSCOPE_API_KEY", "OPENROUTER_API_KEY"].some(set) ||
        [process.env.CHEAP_MODEL, process.env.STRONG_MODEL].every((m) => m?.startsWith("ollama/")),
    },
  ],
  github: [
    {
      name: "github auth",
      required: true,
      note: "GitHub App (APP_ID + PRIVATE_KEY + INSTALLATION_ID) or GITHUB_TOKEN fallback",
      ok: () =>
        set("GITHUB_TOKEN") ||
        (set("GITHUB_APP_ID") && set("GITHUB_APP_PRIVATE_KEY") && set("GITHUB_APP_INSTALLATION_ID")),
    },
    { name: "GITHUB_POST_AS", required: false, note: "required before any posting — human account" },
  ],
  research: [
    { name: "EXA_API_KEY", required: false, note: "enrich step skips Exa without it" },
    { name: "PARALLEL_API_KEY", required: false, note: "enrich step skips Parallel without it" },
    { name: "RETRIEVAL_DAILY_BUDGET_USD", required: false, note: "defaults to 2" },
  ],
  videodb: [
    { name: "VIDEODB_API_KEY", required: false, note: "snippet validator only — offline job" },
  ],
  safety: [
    { name: "DISCLOSURE_TEXT", required: true, note: "R3 — every public touch carries this" },
    { name: "REVIEW_QUEUE_SECRET", required: true, note: "R6 — dashboard auth, fails closed" },
    { name: "DAILY_TOUCH_CAP", required: false, note: "defaults to 20" },
    { name: "SIGNAL_RETENTION_DAYS", required: false, note: "defaults to 90 (R7)" },
    { name: "TOUCHES_ENABLED", required: false, note: "stays false until soak is done" },
  ],
  attribution: [
    { name: "UTM_BASE_URL", required: false, note: "defaults to https://docs.videodb.io/" },
    { name: "ATTRIBUTION_WINDOW_DAYS", required: false, note: "strategy default 21" },
  ],
};

let failures = 0;
for (const [group, checks] of Object.entries(GROUPS)) {
  console.log(`\n${group}`);
  for (const c of checks) {
    const ok = c.ok ? c.ok() : set(c.name);
    const mark = ok ? "✓" : c.required ? "✗ MISSING" : "– unset";
    if (!ok && c.required) failures++;
    console.log(`  ${mark.padEnd(10)} ${c.name}${c.note ? `  (${c.note})` : ""}`);
  }
}

if (failures > 0) {
  console.error(`\npreflight failed: ${failures} required item(s) missing`);
  process.exit(1);
}
console.log("\npreflight passed");
process.exit(0);
