import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { withDatabase } from "./db/index.ts";
import app from "./index.ts";

vi.mock("./db/index.ts", () => ({ withDatabase: vi.fn() }));

describe("Worker API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports a successful database check without caching the response", async () => {
    vi.mocked(withDatabase).mockResolvedValue(undefined);
    const response = await app.request("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(withDatabase).toHaveBeenCalledOnce();
  });

  it("returns 503 without leaking database errors", async () => {
    vi.mocked(withDatabase).mockRejectedValue(new Error("secret connection details"));
    const response = await app.request("/api/health/db");

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

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
    const response = await app.request("http://localhost/api", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(404);
  });
});
