import { z } from "zod";
import { isValid, parseISO, format } from "date-fns";
import { currencySchema, decimalSchema, decimalUnits } from "./money.ts";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine(
    (v) => isValid(parseISO(v)) && format(parseISO(v), "yyyy-MM-dd") === v,
    "Enter a valid date",
  );
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid month");
export const idSchema = z.uuid({ error: "Choose a valid record" });
export const amountSchema = decimalSchema.pipe(
  z.string().refine((v) => decimalUnits(v) > 0n, "Amount must be greater than zero"),
);
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(80, "Use 80 characters or fewer");
export const timezones = [
  "Asia/Kuala_Lumpur",
  "Pacific/Auckland",
  "Australia/Sydney",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;
export const settingsSchema = z.object({
  name: nameSchema,
  reportingCurrency: currencySchema,
  timezone: z.enum(timezones),
});
export const registerSchema = settingsSchema.extend({
  username: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters")
    .max(32, "Use 32 characters or fewer")
    .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores"),
  email: z.email({ error: "Enter a valid email address" }).max(254),
  password: z
    .string()
    .min(15, "Use at least 15 characters")
    .max(128, "Use 128 characters or fewer"),
});
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});
export const emailSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).max(254),
});
export const tokenSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "This link is invalid. Request a new link."),
});
export const resetSchema = tokenSchema.extend({ password: registerSchema.shape.password });
export const userSchema = settingsSchema.extend({
  id: idSchema,
  username: z.string(),
  email: z.email(),
  verified: z.boolean(),
});
export const sessionSchema = z.object({ user: userSchema.nullable() });
export type User = z.infer<typeof userSchema>;
export const walletInput = z.object({
  name: nameSchema,
  kind: z.enum(["bank", "cash", "ewallet"]),
  currency: currencySchema,
  openingBalance: decimalSchema,
  exchangeRate: amountSchema,
});
export const walletSchema = walletInput.extend({
  id: idSchema,
  openingReporting: z.string(),
  archived: z.boolean(),
});
export const spaceInput = z
  .object({
    name: nameSchema,
    description: z.string().max(2000),
    startDate: dateSchema.nullable(),
    endDate: dateSchema.nullable(),
    budget: amountSchema.nullable(),
    status: z.enum(["active", "completed"]),
  })
  .refine(
    (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate,
    "End date must follow start date",
  );
export const spaceSchema = spaceInput.safeExtend({ id: idSchema, isDefault: z.boolean() });
export const categoryInput = z.object({ name: nameSchema, kind: z.enum(["income", "expense"]) });
export const categorySchema = categoryInput.extend({ id: idSchema, archived: z.boolean() });
export const transactionInput = z
  .object({
    kind: z.enum(["income", "expense"]),
    walletId: idSchema,
    categoryId: idSchema,
    spaceId: idSchema,
    amount: amountSchema,
    exchangeRate: amountSchema,
    date: dateSchema,
    notes: z.string().max(2000),
    preparation: z.boolean(),
  })
  .refine((v) => !v.preparation || v.kind === "expense", "Preparation applies only to expenses");
export const transactionSchema = transactionInput.safeExtend({
  id: idSchema,
  reportingAmount: z.string(),
});
export const transferInput = z
  .object({
    fromWalletId: idSchema,
    toWalletId: idSchema,
    sentAmount: amountSchema,
    receivedAmount: amountSchema,
    date: dateSchema,
    notes: z.string().max(2000),
  })
  .refine((v) => v.fromWalletId !== v.toWalletId, "Choose different wallets");
export const transferSchema = transferInput.safeExtend({ id: idSchema });
export const adjustmentInput = z.object({
  walletId: idSchema,
  amount: z.string().regex(/^-?\d{1,14}(\.\d{1,8})?$/),
  date: dateSchema,
  notes: z
    .string()
    .trim()
    .min(1, "Enter a reason for the correction")
    .max(2000, "Use 2,000 characters or fewer"),
  expectedBalance: z
    .string()
    .regex(/^-?\d{1,14}(\.\d{1,8})?$/, "Enter a valid balance")
    .optional(),
});
export const adjustmentSchema = adjustmentInput.extend({ id: idSchema });
export const budgetInput = z.object({
  categoryId: idSchema,
  month: monthSchema,
  amount: amountSchema,
});
export const budgetSchema = budgetInput.extend({ id: idSchema });
export const recurringInput = z
  .object({
    name: nameSchema,
    walletId: idSchema,
    categoryId: idSchema,
    spaceId: idSchema,
    amount: amountSchema,
    startDate: dateSchema,
    endDate: dateSchema.nullable(),
    paused: z.boolean(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, "End date must follow start date");
export const recurringSchema = recurringInput.safeExtend({ id: idSchema });
export const occurrenceSchema = z.object({
  id: idSchema,
  recurringId: idSchema,
  dueDate: dateSchema,
  status: z.enum(["paid", "skipped"]),
  transactionId: idSchema.nullable(),
});
export const confirmationInput = z.object({
  dueDate: dateSchema,
  status: z.enum(["paid", "skipped"]),
  amount: amountSchema,
  exchangeRate: amountSchema,
  date: dateSchema,
});
export const filtersSchema = z.object({
  search: z.string().max(200).default(""),
  kind: z.enum(["income", "expense"]).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  walletId: idSchema.optional(),
  categoryId: idSchema.optional(),
  spaceId: idSchema.optional(),
});
export const dataSchema = z.object({
  wallets: z.array(walletSchema),
  spaces: z.array(spaceSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  transfers: z.array(transferSchema),
  adjustments: z.array(adjustmentSchema),
  budgets: z.array(budgetSchema),
  recurring: z.array(recurringSchema),
  occurrences: z.array(occurrenceSchema),
});
export const messageSchema = z.object({ message: z.string() });
export type FinanceData = z.infer<typeof dataSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Filters = z.infer<typeof filtersSchema>;

export const viewSearchSchema = z.object({
  search: z.string().max(200).catch("").default(""),
  from: dateSchema.optional().catch(undefined),
  to: dateSchema.optional().catch(undefined),
  walletId: idSchema.optional().catch(undefined),
  categoryId: idSchema.optional().catch(undefined),
  spaceId: idSchema.optional().catch(undefined),
  kind: z.enum(["income", "expense"]).optional().catch(undefined),
  month: monthSchema.optional().catch(undefined),
});

export const authSearch = z.object({ token: z.string().optional() });
