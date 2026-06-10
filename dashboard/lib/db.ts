import { Pool } from "pg";
import { z } from "zod";

// Read-only access to the agent's Postgres. The dashboard never writes
// directly — mutations go through server actions that call the Mastra API.

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  }
  return pool;
}

export async function query<T extends z.ZodType>(
  schema: T,
  text: string,
  params: unknown[] = [],
): Promise<z.output<T>[]> {
  const res = await getPool().query(text, params);
  return res.rows.map((row) => schema.parse(row));
}

export async function queryOne<T extends z.ZodType>(
  schema: T,
  text: string,
  params: unknown[] = [],
): Promise<z.output<T> | null> {
  const rows = await query(schema, text, params);
  return rows[0] ?? null;
}
