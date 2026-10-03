<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Required application stack

- Use TanStack Router for all application routing. Add file-based routes under
  `src/routes`, use its typed `Link` and navigation APIs, and keep router setup
  in `src/router.ts`. Do not introduce another routing library.
- Use TanStack Query for all server state: fetching, caching, mutations, and
  invalidation. Reuse the shared client in `src/lib/query-client.ts` and define
  reusable query options under `src/queries`. Keep local UI state in React state.
- Use TanStack Form for all forms, including field state, validation lifecycle,
  submission, and reset. Integrate it with shadcn's field and input components.
- Use Zod for all validation schemas, including forms, API payloads, responses,
  and other external data. Infer TypeScript types from schemas where possible.
  Pass Zod schemas directly to TanStack Form's validators through Standard Schema.
  Use date-fns within Zod refinements when validation requires date operations.

## UI components

- Use shadcn as the primary UI component system and follow the project's
  shadcn skill and `components.json` configuration.
- Check installed components in `src/components/ui` first. If a component is
  missing, check shadcn's documentation and registries and install the appropriate
  component before writing custom UI.
- Compose application interfaces from shadcn components. Only create a custom
  UI component after confirming that shadcn has no suitable component or
  composition for the requirement; explain that finding when making the change.
- Reuse existing variants and design tokens, and preserve accessibility through
  labels, descriptions, error messages, and appropriate ARIA attributes.

## Visual design and themes

- **Linear defines the visual style; shadcn supplies the UI components.**
  Reproduce Linear's appearance by composing shadcn components and adjusting
  shared theme tokens and supported variants. Preserve their behavior and
  accessibility. A desire to match Linear is not a reason to replace an available
  shadcn component with custom markup; the custom-component exception above
  still applies.
- Use [Linear](https://linear.app/) as the visual reference for React interfaces.
  Inspect the live site and its product previews when styling is uncertain.
  Match its typography, hierarchy, spacing, surfaces, borders, and interactions
  closely while adapting the layout to this app's content and workflows.
- Aim for a calm, precise interface: Inter typography, strong alignment,
  clear heading hierarchy, restrained accents, thin dividers, subtle elevation,
  and modest corner radii. Use generous space between sections and compact,
  readable controls and data rows. Keep icons small and consistent.
- For app screens, follow Linear's product previews: structured navigation,
  focused toolbars, organized lists, and unobtrusive panels. Reserve oversized
  hero typography and expansive layouts for marketing pages.
- Default to **light mode** unless the user explicitly requests dark-mode
  support. Use white/off-white surfaces, dark neutral text, muted secondary text,
  and fine light-gray borders. Preserve Linear's visual hierarchy in this light
  adaptation. Do not enable automatic system dark mode or add a theme switch
  unless requested.
- When dark mode is requested, match Linear's dark design with high fidelity,
  rather than merely inverting light colors. Its current site uses a near-black
  background (`#08090a`) and off-white text (`#f7f8f8`), with subtly raised dark
  surfaces and low-contrast borders. Reinspect the reference for component
  details and keep text, focus indicators, and states accessible.
- Implement theme styling through shared semantic tokens in `src/index.css` and
  shadcn variants. If both themes are requested, keep typography, spacing, radii,
  and density consistent between them. Use restrained motion and respect
  reduced-motion preferences.
- Verify finished screens visually against the reference, including responsive
  layouts and hover, focus, disabled, loading, and error states. Apply the
  shadcn-first component rules above throughout.

## TypeScript

- Write application code strictly in TypeScript (`.ts` / `.tsx`) and preserve
  strict type safety. Prefer precise types, inference, generics, and Zod-inferred
  types over broad or untyped values.
- Do not use `any` or `unknown` as shortcuts. Inspect existing types, schemas,
  and library definitions first. Use them only when the actual type genuinely
  cannot be determined, and document why the exception is necessary.
- At truly untyped external boundaries, prefer `unknown` over `any` and validate
  or narrow it with Zod before use. Keep the uncertainty confined to that boundary.
- Do not bypass type errors with unsafe casts, non-null assertions, or suppression
  comments. Resolve the underlying type or model the missing/null case explicitly.

## Date handling

- Use `date-fns` for all application date parsing, formatting, validation,
  comparisons, and arithmetic. Do not add another date library or hand-roll
  these operations using native Date methods or Intl.DateTimeFormat.
- Use `src/lib/date.ts` for common parsing and display formats; import other
  operations directly from `date-fns` as needed.
- Date objects remain the underlying value type. Native clock reads such as
  `new Date()` and `Date.now()` are allowed; use `parseISO` or `parseDate` for
  strings rather than `new Date(string)` or `Date.parse`.
- Keep date-only values as `yyyy-MM-dd` and API timestamps as ISO 8601 strings
  with an explicit offset or `Z`. Display helpers use the runtime's local time
  zone. For fixed-zone business logic, document the required zone instead of
  relying on runtime defaults.
