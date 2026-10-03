import { describe, expect, it } from "vite-plus/test";
import app from "./index.ts";

describe("Worker API", () => {
  it.each(["/api", "/api/"])("serves the frontend response at %s", async (path) => {
    const response = await app.request(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ name: "Cloudflare" });
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    const response = await app.request("/api/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });

  it("does not handle writes to the read-only endpoint", async () => {
    const response = await app.request("/api", { method: "POST" });

    expect(response.status).toBe(404);
  });
});
