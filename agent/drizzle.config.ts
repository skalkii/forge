import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../.env", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://forge:forge@localhost:5432/forge",
  },
});
