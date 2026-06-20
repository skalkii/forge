/**
 * Clean shutdown for short-lived scripts (discovery, dispatch, attribution…).
 *
 * Why this exists: onnxruntime-node 1.21 (pulled in by fastembed) aborts with
 * `mutex lock failed: Invalid argument` (exit 134) when its native session is
 * still alive during `process.exit()` — the static destructor races its own
 * thread pool. Releasing the session first and then letting the event loop
 * drain naturally exits clean; forcing `process.exit()` does not. So scripts
 * must NOT call `process.exit()` — they call this, which:
 *   1. releases the fastembed/ORT session,
 *   2. closes the Mastra store pool and the app pool,
 *   3. sets process.exitCode and lets the loop drain on its own.
 * A short unref'd watchdog only fires if some other handle refuses to close.
 */
import { disposeEmbedder } from "./dedup";
import { getPool } from "./db";

export async function shutdownScript(code: number): Promise<void> {
  process.exitCode = code;
  await disposeEmbedder();

  // Close pools best-effort — a close failure must not change the exit code.
  const { store } = await import("../index");
  await Promise.allSettled([store.close(), getPool().end()]);

  // Safety net: if anything still pins the loop after a grace period, force a
  // last-resort exit. ORT is already released by here, so this won't abort.
  setTimeout(() => process.exit(code), 4000).unref();
}
