import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { apiNameQueryOptions } from "./api-name";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("API name query", () => {
  it("caches the response and fetches again after invalidation", async () => {
    const fetchMock = vi.fn(async () => Response.json({ name: "Cloudflare" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await client.fetchQuery(apiNameQueryOptions)).toEqual({ name: "Cloudflare" });
    await client.fetchQuery(apiNameQueryOptions);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/", { signal: expect.any(AbortSignal) });

    await client.invalidateQueries({ queryKey: apiNameQueryOptions.queryKey });
    await client.fetchQuery(apiNameQueryOptions);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports unsuccessful HTTP responses as query errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unavailable", { status: 503 })),
    );

    await expect(client.fetchQuery(apiNameQueryOptions)).rejects.toThrow(
      "Failed to fetch name (503)",
    );
    expect(client.getQueryState(apiNameQueryOptions.queryKey)?.status).toBe("error");
  });

  it.each([null, {}, { name: 123 }])("rejects invalid API data: %j", async (data) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(data)),
    );

    await expect(client.fetchQuery(apiNameQueryOptions)).rejects.toThrow(
      "The API returned an invalid name",
    );
  });
});
