"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPool, queryOne } from "@/lib/db";

// R6 — the one dashboard write that doesn't go through the Mastra API:
// the kill-switch is an ops flag read by the guardrail, the dispatcher,
// and the operate tools, not workflow state. Every flip is audit-logged.

const StateRow = z.object({
  on: z.boolean(),
  updated_by: z.string().nullable(),
  updated_at: z.coerce.date(),
});

export async function getKillSwitchState() {
  const row = await queryOne(
    StateRow,
    `SELECT (value = 'true'::jsonb) AS on, updated_by, updated_at
       FROM settings WHERE key = 'kill_switch'`,
  );
  return {
    on: row?.on ?? false,
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at?.toISOString() ?? null,
    envForced: process.env.KILL_SWITCH === "true",
  };
}

const ToggleInput = z.object({
  next: z.enum(["on", "off"]),
  actor: z.string().trim().min(1),
});

export async function toggleKillSwitch(formData: FormData): Promise<void> {
  const { next, actor } = ToggleInput.parse({
    next: formData.get("next"),
    actor: formData.get("actor"),
  });
  const on = next === "on";

  await getPool().query(
    `INSERT INTO settings (key, value, updated_at, updated_by)
     VALUES ('kill_switch', $1::jsonb, now(), $2)
     ON CONFLICT (key) DO UPDATE
        SET value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [JSON.stringify(on), actor],
  );
  await getPool().query(
    `INSERT INTO audit_log (actor, action, subject_table, subject_id)
     VALUES ($1, $2, 'settings', 'kill_switch')`,
    [actor, on ? "kill_switch.on" : "kill_switch.off"],
  );

  revalidatePath("/", "layout");
}
