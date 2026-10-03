import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

// Credentials are optional for offline migration generation, required by connected commands.
const databaseUrl = z
  .url({ protocol: /^postgres(ql)?$/ })
  .optional()
  .parse(process.env.DATABASE_URL);

export default defineConfig({
  schema: "./worker/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
  strict: true,
});
