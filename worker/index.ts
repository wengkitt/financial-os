import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withDatabase } from "./db/index.ts";

const app = new Hono<{ Bindings: Env }>({ strict: false });

app.get("/api", (c) => c.json({ name: "Cloudflare" }));

const databaseHealthSchema = z.object({ ok: z.literal(1) });

app.get("/api/health/db", async (c) => {
  c.header("Cache-Control", "no-store");

  try {
    await withDatabase(c.env, async (db) => {
      const { rows } = await db.execute<{ ok: number }>(sql`SELECT 1 AS ok`);
      const [row] = rows;
      databaseHealthSchema.parse(row);
    });
    return c.json({ status: "ok" });
  } catch {
    // Keep driver errors and connection credentials out of public responses.
    return c.json({ status: "unavailable" }, 503);
  }
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

export default app;
