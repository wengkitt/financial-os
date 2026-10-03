# React + TypeScript + Vite

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
