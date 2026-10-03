import { describe, it, expect } from "vite-plus/test";
import { convertMoney, sumMoney, moneyLabel, validPrecision, editableDecimal } from "./money";
import {
  financialSummary,
  walletBalance,
  occurrenceDate,
  pendingPayments,
  budgetSpent,
  ledgerCsv,
  filterTransactions,
} from "./finance";
import {
  dateSchema,
  dataSchema,
  transactionInput,
  amountSchema,
  viewSearchSchema,
} from "./contracts";
import type { FinanceData } from "./contracts";
import { accountToday } from "./date";
import { parseISO } from "date-fns";
const ids = Array.from(
  { length: 15 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
function id(i: number) {
  const value = ids[i];
  if (!value) throw new Error("Missing fixture identifier");
  return value;
}
function fixture(): FinanceData {
  return dataSchema.parse({
    wallets: [
      {
        id: id(0),
        name: "Bank",
        kind: "bank",
        currency: "MYR",
        openingBalance: "10000",
        exchangeRate: "1",
        openingReporting: "10000",
        archived: false,
      },
      {
        id: id(1),
        name: "Cash",
        kind: "cash",
        currency: "MYR",
        openingBalance: "0",
        exchangeRate: "1",
        openingReporting: "0",
        archived: false,
      },
    ],
    spaces: [
      {
        id: id(2),
        name: "Everyday",
        description: "",
        startDate: null,
        endDate: null,
        budget: null,
        status: "active",
        isDefault: true,
      },
      {
        id: id(3),
        name: "New Zealand",
        description: "",
        startDate: "2026-02-01",
        endDate: null,
        budget: "26000",
        status: "active",
        isDefault: false,
      },
    ],
    categories: [
      { id: id(4), name: "Salary", kind: "income", archived: false },
      { id: id(5), name: "Travel", kind: "expense", archived: false },
    ],
    transactions: [
      {
        id: id(6),
        kind: "expense",
        walletId: id(0),
        categoryId: id(5),
        spaceId: id(3),
        amount: "8000",
        exchangeRate: "1",
        reportingAmount: "8000",
        date: "2026-01-15",
        notes: "Preparation",
        preparation: true,
      },
      {
        id: id(7),
        kind: "income",
        walletId: id(0),
        categoryId: id(4),
        spaceId: id(3),
        amount: "30000",
        exchangeRate: "1",
        reportingAmount: "30000",
        date: "2026-02-15",
        notes: "Work",
        preparation: false,
      },
      {
        id: id(8),
        kind: "expense",
        walletId: id(0),
        categoryId: id(5),
        spaceId: id(3),
        amount: "18000",
        exchangeRate: "1",
        reportingAmount: "18000",
        date: "2026-02-16",
        notes: "Living",
        preparation: false,
      },
      {
        id: id(9),
        kind: "income",
        walletId: id(0),
        categoryId: id(4),
        spaceId: id(2),
        amount: "5000",
        exchangeRate: "1",
        reportingAmount: "5000",
        date: "2026-02-17",
        notes: "Everyday salary",
        preparation: false,
      },
    ],
    transfers: [
      {
        id: id(10),
        fromWalletId: id(0),
        toWalletId: id(1),
        sentAmount: "100",
        receivedAmount: "100",
        date: "2026-02-17",
        notes: "",
      },
    ],
    adjustments: [
      { id: id(11), walletId: id(0), amount: "-5", date: "2026-02-17", notes: "Correction" },
    ],
    budgets: [],
    recurring: [
      {
        id: id(12),
        name: "Rent",
        walletId: id(0),
        categoryId: id(5),
        spaceId: id(3),
        amount: "1000",
        startDate: "2026-01-31",
        endDate: null,
        paused: false,
      },
    ],
    occurrences: [],
  });
}
describe("Financial calculations", () => {
  it("covers the working holiday without including Everyday or opening money", () => {
    const data = fixture();
    const trip = financialSummary(data, id(3));
    expect(trip.income).toBe("30000.00000000");
    expect(trip.expenses).toBe("26000.00000000");
    expect(trip.preparation).toBe("8000.00000000");
    expect(trip.surplus).toBe("12000.00000000");
    expect(trip.result).toBe("4000.00000000");
    expect(trip.recovered).toBe(true);
    expect(financialSummary(data).income).toBe("35000.00000000");
  });
  it("shows the shortfall after covering running expenses", () => {
    const data = fixture();
    const row = data.transactions.find((t) => t.id === id(7));
    if (row) row.reportingAmount = "20000";
    expect(financialSummary(data, id(3)).unrecovered).toBe("6000.00000000");
  });
  it("calculates both wallet movements and excludes corrections from reports", () => {
    const data = fixture();
    expect(walletBalance(data, id(0))).toBe("18895.00000000");
    expect(walletBalance(data, id(1))).toBe("100.00000000");
    expect(financialSummary(data).expenses).toBe("26000.00000000");
    const row = data.transactions.find((t) => t.id === id(8));
    if (row) row.amount = "17000";
    expect(walletBalance(data, id(0))).toBe("19895.00000000");
    data.transactions = data.transactions.filter((t) => t.id !== id(8));
    expect(walletBalance(data, id(0))).toBe("36895.00000000");
  });
  it("uses exact decimal arithmetic and currency rounding", () => {
    expect(sumMoney(["0.1", "0.2"])).toBe("0.30000000");
    expect(convertMoney("123.45", "2.75", "MYR")).toBe("339.49000000");
    expect(convertMoney("1.5", "1", "JPY")).toBe("2.00000000");
    expect(validPrecision("1.001", "MYR")).toBe(false);
    expect(convertMoney("1.005", "0.99999999", "MYR")).toBe("1.00000000");
    expect(amountSchema.safeParse("invalid").success).toBe(false);
    expect(moneyLabel("-1234.5", "MYR")).toBe("MYR -1,234.50");
  });
  it("keeps monthly anchors across leap years and short months", () => {
    expect(occurrenceDate("2024-01-31", "2024-02")).toBe("2024-02-29");
    expect(occurrenceDate("2024-01-31", "2024-03")).toBe("2024-03-31");
    expect(occurrenceDate("2026-01-31", "2026-02")).toBe("2026-02-28");
  });
  it("omits paid, skipped, paused and ended occurrences", () => {
    const data = fixture();
    data.occurrences.push({
      id: id(13),
      recurringId: id(12),
      dueDate: "2026-01-31",
      status: "skipped",
      transactionId: null,
    });
    expect(pendingPayments(data, "2026-02-15").map((p) => p.dueDate)).toEqual([
      "2026-02-28",
      "2026-03-31",
    ]);
    const schedule = data.recurring[0];
    if (schedule) {
      schedule.endDate = "2026-02-28";
      expect(pendingPayments(data, "2026-02-15")).toHaveLength(1);
      schedule.paused = true;
      expect(pendingPayments(data, "2026-02-15")).toHaveLength(0);
    }
  });
  it("counts only expenses in the selected budget month", () => {
    expect(budgetSpent(fixture(), id(5), "2026-02")).toBe("18000.00000000");
  });
  it("filters and protects CSV cells", () => {
    const data = fixture();
    const row = data.transactions.find((t) => t.id === id(8));
    if (row) row.notes = '=HYPERLINK("bad")\nsecond line';
    expect(filterTransactions(data, { search: "living", spaceId: id(2) })).toHaveLength(0);
    expect(
      filterTransactions(data, { search: "", from: "2026-02-01", spaceId: id(3) }),
    ).toHaveLength(2);
    expect(ledgerCsv(data, { search: "", spaceId: id(3) })).toContain(
      '"\'=HYPERLINK(""bad"")\nsecond line"',
    );
  });
  it("validates calendar dates and preparation types", () => {
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    const row = fixture().transactions.find((t) => t.kind === "income");
    expect(transactionInput.safeParse({ ...row, preparation: true }).success).toBe(false);
  });
  it("does not claim recovery without preparation activity", () => {
    const data = fixture();
    expect(financialSummary({ ...data, transactions: [] }).recovered).toBe(false);
    expect(financialSummary(data, id(2)).recovered).toBe(false);
  });
  it("preserves decimal precision while making edit values readable", () => {
    expect(editableDecimal("45.00000000")).toBe("45");
    expect(editableDecimal("0.00000001")).toBe("0.00000001");
    expect(editableDecimal("-5.25000000")).toBe("-5.25");
  });
  it("filters transaction type consistently in lists and exports", () => {
    const data = fixture();
    expect(filterTransactions(data, { search: "", kind: "expense" })).toHaveLength(2);
    expect(ledgerCsv(data, { search: "", kind: "expense" })).not.toContain('"income"');
    expect(viewSearchSchema.parse({ month: "bad", walletId: "bad", from: "2026-02-30" })).toEqual({
      search: "",
    });
  });
  it("uses account timezone at a UTC month boundary", () => {
    const now = parseISO("2026-01-31T18:00:00Z");
    expect(accountToday("Asia/Kuala_Lumpur", now)).toBe("2026-02-01");
    expect(accountToday("America/New_York", now)).toBe("2026-01-31");
  });
});
