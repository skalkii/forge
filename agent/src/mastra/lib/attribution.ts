import { createHash } from "node:crypto";

import { getPool } from "./db";
import { getActiveStrategy } from "../strategy";

/**
 * R5 — experiments ride on every touch. Variant assignment is a
 * deterministic hash of the candidate id (re-dispatching the same
 * candidate can never flip its arm) and is logged on the touch row.
 * The variant travels on utm_content; utm_campaign stays the touch id —
 * that is the attribution join key and must never be overloaded.
 */

export const VARIANTS = ["A", "B"] as const;
export type Variant = (typeof VARIANTS)[number];

export function assignVariant(candidateId: string): Variant {
  const digest = createHash("sha256").update(candidateId).digest();
  return VARIANTS[digest[0]! % VARIANTS.length]!;
}

export interface ExperimentAssignment {
  experimentId: string | null;
  variant: Variant | null;
}

/** One experiment runs at a time; none running → the touch goes unassigned. */
export async function assignExperiment(candidateId: string): Promise<ExperimentAssignment> {
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT id FROM experiments WHERE status = 'running'
      ORDER BY started_at DESC NULLS LAST LIMIT 1`,
  );
  if (rows.length === 0) return { experimentId: null, variant: null };
  return { experimentId: rows[0]!.id, variant: assignVariant(candidateId) };
}

export function buildUtmLink(touchId: string, variant?: string | null): string {
  const { utmSource, utmMedium } = getActiveStrategy().attributionMap;
  const url = new URL(process.env.UTM_BASE_URL || "https://docs.videodb.io/");
  url.searchParams.set("utm_source", utmSource);
  url.searchParams.set("utm_medium", utmMedium);
  url.searchParams.set("utm_campaign", touchId);
  if (variant) url.searchParams.set("utm_content", variant);
  return `Docs: ${url.toString()}`;
}
