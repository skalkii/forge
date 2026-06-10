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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AttributionResult {
  events: number;
  attributed: number;
  outsideWindow: number;
  unmatched: number;
}

/**
 * The attribution join (R10 — the signup feed is a stub table until VideoDB
 * delivers a real event source). Matches unprocessed signup_events to posted
 * touches on utm_campaign == touch id, enforces the strategy's attribution
 * window against posted_at, and writes outcomes rows. Idempotent twice over:
 * events are marked processed, and outcomes has a unique (touch_id, event)
 * index with ON CONFLICT DO NOTHING.
 */
export async function attributeOnce(): Promise<AttributionResult> {
  const pool = getPool();
  const windowDays = getActiveStrategy().attributionMap.windowDays;
  const result: AttributionResult = { events: 0, attributed: 0, outsideWindow: 0, unmatched: 0 };

  const { rows: events } = await pool.query<{
    id: string;
    event: string;
    utm_campaign: string;
    occurred_at: Date;
    meta: Record<string, unknown> | null;
  }>(
    `SELECT id, event, utm_campaign, occurred_at, meta
       FROM signup_events
      WHERE processed_at IS NULL
      ORDER BY received_at
      LIMIT 500`,
  );
  result.events = events.length;

  for (const ev of events) {
    let resolution: string;

    const touch = UUID_RE.test(ev.utm_campaign)
      ? (
          await pool.query<{ id: string; posted_at: Date }>(
            `SELECT id, posted_at FROM touches WHERE id = $1 AND posted_at IS NOT NULL`,
            [ev.utm_campaign],
          )
        ).rows[0]
      : undefined;

    if (!touch) {
      resolution = "unmatched";
      result.unmatched += 1;
    } else {
      const ageDays =
        (ev.occurred_at.getTime() - touch.posted_at.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays < 0 || ageDays > windowDays) {
        resolution = "outside-window";
        result.outsideWindow += 1;
      } else {
        await pool.query(
          `INSERT INTO outcomes (touch_id, event, occurred_at, meta)
           VALUES ($1, $2::outcome_event, $3, $4)
           ON CONFLICT (touch_id, event) DO NOTHING`,
          [touch.id, ev.event, ev.occurred_at, ev.meta ? JSON.stringify(ev.meta) : null],
        );
        resolution = "attributed";
        result.attributed += 1;
      }
    }

    await pool.query(
      `UPDATE signup_events
          SET processed_at = now(),
              meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('resolution', $2::text)
        WHERE id = $1`,
      [ev.id, resolution],
    );
  }

  return result;
}
