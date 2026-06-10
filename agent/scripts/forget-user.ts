/**
 * Deletion path (R7): `pnpm --filter agent forget-user <github-username>`.
 * Removes every row for that author — signals cascade through candidates,
 * touches, and outcomes. Audit-logged as 'user.forgotten'.
 */
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const username = process.argv[2]?.trim();
if (!username) {
  console.error("usage: pnpm --filter agent forget-user <github-username>");
  process.exit(1);
}

const { forgetUser } = await import("../src/mastra/lib/retention");

const result = await forgetUser(username);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
