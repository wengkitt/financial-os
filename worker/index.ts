import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { auth, type AppEnv } from "./services/auth.ts";
import { finance } from "./services/finance.ts";
import { withDatabase } from "./db/index.ts";

const app = new Hono<AppEnv>({ strict: false });

app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    const expected = c.env?.APP_ORIGIN ?? new URL(c.req.url).origin;
    if (!origin || origin !== expected || c.req.header("Sec-Fetch-Site") === "cross-site")
      return c.json({ message: "Request origin is not allowed." }, 403);
    if (c.req.method !== "DELETE" && !c.req.header("Content-Type")?.startsWith("application/json"))
      return c.json({ message: "Use application/json." }, 415);
  }
  await next();
});
app.route("/api/auth", auth);
app.route("/api/finance", finance);
app.onError((error, c) => {
  if (error instanceof SyntaxError) return c.json({ message: "Invalid JSON payload." }, 400);
  if (error instanceof z.ZodError)
    return c.json({ message: error.issues.map((issue) => issue.message).join(" ") }, 400);
  if (error instanceof HTTPException) return c.json({ message: error.message }, error.status);
  // PostgreSQL constraint failures are safe to classify without exposing driver details.
  const cause = error.cause;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? cause.code
      : "code" in error
        ? error.code
        : null;
  if (code === "23505")
    return c.json({ message: "A record with these details already exists." }, 409);
  if (code === "23503")
    return c.json(
      { message: "This record is still in use. Update its linked records first." },
      409,
    );
  return c.json({ message: "The service is temporarily unavailable. Please retry." }, 503);
});

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
