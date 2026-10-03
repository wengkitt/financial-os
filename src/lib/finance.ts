import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  differenceInCalendarMonths,
  getDate,
} from "date-fns";
import { sumMoney, negateMoney, decimalUnits, decimalString } from "./money.ts";
import type { FinanceData, Filters } from "./contracts.ts";
export function walletBalance(data: FinanceData, walletId: string): string {
  const wallet = data.wallets.find((w) => w.id === walletId);
  return sumMoney([
    wallet?.openingBalance ?? "0",
    ...data.transactions
      .filter((t) => t.walletId === walletId)
      .map((t) => (t.kind === "income" ? t.amount : negateMoney(t.amount))),
    ...data.transfers.filter((t) => t.toWalletId === walletId).map((t) => t.receivedAmount),
    ...data.transfers
      .filter((t) => t.fromWalletId === walletId)
      .map((t) => negateMoney(t.sentAmount)),
    ...data.adjustments.filter((t) => t.walletId === walletId).map((t) => t.amount),
  ]);
}
export function filterTransactions(data: FinanceData, filters: Filters) {
  const search = filters.search.toLocaleLowerCase();
  return data.transactions
    .filter(
      (t) =>
        (!filters.kind || t.kind === filters.kind) &&
        (!filters.from || t.date >= filters.from) &&
        (!filters.to || t.date <= filters.to) &&
        (!filters.walletId || t.walletId === filters.walletId) &&
        (!filters.categoryId || t.categoryId === filters.categoryId) &&
        (!filters.spaceId || t.spaceId === filters.spaceId) &&
        (!search ||
          [
            t.notes,
            data.categories.find((c) => c.id === t.categoryId)?.name,
            data.wallets.find((w) => w.id === t.walletId)?.name,
            data.spaces.find((s) => s.id === t.spaceId)?.name,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
export function financialSummary(data: FinanceData, spaceId?: string) {
  const rows = data.transactions.filter((t) => !spaceId || t.spaceId === spaceId);
  const income = sumMoney(rows.filter((t) => t.kind === "income").map((t) => t.reportingAmount));
  const preparation = sumMoney(
    rows.filter((t) => t.kind === "expense" && t.preparation).map((t) => t.reportingAmount),
  );
  const running = sumMoney(
    rows.filter((t) => t.kind === "expense" && !t.preparation).map((t) => t.reportingAmount),
  );
  const expenses = sumMoney([preparation, running]);
  const surplus = sumMoney([income, negateMoney(running)]);
  const result = sumMoney([income, negateMoney(expenses)]);
  const unrecovered = decimalString(decimalUnits(result) < 0n ? -decimalUnits(result) : 0n);
  const months = [...new Set(rows.map((t) => t.date.slice(0, 7)))].sort().map((month) => ({
    month,
    income: sumMoney(
      rows
        .filter((t) => t.kind === "income" && t.date.startsWith(month))
        .map((t) => t.reportingAmount),
    ),
    expenses: sumMoney(
      rows
        .filter((t) => t.kind === "expense" && t.date.startsWith(month))
        .map((t) => t.reportingAmount),
    ),
  }));
  const breakdown = data.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      amount: sumMoney(
        rows
          .filter((t) => t.kind === "expense" && t.categoryId === c.id)
          .map((t) => t.reportingAmount),
      ),
    }))
    .filter((c) => decimalUnits(c.amount) > 0n)
    .sort((a, b) => (decimalUnits(a.amount) > decimalUnits(b.amount) ? -1 : 1));
  return {
    income,
    expenses,
    preparation,
    running,
    surplus,
    result,
    unrecovered,
    recovered: rows.length > 0 && decimalUnits(preparation) > 0n && decimalUnits(result) >= 0n,
    months,
    breakdown,
  };
}
export function budgetSpent(data: FinanceData, categoryId: string, month: string): string {
  return sumMoney(
    data.transactions
      .filter(
        (t) => t.kind === "expense" && t.categoryId === categoryId && t.date.startsWith(month),
      )
      .map((t) => t.reportingAmount),
  );
}
export function occurrenceDate(startDate: string, month: string): string {
  const target = parseISO(`${month}-01`);
  const anchor = getDate(parseISO(startDate));
  return `${format(target, "yyyy-MM")}-${Math.min(anchor, getDate(endOfMonth(target)))
    .toString()
    .padStart(2, "0")}`;
}
export function pendingPayments(data: FinanceData, today: string) {
  const through = format(addMonths(startOfMonth(parseISO(today)), 1), "yyyy-MM");
  return data.recurring
    .filter((r) => !r.paused)
    .flatMap((r) => {
      const start = startOfMonth(parseISO(r.startDate));
      const total = differenceInCalendarMonths(parseISO(`${through}-01`), start) + 1;
      return Array.from({ length: Math.max(0, total) }, (_, i) =>
        occurrenceDate(r.startDate, format(addMonths(start, i), "yyyy-MM")),
      )
        .filter(
          (dueDate) =>
            dueDate >= r.startDate &&
            (!r.endDate || dueDate <= r.endDate) &&
            !data.occurrences.some((o) => o.recurringId === r.id && o.dueDate === dueDate),
        )
        .map((dueDate) => ({ recurring: r, dueDate, overdue: dueDate < today }));
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function ledgerCsv(data: FinanceData, filters: Filters): string {
  const rows = filterTransactions(data, filters).map((t) => [
    t.date,
    t.kind,
    data.wallets.find((w) => w.id === t.walletId)?.name ?? "",
    data.wallets.find((w) => w.id === t.walletId)?.currency ?? "",
    t.amount,
    t.exchangeRate,
    t.reportingAmount,
    data.categories.find((c) => c.id === t.categoryId)?.name ?? "",
    data.spaces.find((s) => s.id === t.spaceId)?.name ?? "",
    t.preparation ? "Preparation" : "",
    t.notes,
  ]);
  return [
    [
      "Date",
      "Type",
      "Wallet",
      "Currency",
      "Amount",
      "Exchange rate",
      "Reporting amount",
      "Category",
      "Space",
      "Phase",
      "Notes",
    ],
    ...rows,
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
