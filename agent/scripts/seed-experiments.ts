/**
 * Seed the three Forge experiments (`pnpm --filter agent seed:experiments`).
 * Idempotent — ON CONFLICT (name) DO NOTHING, so re-running never duplicates
 * or resets a live experiment. Exactly one starts 'running'; flip status in
 * the experiments table to rotate which variable is being tested.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { getPool } = await import("../src/mastra/lib/db");

const EXPERIMENTS = [
  {
    name: "exp-1-disclosure-wording",
    hypothesis:
      "A personal, first-person disclosure ('I work with the VideoDB team, so I'm biased') converts better than a formal one, because it reads as a peer being honest rather than a vendor pitching.",
    variable: "disclosure-wording",
    status: "running",
  },
  {
    name: "exp-2-reply-length",
    hypothesis:
      "A short reply (problem → snippet → one doc link) activates more developers than a long explainer, because stuck developers want working code, not prose.",
    variable: "reply-length",
    status: "draft",
  },
  {
    name: "exp-3-capability-mix",
    hypothesis:
      "Transcribe+search touches activate at a higher rate than frame-extraction touches, because search is harder to hand-roll and the native gap is bigger.",
    variable: "capability-mix",
    status: "draft",
  },
] as const;

const pool = getPool();
for (const e of EXPERIMENTS) {
  const res = await pool.query(
    `INSERT INTO experiments (name, hypothesis, variable, status, started_at)
     VALUES ($1, $2, $3, $4::experiment_status, CASE WHEN $4 = 'running' THEN now() END)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`,
    [e.name, e.hypothesis, e.variable, e.status],
  );
  console.log(`${e.name}: ${res.rowCount === 1 ? `inserted (${e.status})` : "already present"}`);
}
await pool.end();
process.exit(0);
