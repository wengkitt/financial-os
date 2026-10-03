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
  it("renders registration with the required account fields", async () => {
    const html = await renderRoute("/register");
    expect(html).toContain("Create your account");
    expect(html).toContain("Username");
    expect(html).toContain("Reporting currency");
    expect(html).toContain("Timezone");
  });

  it("gates reset links without exposing a password form or schema errors", async () => {
    const html = await renderRoute("/reset-password");
    expect(html).toContain("This link is invalid");
    expect(html).toContain("Request a new reset link");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("regex");
  });
  it("does not show untouched login errors or a reset action", async () => {
    const html = await renderRoute("/login");
    expect(html).toContain("Sign in");
    expect(html).not.toContain("Enter your password");
    expect(html).not.toContain("Too small");
    expect(html).not.toContain(">Reset<");
  });
  it("renders a 404 with a link home for unknown URLs", async () => {
    const html = await renderRoute("/missing-page");

    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
  });
});
