import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgres://forge:forge@localhost:5432/forge",
      max: 5,
    });
  }
  return pool;
}
