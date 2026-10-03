import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { subHours } from "date-fns";
import app from "./index.ts";
import type { Bindings } from "./services/auth.ts";
import { withDatabase } from "./db/index.ts";
import * as tables from "./db/schema.ts";
import { dataSchema, sessionSchema } from "../src/lib/contracts.ts";
import type { FinanceData } from "../src/lib/contracts.ts";
import { financialSummary, walletBalance } from "../src/lib/finance.ts";
import { hashToken } from "./services/security.ts";

const enabled = process.env.FINANCIAL_OS_DB_TESTS === "1";
// Opt-in: this suite creates and removes only its uniquely named development fixtures.
describe.skipIf(!enabled)("Financial OS development database workflow", () => {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `fos_${suffix}@example.com`;
  const otherEmail = `fos_other_${suffix}@example.com`;
  const username = `fos_${suffix}`;
  const otherUsername = `fos_other_${suffix}`;
  const password = "a long integration test passphrase";
  let cookie = "";
  let otherCookie = "";
  let env: Bindings;
  let data: FinanceData;
  let walletId = "";
  let spaceId = "";
  let incomeId = "";
  let expenseId = "";
  let categoryIncome = "";
  let categoryExpense = "";
  const accounts: string[] = [];
  const emails = new Map<string, string>();
  let emailFailure = false;
  const ip = `fixture-${suffix}`;
  const emailPayload = z.object({
    to: z.array(z.string()),
    text: z.string(),
    subject: z.string(),
  });
  function tokenFor(address: string, purpose: "verify" | "reset") {
    const token = emails.get(`${address}:${purpose}`);
    if (!token) throw new Error("Test email missing");
    return token;
  }
  async function call(
    path: string,
    payload?: Record<string, string | boolean | null>,
    method = "POST",
    session = cookie,
  ) {
    return app.request(
      `http://localhost${path}`,
      {
        method,
        headers: {
          Origin: "http://localhost",
          "Content-Type": "application/json",
          "cf-connecting-ip": ip,
          ...(session ? { Cookie: session } : {}),
        },
        ...(method !== "GET" ? { body: JSON.stringify(payload ?? {}) } : {}),
      },
      env,
    );
  }
  function sessionCookie(response: Response) {
    const value = response.headers.get("set-cookie")?.split(";")[0];
    if (!value) throw new Error("Session cookie missing");
    return value;
  }
  async function refresh() {
    const response = await call("/api/finance/data", undefined, "GET");
    expect(response.status).toBe(200);
    data = dataSchema.parse(await response.json());
    return data;
  }
  async function register(address: string, handle: string) {
    return call(
      "/api/auth/register",
      {
        name: "Integration fixture",
        username: handle,
        email: address,
        password,
        reportingCurrency: "MYR",
        timezone: "Asia/Kuala_Lumpur",
      },
      "POST",
      "",
    );
  }
  beforeAll(async () => {
    const connectionString = z.string().min(1).parse(process.env.DATABASE_URL);
    if (connectionString !== process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE)
      throw new Error(
        "Integration tests require matching development database and local Worker URLs.",
      );
    env = {
      HYPERDRIVE: { connectionString },
      APP_ORIGIN: "http://localhost",
      RESEND_API_KEY: "test-only-email-key",
      EMAIL_FROM: "Financial OS <fixture@example.com>",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (url !== "https://api.resend.com/emails")
        throw new Error("Unexpected outbound request in integration test");
      if (emailFailure) return Response.json({ message: "unavailable" }, { status: 503 });
      if (typeof init?.body !== "string") throw new Error("Email body missing");
      const payload = emailPayload.parse(JSON.parse(init.body));
      const match = /token=([a-f0-9]{64})/.exec(payload.text);
      const recipient = payload.to[0];
      if (!match?.[1] || !recipient) throw new Error("Verification token missing from test email");
      emails.set(
        `${recipient}:${payload.subject.startsWith("Verify") ? "verify" : "reset"}`,
        match[1],
      );
      return Response.json({ id: "fixture-email" });
    });
    const response = await register(email, username);
    expect(response.status).toBe(201);
    cookie = sessionCookie(response);
    const session = sessionSchema.parse(
      await (await call("/api/auth/session", undefined, "GET")).json(),
    );
    if (session.user) accounts.push(session.user.id);
  }, 30000);
  afterAll(async () => {
    vi.restoreAllMocks();
    if (!env || !accounts.length) return;
    await withDatabase(env, (db) =>
      db.transaction(async (tx) => {
        // Remove children before parents, respecting restrictive financial foreign keys.
        await tx.delete(tables.occurrences).where(inArray(tables.occurrences.userId, accounts));
        await tx.delete(tables.recurring).where(inArray(tables.recurring.userId, accounts));
        await tx.delete(tables.transactions).where(inArray(tables.transactions.userId, accounts));
        await tx.delete(tables.budgets).where(inArray(tables.budgets.userId, accounts));
        await tx.delete(tables.transfers).where(inArray(tables.transfers.userId, accounts));
        await tx.delete(tables.adjustments).where(inArray(tables.adjustments.userId, accounts));
        await tx.delete(tables.users).where(inArray(tables.users.id, accounts));
        const keys = ["register", "login", "resend", "recovery", "reset"]
          .flatMap((action) => [
            `${action}:ip:${ip}`,
            ...[
              email,
              otherEmail,
              username,
              otherUsername,
              ...accounts,
              ...[...emails.values()].map(hashToken),
            ].map((identifier) => `${action}:identifier:${identifier}`),
          ])
          .map(hashToken);
        await tx.delete(tables.authThrottles).where(inArray(tables.authThrottles.key, keys));
      }),
    );
  }, 30000);
  it("registers a private unverified account and sends a single-use link", async () => {
    expect((await call("/api/finance/data", undefined, "GET")).status).toBe(403);
    const response = await call("/api/auth/verify", { token: tokenFor(email, "verify") });
    expect(response.status).toBe(200);
    expect((await call("/api/auth/verify", { token: tokenFor(email, "verify") })).status).toBe(400);
    await refresh();
    expect(data.spaces.filter((s) => s.isDefault)).toHaveLength(1);
    expect(data.categories.length).toBeGreaterThan(0);
    const income = data.categories.find((c) => c.kind === "income");
    const expense = data.categories.find((c) => c.kind === "expense");
    if (!income || !expense) throw new Error("Default categories missing");
    categoryIncome = income.id;
    categoryExpense = expense.id;
  }, 30000);
  it("rejects normalized registration duplicates", async () => {
    expect((await register(email.toUpperCase(), username.toUpperCase())).status).toBe(409);
  }, 30000);
  it("rejects cross-origin mutation and unauthenticated financial reads", async () => {
    expect(
      (
        await app.request(
          "http://localhost/api/finance/wallets",
          {
            method: "POST",
            headers: {
              Origin: "https://other.example",
              "Content-Type": "application/json",
              Cookie: cookie,
            },
            body: "{}",
          },
          env,
        )
      ).status,
    ).toBe(403);
    expect((await call("/api/finance/data", undefined, "GET", "")).status).toBe(401);
  });
  it("supports login by username and email with generic failures", async () => {
    expect(
      (
        await call(
          "/api/auth/login",
          { identifier: username, password: "wrong password" },
          "POST",
          "",
        )
      ).status,
    ).toBe(401);
    const usernameResponse = await call(
      "/api/auth/login",
      { identifier: username.toUpperCase(), password },
      "POST",
      "",
    );
    expect(usernameResponse.status).toBe(200);
    cookie = sessionCookie(usernameResponse);
    const emailResponse = await call("/api/auth/login", {
      identifier: email.toUpperCase(),
      password,
    });
    expect(emailResponse.status).toBe(200);
    cookie = sessionCookie(emailResponse);
    const unknownResponse = await call("/api/auth/login", {
      identifier: `missing_${suffix}`,
      password,
    });
    expect(unknownResponse.status).toBe(401);
  }, 30000);
  it("records the working holiday once and retains separate Space totals", async () => {
    expect(
      (
        await call("/api/finance/wallets", {
          name: "MYR bank",
          kind: "bank",
          currency: "MYR",
          openingBalance: "10000",
          exchangeRate: "1",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("/api/finance/spaces", {
          name: "New Zealand",
          description: "Working holiday",
          startDate: "2026-02-01",
          endDate: null,
          budget: "26000",
          status: "active",
        })
      ).status,
    ).toBe(201);
    await refresh();
    const bank = data.wallets.find((w) => w.name === "MYR bank");
    const trip = data.spaces.find((s) => s.name === "New Zealand");
    const everyday = data.spaces.find((s) => s.isDefault);
    if (!bank || !trip || !everyday) throw new Error("Financial fixtures missing");
    walletId = bank.id;
    spaceId = trip.id;
    const entries = [
      {
        kind: "expense",
        amount: "8000",
        preparation: true,
        date: "2026-01-15",
        categoryId: categoryExpense,
        spaceId,
      },
      {
        kind: "income",
        amount: "30000",
        preparation: false,
        date: "2026-02-15",
        categoryId: categoryIncome,
        spaceId,
      },
      {
        kind: "expense",
        amount: "18000",
        preparation: false,
        date: "2026-02-16",
        categoryId: categoryExpense,
        spaceId,
      },
      {
        kind: "income",
        amount: "5000",
        preparation: false,
        date: "2026-02-17",
        categoryId: categoryIncome,
        spaceId: everyday.id,
      },
    ];
    for (const entry of entries)
      expect(
        (
          await call("/api/finance/transactions", {
            ...entry,
            walletId,
            exchangeRate: "1",
            notes: entry.kind === "income" ? "Work" : "Spending",
          })
        ).status,
      ).toBe(201);
    await refresh();
    expect(financialSummary(data, spaceId).result).toBe("4000.00000000");
    expect(financialSummary(data).income).toBe("35000.00000000");
    expect(walletBalance(data, walletId)).toBe("19000.00000000");
    incomeId =
      data.transactions.find((t) => t.kind === "income" && t.spaceId === spaceId)?.id ?? "";
    expenseId = data.transactions.find((t) => t.amount === "18000.00000000")?.id ?? "";
    const report = await call(`/api/finance/summary?spaceId=${spaceId}`, undefined, "GET");
    expect(report.status).toBe(200);
  }, 60000);
  it("tracks monthly budgets and recalculates after editing and deleting", async () => {
    expect(
      (
        await call("/api/finance/budgets", {
          categoryId: categoryExpense,
          month: "2026-02",
          amount: "17000",
        })
      ).status,
    ).toBe(200);
    const edit = {
      kind: "expense",
      walletId,
      categoryId: categoryExpense,
      spaceId,
      amount: "17000",
      exchangeRate: "1",
      date: "2026-02-16",
      notes: "Adjusted spending",
      preparation: false,
    };
    expect((await call(`/api/finance/transactions/${expenseId}`, edit, "PATCH")).status).toBe(200);
    await refresh();
    expect(financialSummary(data, spaceId).result).toBe("5000.00000000");
    expect(
      (await call(`/api/finance/transactions/${expenseId}`, { ...edit, amount: "18000" }, "PATCH"))
        .status,
    ).toBe(200);
    expect((await call(`/api/finance/transactions/${incomeId}`, undefined, "DELETE")).status).toBe(
      200,
    );
    await refresh();
    expect(financialSummary(data, spaceId).income).toBe("0.00000000");
    expect(
      (
        await call("/api/finance/transactions", {
          kind: "income",
          walletId,
          categoryId: categoryIncome,
          spaceId,
          amount: "30000",
          exchangeRate: "1",
          date: "2026-02-15",
          notes: "Work",
          preparation: false,
        })
      ).status,
    ).toBe(201);
  }, 60000);
  it("prevents partial transfers and records currency conversion and corrections", async () => {
    await call("/api/finance/wallets", {
      name: "NZD cash",
      kind: "cash",
      currency: "NZD",
      openingBalance: "0",
      exchangeRate: "2.5",
    });
    await refresh();
    const cash = data.wallets.find((w) => w.name === "NZD cash");
    if (!cash) throw new Error("Cash fixture missing");
    expect(
      (
        await call("/api/finance/transfers", {
          fromWalletId: walletId,
          toWalletId: crypto.randomUUID(),
          sentAmount: "250",
          receivedAmount: "100",
          date: "2026-02-17",
          notes: "",
        })
      ).status,
    ).toBe(404);
    await refresh();
    expect(data.transfers).toHaveLength(0);
    expect(
      (
        await call("/api/finance/transfers", {
          fromWalletId: walletId,
          toWalletId: cash.id,
          sentAmount: "250",
          receivedAmount: "100",
          date: "2026-02-17",
          notes: "FX",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("/api/finance/adjustments", {
          walletId: cash.id,
          amount: "-5",
          date: "2026-02-17",
          notes: "Cash count",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("/api/finance/transactions", {
          kind: "income",
          walletId: cash.id,
          categoryId: categoryIncome,
          spaceId,
          amount: "100",
          exchangeRate: "2.5",
          date: "2026-02-18",
          notes: "NZD work",
          preparation: false,
        })
      ).status,
    ).toBe(201);
    await refresh();
    expect(walletBalance(data, cash.id)).toBe("195.00000000");
    expect(financialSummary(data, spaceId).income).toBe("30250.00000000");
    expect(
      (
        await call("/api/finance/transactions", {
          kind: "expense",
          walletId: cash.id,
          categoryId: categoryExpense,
          spaceId,
          amount: "0.001",
          exchangeRate: "2.5",
          date: "2026-02-18",
          notes: "invalid precision",
          preparation: false,
        })
      ).status,
    ).toBe(400);
  }, 60000);
  it("rejects stale counted-balance corrections without changing the ledger", async () => {
    await refresh();
    const before = walletBalance(data, walletId);
    const count = data.adjustments.length;
    expect(
      (
        await call("/api/finance/adjustments", {
          walletId,
          amount: "1",
          expectedBalance: "-999",
          date: "2026-02-18",
          notes: "Stale count",
        })
      ).status,
    ).toBe(409);
    await refresh();
    expect(walletBalance(data, walletId)).toBe(before);
    expect(data.adjustments).toHaveLength(count);
  }, 30000);
  it("confirms concurrent monthly payments exactly once", async () => {
    await call("/api/finance/recurring", {
      name: "Rent",
      walletId,
      categoryId: categoryExpense,
      spaceId,
      amount: "900",
      startDate: "2026-01-31",
      endDate: null,
      paused: false,
    });
    await refresh();
    const schedule = data.recurring.find((r) => r.name === "Rent");
    if (!schedule) throw new Error("Schedule fixture missing");
    const payload = {
      dueDate: "2026-02-28",
      status: "paid",
      amount: "900",
      exchangeRate: "1",
      date: "2026-03-01",
    };
    const responses = await Promise.all([
      call(`/api/finance/recurring/${schedule.id}/confirm`, payload),
      call(`/api/finance/recurring/${schedule.id}/confirm`, payload),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    await refresh();
    expect(data.occurrences.filter((o) => o.recurringId === schedule.id)).toHaveLength(1);
    expect(data.transactions.filter((t) => t.notes === "Rent")).toHaveLength(1);
    expect(
      (
        await call(`/api/finance/recurring/${schedule.id}/confirm`, {
          ...payload,
          status: "skipped",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(`/api/finance/recurring/${schedule.id}/confirm`, {
          ...payload,
          dueDate: "2026-02-27",
        })
      ).status,
    ).toBe(400);
    await call(`/api/finance/recurring/${schedule.id}/confirm`, {
      ...payload,
      dueDate: "2026-03-31",
      status: "skipped",
    });
    await refresh();
    expect(data.occurrences.filter((o) => o.status === "skipped")).toHaveLength(1);
  }, 60000);
  it("undoes skipped occurrences but protects paid history and duplicate confirmations", async () => {
    await refresh();
    const skipped = data.occurrences.find((o) => o.status === "skipped");
    const paid = data.occurrences.find((o) => o.status === "paid");
    if (!skipped || !paid) throw new Error("Occurrence fixtures missing");
    expect((await call(`/api/finance/occurrences/${paid.id}`, undefined, "DELETE")).status).toBe(
      409,
    );
    const responses = await Promise.all([
      call(`/api/finance/occurrences/${skipped.id}`, undefined, "DELETE"),
      call(`/api/finance/occurrences/${skipped.id}`, undefined, "DELETE"),
    ]);
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 404]);
    await refresh();
    expect(data.occurrences.some((o) => o.id === skipped.id)).toBe(false);
    expect(data.transactions.filter((t) => t.notes === "Rent")).toHaveLength(1);
  }, 30000);
  it("preserves archived references for historical edits and prevents stranded active schedules", async () => {
    await refresh();
    const bank = data.wallets.find((w) => w.id === walletId);
    const category = data.categories.find((c) => c.id === categoryExpense);
    const row = data.transactions.find((t) => t.id === expenseId);
    const rent = data.recurring.find((r) => r.name === "Rent");
    if (!bank || !category || !row || !rent) throw new Error("Archive fixtures missing");
    expect(
      (await call(`/api/finance/wallets/${bank.id}`, { name: bank.name, archived: true }, "PATCH"))
        .status,
    ).toBe(409);
    expect(
      (
        await call(
          `/api/finance/categories/${category.id}`,
          { name: category.name, archived: true },
          "PATCH",
        )
      ).status,
    ).toBe(409);
    expect(
      (await call(`/api/finance/recurring/${rent.id}`, { ...rent, paused: true }, "PATCH")).status,
    ).toBe(200);
    expect(
      (await call(`/api/finance/wallets/${bank.id}`, { name: bank.name, archived: true }, "PATCH"))
        .status,
    ).toBe(200);
    expect(
      (
        await call(
          `/api/finance/categories/${category.id}`,
          { name: category.name, archived: true },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          `/api/finance/transactions/${row.id}`,
          { ...row, notes: "Historical notes edited" },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(
      (await call("/api/finance/transactions", { ...row, notes: "New archived entry" })).status,
    ).toBe(400);
    const oldBudget = data.budgets.find(
      (b) => b.categoryId === category.id && b.month === "2026-02",
    );
    if (!oldBudget) throw new Error("Budget fixture missing");
    expect(
      (
        await call("/api/finance/budgets", {
          categoryId: category.id,
          month: oldBudget.month,
          amount: oldBudget.amount,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("/api/finance/budgets", {
          categoryId: category.id,
          month: "2026-04",
          amount: "10",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call(`/api/finance/recurring/${rent.id}`, { ...rent, paused: false }, "PATCH")).status,
    ).toBe(400);
    await call(`/api/finance/wallets/${bank.id}`, { name: bank.name, archived: false }, "PATCH");
    await call(
      `/api/finance/categories/${category.id}`,
      { name: category.name, archived: false },
      "PATCH",
    );
    await call(`/api/finance/recurring/${rent.id}`, { ...rent, paused: false }, "PATCH");
  }, 60000);
  it("exports only the filtered ledger and locks reporting currency", async () => {
    const response = await call(
      `/api/finance/export?spaceId=${spaceId}&from=2026-02-01`,
      undefined,
      "GET",
    );
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).not.toContain('"Everyday"');
    expect(csv).not.toContain("2026-01-15");
    expect(
      (
        await call(
          "/api/finance/settings",
          { name: "Fixture", reportingCurrency: "NZD", timezone: "Pacific/Auckland" },
          "PATCH",
        )
      ).status,
    ).toBe(400);
  }, 30000);
  it("keeps failed email delivery unverified and rejects expired verification links", async () => {
    emailFailure = true;
    const response = await register(otherEmail, otherUsername);
    expect(response.status).toBe(201);
    otherCookie = sessionCookie(response);
    const session = sessionSchema.parse(
      await (await call("/api/auth/session", undefined, "GET", otherCookie)).json(),
    );
    if (session.user) accounts.push(session.user.id);
    expect((await call("/api/auth/resend", {}, "POST", otherCookie)).status).toBe(503);
    emailFailure = false;
    expect((await call("/api/auth/resend", {}, "POST", otherCookie)).status).toBe(200);
    const expired = tokenFor(otherEmail, "verify");
    await withDatabase(env, (db) =>
      db
        .update(tables.authTokens)
        .set({ expiresAt: subHours(new Date(), 1) })
        .where(eq(tables.authTokens.tokenHash, hashToken(expired))),
    );
    expect((await call("/api/auth/verify", { token: expired }, "POST", otherCookie)).status).toBe(
      400,
    );
    expect((await call("/api/auth/resend", {}, "POST", otherCookie)).status).toBe(200);
    expect(
      (
        await call(
          "/api/auth/verify",
          { token: tokenFor(otherEmail, "verify") },
          "POST",
          otherCookie,
        )
      ).status,
    ).toBe(200);
    expect((await call("/api/auth/resend", {}, "POST", otherCookie)).status).toBe(200);
  }, 60000);
  it("rejects cross-user ownership in reads, edits and linked foreign keys", async () => {
    expect(
      (await call(`/api/finance/summary?spaceId=${spaceId}`, undefined, "GET", otherCookie)).status,
    ).toBe(404);
    expect(
      (
        await call(
          `/api/finance/transactions/${expenseId}`,
          {
            kind: "expense",
            walletId,
            categoryId: categoryExpense,
            spaceId,
            amount: "1",
            exchangeRate: "1",
            date: "2026-02-18",
            notes: "",
            preparation: false,
          },
          "PATCH",
          otherCookie,
        )
      ).status,
    ).toBe(404);
    await refresh();
    const paidOccurrence = data.occurrences.find((o) => o.status === "paid");
    if (!paidOccurrence) throw new Error("Paid occurrence missing");
    expect(
      (
        await call(
          `/api/finance/occurrences/${paidOccurrence.id}`,
          undefined,
          "DELETE",
          otherCookie,
        )
      ).status,
    ).toBe(404);
    const otherData = dataSchema.parse(
      await (await call("/api/finance/data", undefined, "GET", otherCookie)).json(),
    );
    expect(otherData.wallets).toHaveLength(0);
    expect(otherData.transactions).toHaveLength(0);
    const otherUserId = accounts[1];
    if (!otherUserId) throw new Error("Other account missing");
    await expect(
      withDatabase(env, (db) =>
        db.insert(tables.adjustments).values({
          userId: otherUserId,
          walletId,
          amount: "1",
          date: "2026-02-18",
          notes: "cross owner",
        }),
      ),
    ).rejects.toThrow();
  }, 30000);
  it("consumes reset tokens once and revokes all existing sessions", async () => {
    await call("/api/auth/forgot-password", { email });
    const expired = tokenFor(email, "reset");
    await withDatabase(env, (db) =>
      db
        .update(tables.authTokens)
        .set({ expiresAt: subHours(new Date(), 1) })
        .where(eq(tables.authTokens.tokenHash, hashToken(expired))),
    );
    expect((await call("/api/auth/reset-password", { token: expired, password })).status).toBe(400);
    await call("/api/auth/forgot-password", { email });
    const token = tokenFor(email, "reset");
    const oldCookie = cookie;
    expect(
      (await call("/api/auth/reset-password", { token, password: `${password} new` })).status,
    ).toBe(200);
    expect((await call("/api/auth/reset-password", { token, password })).status).toBe(400);
    const session = sessionSchema.parse(
      await (await call("/api/auth/session", undefined, "GET", oldCookie)).json(),
    );
    expect(session.user).toBeNull();
    const login = await call(
      "/api/auth/login",
      { identifier: username, password: `${password} new` },
      "POST",
      "",
    );
    expect(login.status).toBe(200);
    cookie = sessionCookie(login);
    expect((await call("/api/auth/logout", {})).status).toBe(200);
    expect((await call("/api/finance/data", undefined, "GET")).status).toBe(401);
  }, 60000);
  it("persists authentication rate limits", async () => {
    const identifier = `throttle_${suffix}`;
    for (let i = 0; i < 5; i++)
      expect((await call("/api/auth/login", { identifier, password }, "POST", "")).status).toBe(
        401,
      );
    expect((await call("/api/auth/login", { identifier, password }, "POST", "")).status).toBe(429);
    await withDatabase(env, (db) =>
      db
        .delete(tables.authThrottles)
        .where(and(eq(tables.authThrottles.key, hashToken(`login:identifier:${identifier}`)))),
    );
  }, 60000);
});
