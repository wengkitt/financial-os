# React + TypeScript + Vite

## Routing

The React app uses TanStack Router with file-based routes in `src/routes`.
`src/routes/__root.tsx` provides the shared layout and 404 fallback, while
`src/routes/index.tsx` renders the existing app at `/`. The typed router is
configured in `src/router.ts` and mounted with `RouterProvider` in `src/main.tsx`.

Run `vp run dev` to generate and watch routes. Add a file such as
`src/routes/about.tsx` that exports `Route = createFileRoute("/about")({ component: About })`
to create a page. Import `createFileRoute` and `Link` from `@tanstack/react-router`
and use `<Link to="/about">About</Link>` for client-side navigation.

The Vite plugin generates `src/routeTree.gen.ts` during development and builds
and automatically splits route components. Commit the generated tree so the
build script's TypeScript check can run before Vite; do not edit it manually.
See the [TanStack Router Vite guide](https://tanstack.com/router/latest/docs/installation/with-vite).

## Server state

TanStack Query manages server state through a shared `QueryClient` in
`src/lib/query-client.ts`. `QueryClientProvider` wraps the router in `src/main.tsx`,
and the same client is available in typed route context for future loaders.
Queries stay fresh for 30 seconds; other retry, garbage collection, and
refetch settings use TanStack Query's defaults.

Define reusable query keys and fetch functions with `queryOptions` under
`src/queries`. For example, `src/queries/api-name.ts` fetches `/api/`, checks
HTTP errors and the response shape, and passes the query's abort signal to fetch.
Use it in a component:

```tsx
import { useQuery } from "@tanstack/react-query";
import { apiNameQueryOptions } from "@/queries/api-name";

const nameQuery = useQuery(apiNameQueryOptions);
```

The home page loads the name automatically, displays loading and error states,
and lets you refresh it. Keep local UI state, such as the counter, in React state.
For write endpoints, use `useMutation` and invalidate the affected query keys in
`onSuccess` with `queryClient.invalidateQueries({ queryKey: apiNameQueryOptions.queryKey })`.
Route loaders can reuse the same options with
`context.queryClient.ensureQueryData(apiNameQueryOptions)`.

See the [TanStack Query quick start](https://tanstack.com/query/latest/docs/framework/react/quick-start).

## Forms and validation

TanStack Form and Zod power the example at `/form-demo`, linked from the home
page. `src/components/profile-form.tsx` uses shadcn's Base UI `Field`, `Input`,
`Button`, and `Card` components. Each control connects to `form.Field` through
its value, change handler, and blur handler. Labels, descriptions, inline
`FieldError` messages, and `aria-invalid` provide accessible validation feedback.

`src/forms/profile-form-options.ts` contains the Zod schema, inferred value
type, defaults, and reusable `formOptions`. The schema is passed directly to
TanStack Form's `onChange` and `onSubmit` validators through Standard
Schema. No Zod adapter or global form provider is needed.

Errors appear after a field is touched or the form is submitted. The demo uses
`noValidate` so Zod's inline messages handle invalid submissions; the inputs
still declare `required`, `type`, and length constraints. Reset clears values,
errors, and the submitted preview. Submission validates locally and displays a
preview; it does not save a profile. Zod transforms are applied explicitly with
`profileSchema.parse(value)` in the submit handler.

For a real write endpoint, call a TanStack Query mutation's `mutateAsync(value)`
inside `onSubmit` and invalidate affected queries after success. Keep server
validation in that endpoint as well.

See the [shadcn TanStack Form guide](https://ui.shadcn.com/docs/forms/tanstack-form).

## Dates

Use `date-fns` for all date parsing, formatting, validation, comparisons, and
arithmetic. Common helpers live in `src/lib/date.ts`:

```ts
import { formatDate, formatDateTime, parseDate } from "@/lib/date";
import { addDays, formatISO, isBefore } from "date-fns";

formatDate("2026-10-03"); // "03 Oct 2026"
formatDateTime("2026-10-03T14:05:00"); // "03 Oct 2026 14:05"
const nextDay = addDays(parseDate("2026-10-03"), 1);
isBefore(parseDate("2026-10-03"), nextDay); // true
formatISO(nextDay, { representation: "date" }); // "2026-10-04"
```

`parseDate` accepts ISO 8601 strings, Date objects, and millisecond timestamps.
Invalid inputs throw `RangeError`; validate optional or user-entered values
before formatting them. Keep date-only values as `yyyy-MM-dd`; parsing them
with `parseISO` preserves the local calendar date. API timestamps should include
an explicit offset or `Z`. Display helpers use the browser/runtime's local time
zone and the formats `dd MMM yyyy` and `dd MMM yyyy HH:mm`.

Import additional operations directly from `date-fns`. Use `yyyy` and `dd` for
calendar-year and day-of-month tokens. See the [date-fns documentation](https://date-fns.org/).

## Worker API

The Cloudflare Worker in `worker/index.ts` uses [Hono](https://hono.dev/docs/getting-started/cloudflare-workers).
Run `vp run dev` to start the React app and Worker together. `GET /api` and
`GET /api/` return `{ "name": "Cloudflare" }`. Unknown API routes return a JSON
404 response. Wrangler sends `/api` and `/api/*` requests to the Worker first;
other paths use the React static assets and SPA fallback.

Add endpoints with `app.get("/api/example", (c) => c.json({ ok: true }))` in
`worker/index.ts`. Cloudflare bindings are typed with the generated `Env` type
and accessed through `c.env`. After changing bindings in `wrangler.jsonc`, run
`vp run cf-typegen` to regenerate their types.

Validate changes with `vp check`, `vp test`, and `vp run build`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
