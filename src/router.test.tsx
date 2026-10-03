import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { routeTree } from "./routeTree.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

async function renderRoute(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  });

  await router.load();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("app routes", () => {
  it("renders the form demo with labeled inputs", async () => {
    const html = await renderRoute("/form-demo");
    expect(html).toContain("Profile form example");
    expect(html).toContain('for="profile-name"');
    expect(html).toContain('type="email"');
  });
  it("renders the existing app at the home route", async () => {
    expect(await renderRoute("/")).toContain("Get started with Cloudflare");
  });

  it("renders a 404 with a link home for unknown URLs", async () => {
    const html = await renderRoute("/missing-page");

    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
  });
});
