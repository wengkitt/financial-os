# Financial OS

A personal finance application built with React, TanStack Router/Query/Form, Zod,
shadcn Base UI, Hono, Drizzle, and PostgreSQL on Neon. Vite+ (`vp`) manages the toolchain.

## What it does

- Record income and expenses in wallets, categories, and Spaces. Edit and delete records.
- Track bank, cash, and e-wallet balances, transfers, and documented balance corrections.
- Use MYR, NZD, USD, SGD, AUD, EUR, GBP, JPY, CAD, THB, IDR, CNY, and HKD wallets.
- Set monthly expense-category budgets and total lifetime Space budgets.
- Track monthly recurring payments, confirm actual payments, skip occurrences, and pause schedules.
- Compare income, preparation costs, running expenses, and final results for a trip or project.
- Filter transactions and export CSV records.
- Register, verify email, sign in with username or email, and recover passwords.

Each user has one ledger and an Everyday Space. Each income/expense belongs to
one Space and one wallet. Space reports include only their assigned transactions;
overall reports include every transaction once. Wallets are shared across Spaces.

Trip result = income − running expenses − preparation expenses. Preparation
costs can precede the trip dates and remain included. Opening balances, transfers,
and corrections affect wallets without inflating income, expenses, or budgets.
Manual conversion rates are stored with transactions; historical totals do not
change when later rates change. Reporting currency is fixed once wallets or
budgets exist. Wallet balances remain in their original currency.

## Local development

1. Run `vp install`.
2. Copy `.env.example` to `.env` and configure the development Neon connection.
3. Run `vp run db:migrate` against the development branch.
4. Configure authentication email as described below.
5. Run `vp run dev` and open its printed URL.

`DATABASE_URL` and
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` must target the Neon
**development branch**. Use a direct connection URL with TLS (`sslmode=require`)
and Neon connection pooling unchecked. The local Worker override connects
directly, bypassing Hyperdrive pooling and caching. Keep credentials out of
committed files, logs, client bundles, and `VITE_` variables.

`GET /api/health/db` checks the database connection. The application lives under
`/app`; unverified users are redirected to email verification. New accounts default
to MYR reporting and Asia/Kuala_Lumpur, selectable during registration. Financial
dates are `yyyy-MM-dd`; calendar boundaries follow the account timezone. Display
helpers use date-fns; security timestamps are UTC.

## Email verification and recovery

Set these server-only variables in `.env` for local development:

- `APP_ORIGIN`: exact browser origin, such as `http://localhost:5173`. If Vite uses
  another port or you use `127.0.0.1`, update this value to match. It controls both
  email links and mutation origin checks. Restart development after changing it.
- `RESEND_API_KEY`: a Resend API key authorized to send email.
- `EMAIL_FROM`: sender address on your verified Resend domain.

Registration creates an unverified account and a seven-day cookie session.
Financial APIs stay inaccessible until verification succeeds. Verification links
expire after 24 hours; reset links expire after one hour. Links are single-use;
resending replaces the previous verification link. Missing email configuration or
failed delivery leaves the account unverified and allows retrying delivery.
Recovery responses remain generic to avoid disclosing registered email addresses.

Passwords use salted scrypt (`N=16384`, `r=8`, `p=5`) and constant-time comparison.
Session and email token hashes are stored server-side; raw session cookies are
HttpOnly, SameSite=Lax, and Secure over HTTPS. Logout revokes the current session;
password reset revokes all sessions. Authentication throttles are persistent across
requests. Mutations require same-origin JSON requests. Private responses are not cached.

For production, configure `APP_ORIGIN` and `EMAIL_FROM` as Worker variables and
store `RESEND_API_KEY` using `vp exec wrangler secret put RESEND_API_KEY`.
Registration email is transactional; recurring payment reminders are in-app only.

## Database and deployment

Tables live in `worker/db/schema.ts`; migrations and snapshots live in `drizzle/`.
Database access uses the request-scoped `withDatabase` helper with Drizzle's
node-postgres adapter. Each operation closes its client. Financial writes use
transactions and account locks; ownership is checked in APIs and composite
foreign keys. Recurring confirmations have a unique schedule/due-date constraint.

After schema changes:

```sh
vp run db:generate
vp run db:check
vp run db:migrate
```

Review generated SQL before applying it. Drizzle Kit reads `DATABASE_URL`
independently of Hyperdrive. Local migration defaults target development.

Production Workers use the configured `HYPERDRIVE` binding in `wrangler.jsonc`
with `nodejs_compat`, pointing to the **production Neon branch**. Configure it with
the production direct TLS URL and disable Hyperdrive query caching. Runtime code
uses `pg`, not the Neon serverless driver. Production needs no `DATABASE_URL`
Worker secret.

Apply reviewed migrations separately with an explicitly supplied production
`DATABASE_URL`, before deploying dependent Worker code. Do not retarget `.env`.
Deployment never runs migrations. Preserve compatibility during rollout. Once
production configuration is ready, use `vp run deploy`.

## Validation

```sh
vp check
vp test
vp run build
vp run db:check
```

Unit tests cover exact money arithmetic, Space totals, wallet movements, monthly
budgets, month-end anchors, timezone boundaries, validation, CSV safety, password
hashing, and routes.

Run the opt-in database workflow suite against development:

```sh
FINANCIAL_OS_DB_TESTS=1 vp test worker/integration.test.ts
```

The suite requires matching development database and local Worker URLs. It creates
uniquely named fixtures, mocks Resend delivery in memory, tests verification,
recovery, ownership, transfers, budgets, and concurrent confirmations, then removes
its own financial fixtures. It never sends real email. Do not run it against production.

## First-version boundaries

Transactions and reports load the current user's ledger together; pagination and
server-side aggregate optimization can be added when ledger sizes warrant them.
Rates are entered manually. Recurring schedules are monthly and reminders appear
in the app. Archived wallets/categories preserve history and cannot receive new
entries until restored. Changing a recurring monthly anchor requires pausing the
old schedule and creating a new one. Deleting a confirmed payment makes its
occurrence due again. Referenced Spaces cannot be deleted; mark them completed to
retain history.

Bank feeds, savings goals, debts, receipt uploads, imports, shared finances, and
email payment reminders are deferred.
