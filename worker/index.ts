import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>({ strict: false });

app.get("/api", (c) => c.json({ name: "Cloudflare" }));

app.notFound((c) => c.json({ error: "Not Found" }, 404));

export default app;
