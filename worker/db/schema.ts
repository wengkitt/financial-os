import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  unique,
  foreignKey,
  check,
  index,
  integer,
} from "drizzle-orm/pg-core";
const id = () => uuid("id").primaryKey().defaultRandom();
const money = (name: string) => numeric(name, { precision: 24, scale: 8 }).notNull();
export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  username: text().notNull().unique(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  reportingCurrency: text("reporting_currency").notNull().default("MYR"),
  timezone: text().notNull().default("Asia/Kuala_Lumpur"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: owner(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const authTokens = pgTable("auth_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: owner(),
  purpose: text().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const authThrottles = pgTable("auth_throttles", {
  key: text().primaryKey(),
  count: integer().notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});
export const wallets = pgTable(
  "wallets",
  {
    id: id(),
    userId: owner(),
    name: text().notNull(),
    kind: text().notNull(),
    currency: text().notNull(),
    openingBalance: money("opening_balance"),
    exchangeRate: money("exchange_rate"),
    openingReporting: money("opening_reporting"),
    archived: boolean().notNull().default(false),
  },
  (t) => [
    unique().on(t.id, t.userId),
    check("wallet_opening_nonnegative", sql`${t.openingBalance} >= 0 AND ${t.exchangeRate} > 0`),
  ],
);
export const spaces = pgTable(
  "spaces",
  {
    id: id(),
    userId: owner(),
    name: text().notNull(),
    description: text().notNull().default(""),
    startDate: date("start_date"),
    endDate: date("end_date"),
    budget: numeric({ precision: 24, scale: 8 }),
    status: text().notNull().default("active"),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [
    unique().on(t.id, t.userId),
    check(
      "space_date_order",
      sql`${t.endDate} IS NULL OR ${t.startDate} IS NULL OR ${t.endDate} >= ${t.startDate}`,
    ),
  ],
);
export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: owner(),
    name: text().notNull(),
    kind: text().notNull(),
    archived: boolean().notNull().default(false),
  },
  (t) => [unique().on(t.id, t.userId), unique().on(t.userId, t.name, t.kind)],
);
export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: owner(),
    walletId: uuid("wallet_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    kind: text().notNull(),
    amount: money("amount"),
    exchangeRate: money("exchange_rate"),
    reportingAmount: money("reporting_amount"),
    date: date().notNull(),
    notes: text().notNull().default(""),
    preparation: boolean().notNull().default(false),
  },
  (t) => [
    unique().on(t.id, t.userId),
    foreignKey({ columns: [t.walletId, t.userId], foreignColumns: [wallets.id, wallets.userId] }),
    foreignKey({
      columns: [t.categoryId, t.userId],
      foreignColumns: [categories.id, categories.userId],
    }),
    foreignKey({ columns: [t.spaceId, t.userId], foreignColumns: [spaces.id, spaces.userId] }),
    check("transaction_amount_positive", sql`${t.amount} > 0 AND ${t.exchangeRate} > 0`),
    check("transaction_preparation_expense", sql`NOT ${t.preparation} OR ${t.kind} = 'expense'`),
    index().on(t.userId, t.date),
  ],
);
export const transfers = pgTable(
  "transfers",
  {
    id: id(),
    userId: owner(),
    fromWalletId: uuid("from_wallet_id").notNull(),
    toWalletId: uuid("to_wallet_id").notNull(),
    sentAmount: money("sent_amount"),
    receivedAmount: money("received_amount"),
    date: date().notNull(),
    notes: text().notNull().default(""),
  },
  (t) => [
    foreignKey({
      columns: [t.fromWalletId, t.userId],
      foreignColumns: [wallets.id, wallets.userId],
    }),
    foreignKey({ columns: [t.toWalletId, t.userId], foreignColumns: [wallets.id, wallets.userId] }),
    check(
      "transfer_valid",
      sql`${t.fromWalletId} <> ${t.toWalletId} AND ${t.sentAmount} > 0 AND ${t.receivedAmount} > 0`,
    ),
  ],
);
export const adjustments = pgTable(
  "adjustments",
  {
    id: id(),
    userId: owner(),
    walletId: uuid("wallet_id").notNull(),
    amount: money("amount"),
    date: date().notNull(),
    notes: text().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.walletId, t.userId], foreignColumns: [wallets.id, wallets.userId] }),
  ],
);
export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: owner(),
    categoryId: uuid("category_id").notNull(),
    month: text().notNull(),
    amount: money("amount"),
  },
  (t) => [
    foreignKey({
      columns: [t.categoryId, t.userId],
      foreignColumns: [categories.id, categories.userId],
    }),
    unique().on(t.userId, t.categoryId, t.month),
    check("budget_positive", sql`${t.amount} > 0`),
  ],
);
export const recurring = pgTable(
  "recurring",
  {
    id: id(),
    userId: owner(),
    name: text().notNull(),
    walletId: uuid("wallet_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    amount: money("amount"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    paused: boolean().notNull().default(false),
  },
  (t) => [
    unique().on(t.id, t.userId),
    foreignKey({ columns: [t.walletId, t.userId], foreignColumns: [wallets.id, wallets.userId] }),
    foreignKey({
      columns: [t.categoryId, t.userId],
      foreignColumns: [categories.id, categories.userId],
    }),
    foreignKey({ columns: [t.spaceId, t.userId], foreignColumns: [spaces.id, spaces.userId] }),
    check(
      "recurring_valid",
      sql`${t.amount} > 0 AND (${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate})`,
    ),
  ],
);
export const occurrences = pgTable(
  "occurrences",
  {
    id: id(),
    userId: owner(),
    recurringId: uuid("recurring_id").notNull(),
    dueDate: date("due_date").notNull(),
    status: text().notNull(),
    transactionId: uuid("transaction_id"),
  },
  (t) => [
    foreignKey({
      columns: [t.recurringId, t.userId],
      foreignColumns: [recurring.id, recurring.userId],
    }),
    foreignKey({
      columns: [t.transactionId, t.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("restrict"),
    unique().on(t.recurringId, t.dueDate),
  ],
);
