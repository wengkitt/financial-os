import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { accountToday } from "../../src/lib/date.ts";
import { format, addMonths, parseISO } from "date-fns";
import { withDatabase } from "../db/index.ts";
import type { DatabaseExecutor } from "../db/index.ts";
import * as tables from "../db/schema.ts";
import { currentUser } from "./auth.ts";
import type { AppEnv } from "./auth.ts";
import {
  dataSchema,
  walletInput,
  spaceInput,
  categoryInput,
  transactionInput,
  transferInput,
  adjustmentInput,
  budgetInput,
  recurringInput,
  confirmationInput,
  settingsSchema,
  filtersSchema,
  idSchema,
} from "../../src/lib/contracts.ts";
import { currencySchema, convertMoney, validPrecision, decimalUnits } from "../../src/lib/money.ts";
import {
  occurrenceDate,
  ledgerCsv,
  financialSummary,
  walletBalance,
} from "../../src/lib/finance.ts";
import type { User } from "../../src/lib/contracts.ts";
function fail(message: string, status: 400 | 404 | 409 = 400): never {
  throw new HTTPException(status, { message });
}
export async function loadFinance(db: DatabaseExecutor, userId: string) {
  const wallets = await db.select().from(tables.wallets).where(eq(tables.wallets.userId, userId));
  const spaces = await db.select().from(tables.spaces).where(eq(tables.spaces.userId, userId));
  const categories = await db
    .select()
    .from(tables.categories)
    .where(eq(tables.categories.userId, userId));
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(eq(tables.transactions.userId, userId));
  const transfers = await db
    .select()
    .from(tables.transfers)
    .where(eq(tables.transfers.userId, userId));
  const adjustments = await db
    .select()
    .from(tables.adjustments)
    .where(eq(tables.adjustments.userId, userId));
  const budgets = await db.select().from(tables.budgets).where(eq(tables.budgets.userId, userId));
  const recurring = await db
    .select()
    .from(tables.recurring)
    .where(eq(tables.recurring.userId, userId));
  const occurrences = await db
    .select()
    .from(tables.occurrences)
    .where(eq(tables.occurrences.userId, userId));
  return dataSchema.parse({
    wallets,
    spaces,
    categories,
    transactions,
    transfers,
    adjustments,
    budgets,
    recurring,
    occurrences,
  });
}
async function wallet(
  db: DatabaseExecutor,
  userId: string,
  walletId: string,
  allowArchived = false,
) {
  const [row] = await db
    .select()
    .from(tables.wallets)
    .where(and(eq(tables.wallets.userId, userId), eq(tables.wallets.id, walletId)));
  if (!row) fail("Wallet not found.", 404);
  if (row.archived && !allowArchived) fail("This wallet is archived.");
  return row;
}
async function validateReferences(
  db: DatabaseExecutor,
  userId: string,
  value: { walletId: string; categoryId: string; spaceId: string },
  kind: string,
  existing?: { walletId: string; categoryId: string },
) {
  const selectedWallet = await wallet(
    db,
    userId,
    value.walletId,
    existing?.walletId === value.walletId,
  );
  const [category] = await db
    .select()
    .from(tables.categories)
    .where(and(eq(tables.categories.id, value.categoryId), eq(tables.categories.userId, userId)));
  const [space] = await db
    .select()
    .from(tables.spaces)
    .where(and(eq(tables.spaces.id, value.spaceId), eq(tables.spaces.userId, userId)));
  if (
    !category ||
    (category.archived && existing?.categoryId !== value.categoryId) ||
    category.kind !== kind
  )
    fail("Choose an active category matching the transaction type.");
  if (!space) fail("Space not found.", 404);
  return selectedWallet;
}
function validateAmount(amount: string, currency: string) {
  if (!validPrecision(amount, currencySchema.parse(currency)))
    fail("Amount has too many decimal places for this currency.");
}
async function transactionValues(
  db: DatabaseExecutor,
  user: User,
  value: z.infer<typeof transactionInput>,
  existing?: { walletId: string; categoryId: string },
) {
  const selectedWallet = await validateReferences(db, user.id, value, value.kind, existing);
  validateAmount(value.amount, selectedWallet.currency);
  if (
    selectedWallet.currency === user.reportingCurrency &&
    decimalUnits(value.exchangeRate) !== decimalUnits("1")
  )
    fail("Use exchange rate 1 for your reporting currency.");
  const reportingAmount = convertMoney(value.amount, value.exchangeRate, user.reportingCurrency);
  if (decimalUnits(reportingAmount) >= 10n ** 24n) fail("Converted amount is too large.");
  return { ...value, userId: user.id, reportingAmount };
}
export const finance = new Hono<AppEnv>();
finance.use("*", async (c, next) => {
  const user = await currentUser(c);
  if (!user) return c.json({ message: "Please sign in." }, 401);
  if (!user.verified)
    return c.json({ message: "Verify your email before accessing financial records." }, 403);
  c.set("user", user);
  await next();
});
finance.get("/data", async (c) =>
  c.json(
    await withDatabase(c.env, (db) =>
      db.transaction((tx) => loadFinance(tx, c.get("user").id), {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      }),
    ),
  ),
);
finance.get("/summary", async (c) => {
  const spaceId = idSchema.optional().parse(c.req.query("spaceId"));
  const data = await withDatabase(c.env, (db) =>
    db.transaction((tx) => loadFinance(tx, c.get("user").id), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    }),
  );
  if (spaceId && !data.spaces.some((s) => s.id === spaceId)) fail("Space not found.", 404);
  return c.json(financialSummary(data, spaceId));
});
finance.get("/export", async (c) => {
  const filters = filtersSchema.parse(c.req.query());
  const data = await withDatabase(c.env, (db) =>
    db.transaction((tx) => loadFinance(tx, c.get("user").id), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    }),
  );
  c.header("Content-Disposition", 'attachment; filename="financial-os-transactions.csv"');
  c.header("Content-Type", "text/csv; charset=utf-8");
  return c.body(ledgerCsv(data, filters));
});
// Serialize changes per account, including reporting-currency changes and confirmations.
async function write<T>(
  env: AppEnv["Bindings"],
  user: User,
  callback: (db: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  return withDatabase(env, (db) =>
    db.transaction(async (tx) => {
      const [fresh] = await tx
        .select()
        .from(tables.users)
        .where(eq(tables.users.id, user.id))
        .for("update");
      if (!fresh?.verifiedAt) fail("Account access changed. Sign in again.", 409);
      if (fresh.reportingCurrency !== user.reportingCurrency)
        fail("Account currency changed. Refresh before saving.", 409);
      return callback(tx);
    }),
  );
}
finance.post("/wallets", async (c) => {
  const value = walletInput.parse(await c.req.json());
  const user = c.get("user");
  validateAmount(value.openingBalance, value.currency);
  if (
    value.currency === user.reportingCurrency &&
    decimalUnits(value.exchangeRate) !== decimalUnits("1")
  )
    fail("Use exchange rate 1 for your reporting currency.");
  const openingReporting = convertMoney(
    value.openingBalance,
    value.exchangeRate,
    user.reportingCurrency,
  );
  if (decimalUnits(openingReporting) >= 10n ** 24n) fail("Converted opening balance is too large.");
  await write(c.env, user, (db) =>
    db.insert(tables.wallets).values({ ...value, userId: user.id, openingReporting }),
  );
  return c.json({ message: "Wallet created." }, 201);
});
finance.patch("/wallets/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const value = z
    .object({ name: walletInput.shape.name, archived: z.boolean() })
    .parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    if (value.archived) {
      const [dependent] = await db
        .select()
        .from(tables.recurring)
        .where(
          and(
            eq(tables.recurring.userId, user.id),
            eq(tables.recurring.walletId, id),
            eq(tables.recurring.paused, false),
          ),
        )
        .limit(1);
      if (dependent) fail("Pause or reassign active recurring schedules before archiving.", 409);
    }
    const rows = await db
      .update(tables.wallets)
      .set(value)
      .where(and(eq(tables.wallets.id, id), eq(tables.wallets.userId, user.id)))
      .returning();
    if (!rows.length) fail("Wallet not found.", 404);
  });
  return c.json({ message: "Wallet updated." });
});
finance.post("/spaces", async (c) => {
  const value = spaceInput.parse(await c.req.json());
  const user = c.get("user");
  if (value.budget) validateAmount(value.budget, user.reportingCurrency);
  await write(c.env, user, (db) => db.insert(tables.spaces).values({ ...value, userId: user.id }));
  return c.json({ message: "Space created." }, 201);
});
finance.patch("/spaces/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const value = spaceInput.parse(await c.req.json());
  const user = c.get("user");
  if (value.budget) validateAmount(value.budget, user.reportingCurrency);
  await write(c.env, user, async (db) => {
    const rows = await db
      .update(tables.spaces)
      .set(value)
      .where(and(eq(tables.spaces.id, id), eq(tables.spaces.userId, user.id)))
      .returning();
    if (!rows.length) fail("Space not found.", 404);
  });
  return c.json({ message: "Space updated." });
});
finance.delete("/spaces/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const rows = await db
      .delete(tables.spaces)
      .where(
        and(
          eq(tables.spaces.id, id),
          eq(tables.spaces.userId, user.id),
          eq(tables.spaces.isDefault, false),
        ),
      )
      .returning();
    if (!rows.length) fail("Space not found or it is your default Space.", 404);
  });
  return c.json({ message: "Space deleted." });
});
finance.post("/categories", async (c) => {
  const value = categoryInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, (db) =>
    db.insert(tables.categories).values({ ...value, userId: user.id }),
  );
  return c.json({ message: "Category created." }, 201);
});
finance.patch("/categories/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const value = z
    .object({ name: categoryInput.shape.name, archived: z.boolean() })
    .parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    if (value.archived) {
      const [dependent] = await db
        .select()
        .from(tables.recurring)
        .where(
          and(
            eq(tables.recurring.userId, user.id),
            eq(tables.recurring.categoryId, id),
            eq(tables.recurring.paused, false),
          ),
        )
        .limit(1);
      if (dependent) fail("Pause or reassign active recurring schedules before archiving.", 409);
    }
    const rows = await db
      .update(tables.categories)
      .set(value)
      .where(and(eq(tables.categories.id, id), eq(tables.categories.userId, user.id)))
      .returning();
    if (!rows.length) fail("Category not found.", 404);
  });
  return c.json({ message: "Category updated." });
});
finance.post("/transactions", async (c) => {
  const value = transactionInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) =>
    db.insert(tables.transactions).values(await transactionValues(db, user, value)),
  );
  return c.json({ message: "Transaction recorded." }, 201);
});
finance.patch("/transactions/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const value = transactionInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const [existing] = await db
      .select()
      .from(tables.transactions)
      .where(and(eq(tables.transactions.id, id), eq(tables.transactions.userId, user.id)));
    if (!existing) fail("Transaction not found.", 404);
    const rows = await db
      .update(tables.transactions)
      .set(await transactionValues(db, user, value, existing))
      .where(and(eq(tables.transactions.id, id), eq(tables.transactions.userId, user.id)))
      .returning();
    if (!rows.length) fail("Transaction not found.", 404);
  });
  return c.json({ message: "Transaction updated." });
});
finance.delete("/transactions/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const [linked] = await db
      .select()
      .from(tables.occurrences)
      .where(and(eq(tables.occurrences.transactionId, id), eq(tables.occurrences.userId, user.id)));
    if (linked) await db.delete(tables.occurrences).where(eq(tables.occurrences.id, linked.id));
    const rows = await db
      .delete(tables.transactions)
      .where(and(eq(tables.transactions.id, id), eq(tables.transactions.userId, user.id)))
      .returning();
    if (!rows.length) fail("Transaction not found.", 404);
  });
  return c.json({ message: "Transaction deleted. Any linked recurring occurrence is due again." });
});
finance.post("/transfers", async (c) => {
  const value = transferInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const from = await wallet(db, user.id, value.fromWalletId);
    const to = await wallet(db, user.id, value.toWalletId);
    validateAmount(value.sentAmount, from.currency);
    validateAmount(value.receivedAmount, to.currency);
    if (
      from.currency === to.currency &&
      decimalUnits(value.sentAmount) !== decimalUnits(value.receivedAmount)
    )
      fail("Same-currency transfers must have equal amounts. Record fees separately.");
    await db.insert(tables.transfers).values({ ...value, userId: user.id });
  });
  return c.json({ message: "Transfer recorded." }, 201);
});
finance.delete("/transfers/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const rows = await db
      .delete(tables.transfers)
      .where(and(eq(tables.transfers.id, id), eq(tables.transfers.userId, user.id)))
      .returning();
    if (!rows.length) fail("Transfer not found.", 404);
  });
  return c.json({ message: "Transfer deleted." });
});
finance.post("/adjustments", async (c) => {
  const value = adjustmentInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const selected = await wallet(db, user.id, value.walletId);
    validateAmount(value.amount, selected.currency);
    if (value.expectedBalance !== undefined) {
      const current = walletBalance(await loadFinance(db, user.id), value.walletId);
      if (decimalUnits(current) !== decimalUnits(value.expectedBalance))
        fail(
          "This balance changed while you were editing. Cancel and reopen the correction to review the current balance.",
          409,
        );
    }
    await db.insert(tables.adjustments).values({
      walletId: value.walletId,
      amount: value.amount,
      date: value.date,
      notes: value.notes,
      userId: user.id,
    });
  });
  return c.json({ message: "Balance adjustment recorded." }, 201);
});
finance.delete("/adjustments/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const rows = await db
      .delete(tables.adjustments)
      .where(and(eq(tables.adjustments.id, id), eq(tables.adjustments.userId, user.id)))
      .returning();
    if (!rows.length) fail("Adjustment not found.", 404);
  });
  return c.json({ message: "Adjustment deleted." });
});
finance.post("/budgets", async (c) => {
  const value = budgetInput.parse(await c.req.json());
  const user = c.get("user");
  validateAmount(value.amount, user.reportingCurrency);
  await write(c.env, user, async (db) => {
    const [category] = await db
      .select()
      .from(tables.categories)
      .where(
        and(
          eq(tables.categories.id, value.categoryId),
          eq(tables.categories.userId, user.id),
          eq(tables.categories.kind, "expense"),
        ),
      );
    if (!category) fail("Choose an expense category.");
    if (category.archived) {
      const [existing] = await db
        .select()
        .from(tables.budgets)
        .where(
          and(
            eq(tables.budgets.userId, user.id),
            eq(tables.budgets.categoryId, value.categoryId),
            eq(tables.budgets.month, value.month),
          ),
        );
      if (!existing) fail("Restore this category before creating a new budget.");
    }
    await db
      .insert(tables.budgets)
      .values({ ...value, userId: user.id })
      .onConflictDoUpdate({
        target: [tables.budgets.userId, tables.budgets.categoryId, tables.budgets.month],
        set: { amount: value.amount },
      });
  });
  return c.json({ message: "Budget saved." });
});
finance.delete("/budgets/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const rows = await db
      .delete(tables.budgets)
      .where(and(eq(tables.budgets.id, id), eq(tables.budgets.userId, user.id)))
      .returning();
    if (!rows.length) fail("Budget not found.", 404);
  });
  return c.json({ message: "Budget deleted." });
});
finance.post("/recurring", async (c) => {
  const value = recurringInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const selected = await validateReferences(db, user.id, value, "expense");
    validateAmount(value.amount, selected.currency);
    await db.insert(tables.recurring).values({ ...value, userId: user.id });
  });
  return c.json({ message: "Recurring payment created." }, 201);
});
finance.patch("/recurring/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const value = recurringInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const [existing] = await db
      .select()
      .from(tables.recurring)
      .where(and(eq(tables.recurring.id, id), eq(tables.recurring.userId, user.id)));
    if (!existing) fail("Schedule not found.", 404);
    const selected = await validateReferences(
      db,
      user.id,
      value,
      "expense",
      value.paused ? existing : undefined,
    );
    validateAmount(value.amount, selected.currency);
    if (existing.startDate !== value.startDate)
      fail("The monthly anchor cannot change. Pause this schedule and create a new one.");
    await db.update(tables.recurring).set(value).where(eq(tables.recurring.id, id));
  });
  return c.json({ message: "Recurring payment updated." });
});
finance.post("/recurring/:id/confirm", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const value = confirmationInput.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const [schedule] = await db
      .select()
      .from(tables.recurring)
      .where(and(eq(tables.recurring.id, id), eq(tables.recurring.userId, user.id)));
    if (!schedule) fail("Schedule not found.", 404);
    if (
      schedule.paused ||
      value.dueDate < schedule.startDate ||
      (schedule.endDate && value.dueDate > schedule.endDate) ||
      value.dueDate !== occurrenceDate(schedule.startDate, value.dueDate.slice(0, 7)) ||
      value.dueDate.slice(0, 7) >
        format(addMonths(parseISO(accountToday(user.timezone)), 1), "yyyy-MM")
    )
      fail("Invalid scheduled occurrence.");
    const [existing] = await db
      .select()
      .from(tables.occurrences)
      .where(
        and(eq(tables.occurrences.recurringId, id), eq(tables.occurrences.dueDate, value.dueDate)),
      );
    if (existing) {
      if (existing.status !== value.status)
        fail("This occurrence has already been confirmed with a different status.", 409);
      return;
    }
    let transactionId: string | null = null;
    if (value.status === "paid") {
      const values = await transactionValues(db, user, {
        walletId: schedule.walletId,
        categoryId: schedule.categoryId,
        spaceId: schedule.spaceId,
        kind: "expense",
        amount: value.amount,
        exchangeRate: value.exchangeRate,
        date: value.date,
        notes: schedule.name,
        preparation: false,
      });
      const [created] = await db.insert(tables.transactions).values(values).returning();
      if (!created) fail("Unable to record payment.");
      transactionId = created.id;
    }
    await db.insert(tables.occurrences).values({
      userId: user.id,
      recurringId: id,
      dueDate: value.dueDate,
      status: value.status,
      transactionId,
    });
  });
  return c.json({
    message: value.status === "paid" ? "Payment confirmed." : "Occurrence skipped.",
  });
});
// Undo only skipped occurrences; paid transactions use the existing explicit edit/delete flow.
finance.delete("/occurrences/:id", async (c) => {
  const id = idSchema.parse(c.req.param("id"));
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    const [occurrence] = await db
      .select()
      .from(tables.occurrences)
      .where(and(eq(tables.occurrences.id, id), eq(tables.occurrences.userId, user.id)));
    if (!occurrence) fail("Occurrence not found.", 404);
    if (occurrence.status !== "skipped" || occurrence.transactionId)
      fail("Only a skipped payment can be restored here.", 409);
    await db
      .delete(tables.occurrences)
      .where(and(eq(tables.occurrences.id, id), eq(tables.occurrences.userId, user.id)));
  });
  return c.json({ message: "Skip undone. This payment is due again when its schedule is active." });
});
finance.patch("/settings", async (c) => {
  const value = settingsSchema.parse(await c.req.json());
  const user = c.get("user");
  await write(c.env, user, async (db) => {
    if (value.reportingCurrency !== user.reportingCurrency) {
      const [walletRow] = await db
        .select()
        .from(tables.wallets)
        .where(eq(tables.wallets.userId, user.id))
        .limit(1);
      const [budgetRow] = await db
        .select()
        .from(tables.budgets)
        .where(eq(tables.budgets.userId, user.id))
        .limit(1);
      const [spaceRow] = await db
        .select()
        .from(tables.spaces)
        .where(and(eq(tables.spaces.userId, user.id), sql`${tables.spaces.budget} IS NOT NULL`))
        .limit(1);
      if (walletRow || budgetRow || spaceRow)
        fail("Reporting currency is fixed after financial records exist.");
    }
    await db.update(tables.users).set(value).where(eq(tables.users.id, user.id));
  });
  return c.json({ message: "Settings saved." });
});
