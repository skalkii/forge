/**
 * Near-duplicate clustering for signals (exact dedup is the external_id
 * UNIQUE constraint). Embeds title+excerpt locally with fastembed
 * (bge-small-en-v1.5, 384 dims — zero API spend), then marks a signal as
 * dup_of the nearest already-embedded signal when cosine distance is
 * under the threshold. Touch dedup ("never touch the same person/thread
 * twice") happens later at the guardrail; this keeps triage from paying
 * for the same pain twice.
 */
import { EmbeddingModel, FlagEmbedding } from "fastembed";

import { getPool } from "./db";

/** cosine distance below this = same underlying problem */
const DUP_DISTANCE = 0.15;

let embedder: Promise<FlagEmbedding> | undefined;

function getEmbedder(): Promise<FlagEmbedding> {
  embedder ??= FlagEmbedding.init({
    model: EmbeddingModel.BGESmallENV15,
    showDownloadProgress: false,
  });
  return embedder;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = await getEmbedder();
  const out: number[][] = [];
  for await (const batch of model.embed(texts)) {
    for (const v of batch) out.push(Array.from(v));
  }
  return out;
}

export interface DedupResult {
  embedded: number;
  duplicates: number;
}

/** Embed all signals missing an embedding; cluster against existing ones. */
export async function dedupSignals(): Promise<DedupResult> {
  const pool = getPool();
  const pending = await pool.query<{ id: string; title: string; excerpt: string }>(
    `SELECT id, title, excerpt FROM signals WHERE embedding IS NULL ORDER BY created_at`,
  );
  if (pending.rows.length === 0) return { embedded: 0, duplicates: 0 };

  const vectors = await embedTexts(pending.rows.map((r) => `${r.title}\n${r.excerpt}`));

  let duplicates = 0;
  for (let i = 0; i < pending.rows.length; i++) {
    const row = pending.rows[i];
    const vec = `[${vectors[i].join(",")}]`;
    // nearest already-embedded signal; processing in created_at order means
    // the earliest of a cluster becomes its canonical row
    const nearest = await pool.query<{ id: string; dist: number }>(
      `SELECT id, embedding <=> $1 AS dist
         FROM signals
        WHERE embedding IS NOT NULL AND id <> $2 AND dup_of IS NULL
        ORDER BY embedding <=> $1
        LIMIT 1`,
      [vec, row.id],
    );
    const hit = nearest.rows[0];
    const dupOf = hit && hit.dist < DUP_DISTANCE ? hit.id : null;
    if (dupOf) duplicates++;
    await pool.query(`UPDATE signals SET embedding = $1, dup_of = $2 WHERE id = $3`, [
      vec,
      dupOf,
      row.id,
    ]);
  }

  return { embedded: pending.rows.length, duplicates };
}
