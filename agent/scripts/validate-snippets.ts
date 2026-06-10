/**
 * Offline snippet QA (R2): render every registry template with its
 * sampleParams and execute it against the LIVE VideoDB API. Never runs in
 * the request path — this is a nightly/CI gate; any failure exits 1 and
 * blocks deploy. Results land in snippet_validations (dashboard /snippets).
 *
 * Usage: pnpm --filter agent validate:snippets [templateId ...]
 * Needs: VIDEODB_API_KEY in the root .env, python3 with `pip install videodb`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const { snippetRegistry } = await import("../src/snippets/registry");
const { renderSnippet } = await import("../src/snippets/render");
const { getPool } = await import("../src/mastra/lib/db");

const OUTPUT_TAIL = 4000;
const TIMEOUT_MS = 5 * 60 * 1000; // uploads + indexing are slow

const apiKey = process.env.VIDEODB_API_KEY ?? process.env.VIDEO_DB_API_KEY;
if (!apiKey) {
  console.error("VIDEODB_API_KEY missing in .env — refusing to run (validator needs the live API).");
  process.exit(1);
}

// agent/.venv preferred (macOS system python is externally managed — PEP 668)
const venvPython = fileURLToPath(new URL("../.venv/bin/python", import.meta.url));
const python =
  process.env.PYTHON ?? (spawnSync(venvPython, ["--version"]).status === 0 ? venvPython : "python3");
const pythonCheck = spawnSync(python, ["-c", "import videodb"], { encoding: "utf8" });
if (pythonCheck.status !== 0) {
  console.error(`${python} cannot import videodb — run: python3 -m venv agent/.venv && agent/.venv/bin/pip install videodb`);
  process.exit(1);
}

const requested = process.argv.slice(2);
const templates = Object.values(snippetRegistry).filter(
  (t) => requested.length === 0 || requested.includes(t.id),
);
if (templates.length === 0) {
  console.error(`no templates match: ${requested.join(", ")}`);
  process.exit(1);
}

const dir = mkdtempSync(path.join(tmpdir(), "forge-snippets-"));
let anyFailed = false;

for (const template of templates) {
  const { code } = renderSnippet(template.id, template.sampleParams);
  const file = path.join(dir, `${template.id}.py`);
  writeFileSync(file, code);

  process.stdout.write(`${template.id} … `);
  const started = Date.now();
  const run = spawnSync(python, [file], {
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    env: { ...process.env, VIDEO_DB_API_KEY: apiKey },
  });
  const durationMs = Date.now() - started;
  const timedOut = run.error?.name === "Error" && run.signal === "SIGTERM";
  const passed = run.status === 0 && !timedOut;
  const output = [run.stdout, run.stderr, timedOut ? `(timed out after ${TIMEOUT_MS}ms)` : ""]
    .filter(Boolean)
    .join("\n---\n")
    .slice(-OUTPUT_TAIL);

  await getPool().query(
    `INSERT INTO snippet_validations (template_id, status, output, duration_ms)
     VALUES ($1, $2, $3, $4)`,
    [template.id, passed ? "passed" : "failed", output, durationMs],
  );

  console.log(`${passed ? "passed" : "FAILED"} (${(durationMs / 1000).toFixed(1)}s)`);
  if (!passed) {
    anyFailed = true;
    console.error(output.split("\n").slice(-15).join("\n"));
  }
}

await getPool().end();
process.exit(anyFailed ? 1 : 0);
