import { timezoneChoices } from "@/lib/form-options";
import { BarChart, Bar, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "./ui/chart";
import {
  Item,
  ItemGroup,
  ItemHeader,
  ItemFooter,
  ItemContent,
  ItemActions,
  ItemTitle,
  ItemDescription,
} from "./ui/item";
import { choices } from "@/lib/form-options";
import { useState, useEffect, Fragment } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch, useNavigate, useBlocker } from "@tanstack/react-router";
import { format, parseISO, subMonths } from "date-fns";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  WalletCards,
  Layers,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { financeOptions, sessionOptions, useWrite, useExport } from "@/queries/financial";
import {
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
} from "@/lib/contracts";
import type { FinanceData, User, Transaction, Filters } from "@/lib/contracts";
import {
  currencies,
  moneyLabel,
  sumMoney,
  negateMoney,
  decimalUnits,
  decimalSchema,
  editableDecimal,
  convertMoney,
} from "@/lib/money";
import {
  financialSummary,
  walletBalance,
  filterTransactions,
  budgetSpent,
  pendingPayments,
} from "@/lib/finance";
import { formatDate, accountToday } from "@/lib/date";
import { FinanceForm, Pick } from "./finance-form";
import type { FormSpec, FormField, Choice } from "./finance-form";
import { buttonVariants } from "./ui/button-variants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "./ui/empty";
import { Alert, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { Progress } from "./ui/progress";
import { Field, FieldLabel, FieldGroup } from "./ui/field";
import { Input } from "./ui/input";

type Editor = { title: string; description?: string; spec: FormSpec };
const booleanChoices = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];
const f = (
  name: string,
  label: string,
  options?: Choice[],
  type?: FormField["type"],
  help?: string,
): FormField => ({ name, label, options, type, help });
const optionsFor = (rows: { id: string; name: string }[]) =>
  rows.map((row) => ({ value: row.id, label: row.name }));
function Nothing({
  title,
  description,
  icon = "wallet",
  action,
}: {
  title: string;
  description: string;
  icon?: "wallet" | "space";
  action?: ReactNode;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon === "wallet" ? <WalletCards /> : <Layers />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="metric-card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="metric-value">{value}</CardTitle>
      </CardHeader>
      <CardFooter>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </CardFooter>
    </Card>
  );
}
function BudgetProgress({
  spent,
  amount,
  currency,
}: {
  spent: string;
  amount: string;
  currency: User["reportingCurrency"];
}) {
  const overspent = decimalUnits(spent) > decimalUnits(amount);
  const percent =
    decimalUnits(amount) > 0n ? Number((decimalUnits(spent) * 100n) / decimalUnits(amount)) : 0;
  return (
    <div className="flex flex-col gap-3">
      <Progress
        value={Math.min(percent, 100)}
        aria-label="Budget used"
        getAriaValueText={() => `${percent}% used${overspent ? ", over budget" : ""}`}
      />
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <span>{moneyLabel(spent, currency)} spent</span>
        <span className={overspent ? "text-destructive" : "text-muted-foreground"}>
          {overspent
            ? `Over by ${moneyLabel(sumMoney([spent, negateMoney(amount)]), currency)}`
            : `${moneyLabel(sumMoney([amount, negateMoney(spent)]), currency)} remaining`}{" "}
          · {percent}% used
        </span>
      </div>
    </div>
  );
}
export function Workspace({ section, spaceId }: { section: string; spaceId?: string }) {
  const session = useQuery(sessionOptions);
  const finance = useQuery(financeOptions);
  if (finance.isPending)
    return (
      <main className="workspace">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-32" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Loading financial records…</p>
      </main>
    );
  if (finance.isError)
    return (
      <main className="workspace">
        <Alert variant="destructive">
          <AlertDescription>{finance.error.message}</AlertDescription>
        </Alert>
        <Button onClick={() => void finance.refetch()}>Retry</Button>
      </main>
    );
  const user = session.data?.user;
  if (!user) return null;
  return (
    <WorkspaceContent
      key={`${user.id}-${section}-${spaceId ?? ""}`}
      section={section}
      spaceId={spaceId}
      user={user}
      data={finance.data}
    />
  );
}
function WorkspaceContent({
  section,
  spaceId,
  user,
  data,
}: {
  section: string;
  spaceId?: string;
  user: User;
  data: FinanceData;
}) {
  const write = useWrite();
  const exporter = useExport();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [remove, setRemove] = useState<{
    path: string;
    title: string;
    description?: string;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: () => dirty || preferencesDirty || saving || preferencesSaving,
    enableBeforeUnload: dirty || preferencesDirty || saving || preferencesSaving,
    withResolver: true,
  });
  const [discard, setDiscard] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const today = accountToday(user.timezone);
  const search = useSearch({ from: "/app" });
  const navigate = useNavigate({ from: "/app" });
  const month = search.month ?? today.slice(0, 7);
  const filters: Filters = { ...search, ...(spaceId ? { spaceId } : {}) };
  function updateView(next: typeof search) {
    if (spaceId)
      void navigate({
        to: "/app/spaces/$spaceId",
        params: { spaceId },
        search: next,
        replace: true,
      });
    else void navigate({ to: "/app/$section", params: { section }, search: next, replace: true });
  }
  const setMonth = (month: string) => updateView({ ...search, month });
  const setFilter = (
    key: "search" | "from" | "to" | "walletId" | "categoryId" | "spaceId" | "kind",
    value: string,
  ) => {
    const next = {
      ...search,
      [key]: value || undefined,
      search: key === "search" ? value : search.search,
    };
    if (key === "kind") next.kind = value === "income" || value === "expense" ? value : undefined;
    updateView(next);
  };
  const clearFilters = () => updateView({ search: "", month: search.month });
  function closeEditor() {
    if (saving) return;
    if (dirty) setDiscard(true);
    else setEditor(null);
  }
  const walletOptions = optionsFor(data.wallets.filter((w) => !w.archived));
  const spaceOptions = optionsFor(data.spaces);
  const expenseOptions = optionsFor(
    data.categories.filter((c) => c.kind === "expense" && !c.archived),
  );
  const lastSelection = z
    .object({ walletId: z.string(), categoryId: z.string(), kind: z.enum(["income", "expense"]) })
    .safeParse(
      (() => {
        try {
          return JSON.parse(sessionStorage.getItem(`entry-${user.id}`) ?? "null");
        } catch {
          return null;
        }
      })(),
    );
  const rememberedWallet =
    lastSelection.success && walletOptions.some((w) => w.value === lastSelection.data.walletId)
      ? lastSelection.data.walletId
      : "";
  const defaultWallet =
    (filters.walletId && walletOptions.some((w) => w.value === filters.walletId)
      ? filters.walletId
      : rememberedWallet) ||
    walletOptions[0]?.value ||
    "";
  function referenceOptions<T extends { id: string; name: string; archived: boolean }>(
    rows: T[],
    selected?: string,
  ) {
    return rows
      .filter((r) => !r.archived || r.id === selected)
      .map((r) => ({ value: r.id, label: `${r.name}${r.archived ? " (archived)" : ""}` }));
  }
  function walletCurrency(values: Record<string, string>) {
    return data.wallets.find((w) => w.id === values.walletId)?.currency ?? user.reportingCurrency;
  }
  function rateFor(walletId: string) {
    const w = data.wallets.find((w) => w.id === walletId);
    if (w?.currency === user.reportingCurrency) return "1";
    const recent = filterTransactions(data, { search: "", walletId })[0];
    return recent ? editableDecimal(recent.exchangeRate) : "";
  }
  function conversionPreview(values: Record<string, string>) {
    const currency = walletCurrency(values);
    if (currency === user.reportingCurrency) return null;
    const valid =
      decimalSchema.safeParse(values.amount).success &&
      decimalSchema.safeParse(values.exchangeRate).success;
    return (
      <Alert>
        <AlertDescription>
          {valid
            ? `Reporting amount: ${moneyLabel(convertMoney(values.amount ?? "0", values.exchangeRate ?? "1", user.reportingCurrency), user.reportingCurrency)}`
            : `Enter a rate: 1 ${currency} = … ${user.reportingCurrency}.`}
        </AlertDescription>
      </Alert>
    );
  }
  function paymentBlocked(payment: ReturnType<typeof pendingPayments>[number]) {
    return (
      data.wallets.find((w) => w.id === payment.recurring.walletId)?.archived ||
      data.categories.find((c) => c.id === payment.recurring.categoryId)?.archived
    );
  }
  const defaultSpace = spaceId ?? filters.spaceId ?? data.spaces.find((s) => s.isDefault)?.id ?? "";
  const rateField = f(
    "exchangeRate",
    `Exchange rate to ${user.reportingCurrency}`,
    undefined,
    "text",
    `1 unit of the wallet currency = this many ${user.reportingCurrency}. Use 1 for ${user.reportingCurrency} wallets.`,
  );
  function openWallet() {
    setEditor({
      title: "Add wallet",
      description: "Enter its current balance as your starting point.",
      spec: {
        fields: [
          f("name", "Wallet name"),
          f("kind", "Type", [
            { value: "bank", label: "Bank account" },
            { value: "cash", label: "Cash" },
            { value: "ewallet", label: "E-wallet" },
          ]),
          f("currency", "Currency", choices(currencies)),
          f("openingBalance", "Opening balance"),
          rateField,
        ],
        defaults: {
          name: "",
          kind: "bank",
          currency: user.reportingCurrency,
          openingBalance: "0",
          exchangeRate: "1",
        },
        fieldsFor: (v) => [
          f("name", "Wallet name"),
          f("kind", "Type", [
            { value: "bank", label: "Bank account" },
            { value: "cash", label: "Cash" },
            { value: "ewallet", label: "E-wallet" },
          ]),
          f("currency", "Currency", choices(currencies)),
          f("openingBalance", `Opening balance (${v.currency})`),
          ...(v.currency !== user.reportingCurrency
            ? [{ ...rateField, help: `1 ${v.currency} = this many ${user.reportingCurrency}.` }]
            : []),
        ],
        changes: (name, value): Record<string, string> =>
          name === "currency" ? { exchangeRate: value === user.reportingCurrency ? "1" : "" } : {},
        schema: walletInput,
        submit: "Create wallet",
        payload: (v) => ({
          ...v,
          exchangeRate: v.currency === user.reportingCurrency ? "1" : (v.exchangeRate ?? ""),
        }),
        path: "/api/finance/wallets",
      },
    });
  }
  function openTransaction(kind: "income" | "expense", row?: Transaction) {
    const categories = referenceOptions(
      data.categories.filter((c) => c.kind === kind),
      row?.categoryId,
    );
    setEditor({
      title: row ? "Edit transaction" : kind === "income" ? "Record income" : "Record expense",
      spec: {
        fields: [
          f("amount", "Amount"),
          f("walletId", "Wallet", walletOptions),
          f("categoryId", "Category", categories),
          f("spaceId", "Space", spaceOptions),
          f("date", "Date", undefined, "date"),
          rateField,
          ...(kind === "expense"
            ? [
                f(
                  "preparation",
                  "Preparation spending",
                  booleanChoices,
                  undefined,
                  "Include this expense in the Space’s preparation costs.",
                ),
              ]
            : []),
          f("notes", "Notes"),
        ],
        defaults: {
          kind,
          amount: row ? editableDecimal(row.amount) : "",
          walletId: row?.walletId ?? defaultWallet,
          categoryId:
            row?.categoryId ??
            (lastSelection.success &&
            lastSelection.data.kind === kind &&
            categories.some((c) => c.value === lastSelection.data.categoryId)
              ? lastSelection.data.categoryId
              : categories[0]?.value) ??
            "",
          spaceId: row?.spaceId ?? defaultSpace,
          date: row?.date ?? today,
          exchangeRate: row ? editableDecimal(row.exchangeRate) : rateFor(defaultWallet),
          preparation: String(row?.preparation ?? false),
          notes: row?.notes ?? "",
        },
        fieldsFor: (v) => [
          f("amount", `Amount (${walletCurrency(v)})`),
          f("walletId", "Wallet", referenceOptions(data.wallets, row?.walletId)),
          f("categoryId", "Category", categories),
          f("date", "Date", undefined, "date"),
          ...(walletCurrency(v) !== user.reportingCurrency
            ? [
                {
                  ...rateField,
                  help: `1 ${walletCurrency(v)} = this many ${user.reportingCurrency}. Confirm the rate for this entry.`,
                },
              ]
            : []),
          { ...f("spaceId", "Space", spaceOptions), optional: !spaceId },
          ...(kind === "expense" && !data.spaces.find((s) => s.id === v.spaceId)?.isDefault
            ? [
                {
                  ...f(
                    "preparation",
                    "Preparation spending",
                    booleanChoices,
                    undefined,
                    "Costs incurred to prepare for this trip or project.",
                  ),
                  optional: true,
                },
              ]
            : []),
          { ...f("notes", "Notes (optional)"), optional: true },
        ],
        changes: (name, value): Record<string, string> =>
          name === "walletId" ? { exchangeRate: rateFor(value) } : {},
        preview: conversionPreview,
        schema: transactionInput,
        submit: row ? "Save transaction" : `Record ${kind}`,
        payload: (v) => ({
          ...v,
          exchangeRate: walletCurrency(v) === user.reportingCurrency ? "1" : (v.exchangeRate ?? ""),
          preparation:
            !data.spaces.find((s) => s.id === v.spaceId)?.isDefault && v.preparation === "true",
        }),
        path: `/api/finance/transactions${row ? `/${row.id}` : ""}`,
        method: row ? "PATCH" : "POST",
      },
    });
  }
  const previousMonth = format(subMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
  const budgetsToCopy = data.budgets.filter(
    (b) =>
      b.month === previousMonth &&
      !data.budgets.some(
        (current) => current.month === month && current.categoryId === b.categoryId,
      ) &&
      expenseOptions.some((c) => c.value === b.categoryId),
  );
  async function copyBudgets() {
    let copied = 0;
    try {
      for (const b of budgetsToCopy) {
        await write.mutateAsync({
          path: "/api/finance/budgets",
          payload: { categoryId: b.categoryId, month, amount: editableDecimal(b.amount) },
        });
        copied++;
      }
      setNotice(
        `Copied ${copied} category limits from ${format(parseISO(`${previousMonth}-01`), "MMMM yyyy")}. Existing limits were kept.`,
      );
    } catch {
      setNotice(`Copied ${copied} limits. Remaining limits were not copied; retry to finish.`);
    }
  }
  function renameCategory(category: FinanceData["categories"][number]) {
    setEditor({
      title: `Rename ${category.name}`,
      spec: {
        fields: [f("name", "Name")],
        defaults: { name: category.name },
        schema: z.object({ name: categoryInput.shape.name, archived: z.boolean() }),
        payload: (v) => ({ name: v.name ?? "", archived: category.archived }),
        path: `/api/finance/categories/${category.id}`,
        method: "PATCH",
        submit: "Rename category",
      },
    });
  }
  function archiveReference(
    kind: "wallets" | "categories",
    row: { id: string; name: string; archived: boolean },
  ) {
    const dependencies = data.recurring.filter(
      (r) => !r.paused && (kind === "wallets" ? r.walletId === row.id : r.categoryId === row.id),
    );
    setEditor({
      title: `${row.archived ? "Restore" : "Archive"} ${kind === "wallets" ? "wallet" : "category"}`,
      description: row.archived
        ? `Restore ${row.name} for new entries.`
        : `${row.name} will be hidden from new entries. Historical references are kept.${dependencies.length ? ` Pause or reassign ${dependencies.length} active schedule(s) first.` : ""}`,
      spec: {
        fields: [],
        defaults: {},
        schema: z.object({ name: walletInput.shape.name, archived: z.boolean() }),
        payload: () => ({ name: row.name, archived: !row.archived }),
        path: `/api/finance/${kind}/${row.id}`,
        method: "PATCH",
        submit: `${row.archived ? "Restore" : "Archive"} ${row.name}`,
      },
    });
  }
  function transferFields(v: Record<string, string>): FormField[] {
    const from = data.wallets.find((w) => w.id === v.fromWalletId);
    const to = data.wallets.find((w) => w.id === v.toWalletId);
    return [
      f("fromWalletId", "From wallet", walletOptions),
      f("toWalletId", "To wallet", walletOptions),
      f("sentAmount", `Amount sent (${from?.currency ?? user.reportingCurrency})`),
      ...(from?.currency !== to?.currency
        ? [f("receivedAmount", `Amount received (${to?.currency ?? user.reportingCurrency})`)]
        : []),
      f("date", "Date", undefined, "date"),
      { ...f("notes", "Notes (optional)"), optional: true },
    ];
  }
  function receivedAmount(v: Record<string, string>) {
    const from = data.wallets.find((w) => w.id === v.fromWalletId);
    const to = data.wallets.find((w) => w.id === v.toWalletId);
    return from?.currency === to?.currency ? (v.sentAmount ?? "") : (v.receivedAmount ?? "");
  }
  function correction(v: Record<string, string>) {
    if (v.mode === "delta") return v.amount ?? "";
    if (!adjustmentInput.shape.amount.safeParse(v.actualBalance).success)
      return v.actualBalance ?? "";
    return sumMoney([v.actualBalance ?? "0", negateMoney(walletBalance(data, v.walletId ?? ""))]);
  }
  function openBudget() {
    setEditor({
      title: "Set monthly category budget",
      spec: {
        fields: [
          f("categoryId", "Category", expenseOptions),
          f("month", "Month", undefined, "month"),
          f("amount", `Limit (${user.reportingCurrency})`),
        ],
        defaults: { categoryId: expenseOptions[0]?.value ?? "", month, amount: "" },
        schema: budgetInput,
        payload: (v) => v,
        path: "/api/finance/budgets",
        submit: "Set budget",
      },
    });
  }
  function openSpace(row?: FinanceData["spaces"][number]) {
    setEditor({
      title: row ? "Edit Space" : "Create Space",
      description: "Group income and expenses while using your existing wallets.",
      spec: {
        fields: [
          f("name", "Name"),
          f("description", "Description"),
          f("startDate", "Start date (optional)", undefined, "date"),
          f("endDate", "End date (optional)", undefined, "date"),
          f("budget", `Total spending budget (${user.reportingCurrency}, optional)`),
          f("status", "Status", choices(["active", "completed"])),
        ],
        defaults: {
          name: row?.name ?? "",
          description: row?.description ?? "",
          startDate: row?.startDate ?? "",
          endDate: row?.endDate ?? "",
          budget: row?.budget ? editableDecimal(row.budget) : "",
          status: row?.status ?? "active",
        },
        submit: row ? "Save Space" : "Create Space",
        schema: spaceInput,
        payload: (v) => ({
          ...v,
          startDate: v.startDate || null,
          endDate: v.endDate || null,
          budget: v.budget || null,
        }),
        path: `/api/finance/spaces${row ? `/${row.id}` : ""}`,
        method: row ? "PATCH" : "POST",
      },
    });
  }
  function openRecurring(row?: FinanceData["recurring"][number]) {
    setEditor({
      title: row ? "Edit recurring payment" : "Add recurring payment",
      description: "You’ll confirm each payment before it affects your balance.",
      spec: {
        fields: [
          f("name", "Name"),
          f("amount", "Expected amount (wallet currency)"),
          f("walletId", "Wallet", walletOptions),
          f("categoryId", "Category", expenseOptions),
          f("spaceId", "Space", spaceOptions),
          {
            ...f(
              "startDate",
              "First due date",
              undefined,
              "date",
              row
                ? "The monthly anchor is fixed. Pause and create a new schedule to change it."
                : "Repeats monthly on this day; short months use their last day.",
            ),
            disabled: Boolean(row),
          },
          f("endDate", "Last due date (optional)", undefined, "date"),
        ],
        defaults: {
          name: row?.name ?? "",
          amount: row ? editableDecimal(row.amount) : "",
          walletId: row?.walletId ?? defaultWallet,
          categoryId: row?.categoryId ?? expenseOptions[0]?.value ?? "",
          spaceId: row?.spaceId ?? defaultSpace,
          startDate: row?.startDate ?? today,
          endDate: row?.endDate ?? "",
          paused: String(row?.paused ?? false),
        },
        fieldsFor: (v) => [
          f("name", "Name"),
          f("amount", `Expected amount (${walletCurrency(v)})`),
          f("walletId", "Wallet", referenceOptions(data.wallets, row?.walletId)),
          f(
            "categoryId",
            "Category",
            referenceOptions(
              data.categories.filter((c) => c.kind === "expense"),
              row?.categoryId,
            ),
          ),
          f("spaceId", "Space", spaceOptions),
          {
            ...f(
              "startDate",
              "First due date",
              undefined,
              "date",
              row
                ? "Monthly anchor is fixed. Pause and create a new schedule to change it."
                : "Repeats monthly; short months use their last day.",
            ),
            disabled: Boolean(row),
          },
          f("endDate", "Last due date (optional)", undefined, "date"),
        ],
        submit: row ? "Save schedule" : "Create schedule",
        schema: recurringInput,
        payload: (v) => ({ ...v, endDate: v.endDate || null, paused: v.paused === "true" }),
        path: `/api/finance/recurring${row ? `/${row.id}` : ""}`,
        method: row ? "PATCH" : "POST",
      },
    });
  }
  function confirmPayment(payment: ReturnType<typeof pendingPayments>[number]) {
    setEditor({
      title: `Confirm ${payment.recurring.name}`,
      description: `Scheduled for ${formatDate(payment.dueDate)}. Enter what you actually paid.`,
      spec: {
        fields: [
          f("amount", "Actual amount"),
          f("date", "Payment date", undefined, "date"),
          rateField,
        ],
        defaults: {
          amount: editableDecimal(payment.recurring.amount),
          date: today,
          exchangeRate: rateFor(payment.recurring.walletId),
          walletId: payment.recurring.walletId,
        },
        fieldsFor: (v) => [
          f("amount", `Actual amount (${walletCurrency(v)})`),
          f("date", "Payment date", undefined, "date"),
          ...(walletCurrency(v) !== user.reportingCurrency ? [rateField] : []),
        ],
        preview: conversionPreview,
        submit: "Confirm payment",
        schema: confirmationInput,
        payload: (v) => ({
          ...v,
          exchangeRate: walletCurrency(v) === user.reportingCurrency ? "1" : (v.exchangeRate ?? ""),
          dueDate: payment.dueDate,
          status: "paid",
        }),
        path: `/api/finance/recurring/${payment.recurring.id}/confirm`,
      },
    });
  }
  const space = data.spaces.find((s) => s.id === spaceId);
  const summary = financialSummary(data, spaceId);
  const payments = pendingPayments(data, today);
  const monthlyData = {
    ...data,
    transactions: data.transactions.filter((t) => t.date.startsWith(month)),
  };
  const monthlySummary = financialSummary(monthlyData);
  const money = (value: string) => moneyLabel(value, user.reportingCurrency);
  const titles: Record<string, string> = {
    dashboard: "Overview",
    transactions: "Transactions",
    wallets: "Wallets",
    recurring: "Recurring payments",
    budgets: "Budgets",
    spaces: "Spaces",
    "space-detail": space?.name ?? "Space not found",
    settings: "Settings",
  };
  const descriptions: Record<string, string> = {
    dashboard: "A clear view of where your money goes.",
    transactions: "Every income and expense, recorded once.",
    wallets: "Your money across banks, cash, and e-wallets.",
    recurring: "Stay ahead of your monthly commitments.",
    budgets: "Give your spending a little direction.",
    spaces: "Separate views for everyday life, trips, and projects.",
    "space-detail": space?.description || "Income and expenses for this Space only.",
    settings: "Make Financial OS yours.",
  };
  const pageTitle = titles[section] ?? "Page not found";
  useEffect(() => {
    document.title = `${pageTitle} · Financial OS`;
  }, [pageTitle]);
  const incomeButtons = (
    <>
      <Button
        variant="outline"
        disabled={!walletOptions.length}
        onClick={() => openTransaction("income")}
      >
        <ArrowDownLeft data-icon="inline-start" />
        Income
      </Button>
      <Button disabled={!walletOptions.length} onClick={() => openTransaction("expense")}>
        <Plus data-icon="inline-start" />
        Expense
      </Button>
    </>
  );
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const filteredRows = rangeInvalid ? [] : filterTransactions(data, filters);
  const activeFilters = [
    ...(filters.kind
      ? [{ key: "kind" as const, label: filters.kind === "income" ? "Income" : "Expenses" }]
      : []),
    ...(filters.from ? [{ key: "from" as const, label: `From ${formatDate(filters.from)}` }] : []),
    ...(filters.to ? [{ key: "to" as const, label: `To ${formatDate(filters.to)}` }] : []),
    ...(filters.walletId
      ? [
          {
            key: "walletId" as const,
            label: data.wallets.find((w) => w.id === filters.walletId)?.name ?? "Wallet",
          },
        ]
      : []),
    ...(filters.categoryId
      ? [
          {
            key: "categoryId" as const,
            label: data.categories.find((c) => c.id === filters.categoryId)?.name ?? "Category",
          },
        ]
      : []),
    ...(!spaceId && filters.spaceId
      ? [
          {
            key: "spaceId" as const,
            label: data.spaces.find((s) => s.id === filters.spaceId)?.name ?? "Space",
          },
        ]
      : []),
  ];
  function secondaryFilters(prefix: string) {
    return (
      <FieldGroup className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Field>
          <FieldLabel htmlFor={`${prefix}-from`}>From</FieldLabel>
          <Input
            id={`${prefix}-from`}
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-to`}>To</FieldLabel>
          <Input
            id={`${prefix}-to`}
            type="date"
            value={filters.to ?? ""}
            aria-invalid={rangeInvalid}
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Pick
            label="Type"
            value={filters.kind ?? "all"}
            options={[
              { value: "all", label: "All types" },
              { value: "income", label: "Income" },
              { value: "expense", label: "Expenses" },
            ]}
            onChange={(v) => setFilter("kind", v === "all" ? "" : v)}
          />
        </Field>
        {[
          { key: "walletId" as const, label: "Wallet", options: optionsFor(data.wallets) },
          { key: "categoryId" as const, label: "Category", options: optionsFor(data.categories) },
          ...(!spaceId ? [{ key: "spaceId" as const, label: "Space", options: spaceOptions }] : []),
        ].map((filter) => (
          <Field key={filter.key}>
            <FieldLabel>{filter.label}</FieldLabel>
            <Pick
              label={filter.label}
              value={filters[filter.key] ?? "all"}
              options={[
                {
                  value: "all",
                  label:
                    filter.label === "Category"
                      ? "All categories"
                      : `All ${filter.label.toLowerCase()}s`,
                },
                ...filter.options,
              ]}
              onChange={(v) => setFilter(filter.key, v === "all" ? "" : v)}
            />
          </Field>
        ))}
      </FieldGroup>
    );
  }
  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-40 flex-1">
          <FieldLabel htmlFor="filter-search">Search</FieldLabel>
          <Input
            id="filter-search"
            value={filters.search}
            placeholder="Notes, category, wallet…"
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </Field>
        <Button variant="outline" className="md:hidden" onClick={() => setFiltersOpen(true)}>
          Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}
        </Button>
        <Button
          variant="outline"
          disabled={exporter.isPending || rangeInvalid}
          onClick={() => exporter.mutate(filters)}
        >
          <Download data-icon="inline-start" />
          {exporter.isPending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      <div className="hidden md:block">{secondaryFilters("desktop")}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} {filteredRows.length === 1 ? "transaction" : "transactions"}
        </span>
        {activeFilters.map((filter) => (
          <Badge key={filter.key} variant="outline">
            {filter.label}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${filter.label} filter`}
              onClick={() => setFilter(filter.key, "")}
            >
              ×
            </Button>
          </Badge>
        ))}
        {(activeFilters.length > 0 || filters.search) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      {rangeInvalid && (
        <Alert variant="destructive">
          <AlertDescription>Choose an end date on or after the start date.</AlertDescription>
        </Alert>
      )}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transaction filters</SheetTitle>
            <SheetDescription>Refine this list and its CSV export.</SheetDescription>
          </SheetHeader>
          <div className="px-4">{secondaryFilters("mobile")}</div>
          <SheetFooter>
            <Button onClick={() => setFiltersOpen(false)}>
              Show {filteredRows.length} transactions
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
  function transactionActions(row: Transaction) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${row.notes || "transaction"}`}
          onClick={() => openTransaction(row.kind, row)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${row.notes || "transaction"}`}
          onClick={() =>
            setRemove({
              title: `Delete “${row.notes || "transaction"}”?`,
              description:
                "This permanently removes the transaction and recalculates reports. A linked recurring occurrence becomes due again.",
              path: `/api/finance/transactions/${row.id}`,
            })
          }
        >
          <Trash2 />
        </Button>
      </div>
    );
  }
  function transactionTable(rows: Transaction[]): ReactNode {
    return rows.length ? (
      <>
        <ItemGroup className="md:hidden">
          {rows.map((row) => {
            const wallet = data.wallets.find((w) => w.id === row.walletId);
            const category = data.categories.find((c) => c.id === row.categoryId);
            return (
              <Item
                key={row.id}
                role="listitem"
                variant="outline"
                className="flex-col flex-nowrap items-stretch"
              >
                <ItemHeader className="w-full basis-auto items-start">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="line-clamp-none whitespace-normal break-words">
                      {row.notes || category?.name}
                    </ItemTitle>
                    <ItemDescription>
                      {category?.name}
                      {row.preparation ? " · Preparation" : ""}
                    </ItemDescription>
                  </ItemContent>
                  <div className="ledger-amount">
                    <p>
                      {row.kind === "income" ? "+" : "−"}
                      {wallet ? moneyLabel(row.amount, wallet.currency) : row.amount}
                    </p>
                    {wallet?.currency !== user.reportingCurrency && (
                      <p className="ledger-meta">{money(row.reportingAmount)}</p>
                    )}
                  </div>
                </ItemHeader>
                <ItemFooter className="w-full basis-auto">
                  <p className="ledger-meta min-w-0 break-words">
                    {formatDate(row.date)}
                    <br />
                    {wallet?.name} · {data.spaces.find((s) => s.id === row.spaceId)?.name}
                  </p>
                  {transactionActions(row)}
                </ItemFooter>
              </Item>
            );
          })}
        </ItemGroup>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {["Date", "Description", "Wallet", "Space", "Amount", ""].map((name, i) => (
                  <TableHead key={i}>{name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const selectedWallet = data.wallets.find((w) => w.id === row.walletId);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {row.notes || data.categories.find((c) => c.id === row.categoryId)?.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {data.categories.find((c) => c.id === row.categoryId)?.name}
                        {row.preparation && <Badge variant="secondary">Preparation</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{selectedWallet?.name}</TableCell>
                    <TableCell>{data.spaces.find((s) => s.id === row.spaceId)?.name}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <span className={row.kind === "income" ? "text-income" : "text-foreground"}>
                        {row.kind === "income" ? "+" : "−"}
                        {selectedWallet
                          ? moneyLabel(row.amount, selectedWallet.currency)
                          : row.amount}
                      </span>
                      {selectedWallet?.currency !== user.reportingCurrency && (
                        <div className="text-xs text-muted-foreground">
                          {money(row.reportingAmount)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit transaction"
                          onClick={() => openTransaction(row.kind, row)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete transaction"
                          onClick={() =>
                            setRemove({
                              title: `Delete “${row.notes || data.categories.find((c) => c.id === row.categoryId)?.name || "transaction"}”?`,
                              description:
                                "This permanently removes the transaction and recalculates balances and reports. A linked recurring payment will become due again.",
                              path: `/api/finance/transactions/${row.id}`,
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    ) : (
      <Nothing
        title={
          data.transactions.some((t) => !spaceId || t.spaceId === spaceId)
            ? "No matching transactions"
            : "No transactions yet"
        }
        description={
          data.transactions.some((t) => !spaceId || t.spaceId === spaceId)
            ? "Try another search or clear your filters."
            : "Record income or an expense to start seeing your finances clearly."
        }
        action={
          data.transactions.some((t) => !spaceId || t.spaceId === spaceId) ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            incomeButtons
          )
        }
      />
    );
  }
  const report = (
    <>
      <p className="text-sm text-muted-foreground">
        Lifetime totals · All dates. Filters below apply to the transaction list and export.
      </p>
      <div
        className={
          space?.isDefault
            ? "grid gap-4 sm:grid-cols-3"
            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        <Metric
          title="Income"
          value={money(summary.income)}
          detail="All income assigned to this Space"
        />
        <Metric
          title={space?.isDefault ? "Expenses" : "Running expenses"}
          value={money(space?.isDefault ? summary.expenses : summary.running)}
          detail={space?.isDefault ? "All expenses in this Space" : "Excluding preparation costs"}
        />
        {!space?.isDefault && (
          <Metric
            title="Preparation spending"
            value={money(summary.preparation)}
            detail="Costs to prepare for this trip or project"
          />
        )}
        <Metric
          title={
            space?.isDefault
              ? "Net cash flow"
              : space?.status === "completed"
                ? "Final result"
                : "Result so far"
          }
          value={money(summary.result)}
          detail="Income minus all expenses"
        />
      </div>
      {!data.transactions.some((t) => t.spaceId === spaceId) && (
        <Nothing
          title="No activity yet"
          description="Record income or expenses to start this Space’s report."
          action={incomeButtons}
        />
      )}
      {!space?.isDefault && decimalUnits(summary.preparation) > 0n && (
        <Card>
          <CardHeader>
            <CardTitle>Preparation cost recovery</CardTitle>
            <CardDescription>
              {summary.recovered
                ? "Income covers running expenses and preparation costs."
                : "Income has not yet covered all costs."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Surplus after running expenses</p>
              <p className="mt-2 font-semibold tabular-nums">{money(summary.surplus)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining to break even</p>
              <p className="mt-2 font-semibold tabular-nums">{money(summary.unrecovered)}</p>
            </div>
          </CardContent>
          <CardFooter>Opening balances and transfers are excluded.</CardFooter>
        </Card>
      )}
      {space?.budget && (
        <BudgetProgress
          spent={summary.expenses}
          amount={space.budget}
          currency={user.reportingCurrency}
        />
      )}
    </>
  );
  return (
    <main className="workspace">
      {spaceId && (
        <Link
          to="/app/$section"
          params={{ section: "spaces" }}
          search={(prev) => prev}
          className="text-sm text-muted-foreground"
        >
          ← Spaces
        </Link>
      )}
      <div className="page-heading">
        <div>
          <div className="eyebrow">{spaceId ? "Space report" : "Financial OS"}</div>
          <h1>{titles[section] ?? "Page not found"}</h1>
          <p>{descriptions[section]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(section === "dashboard" || section === "transactions" || section === "space-detail") &&
            incomeButtons}
          {section === "wallets" && (
            <Button onClick={openWallet}>
              <Plus data-icon="inline-start" />
              Add wallet
            </Button>
          )}
          {section === "spaces" && (
            <Button onClick={() => openSpace()}>
              <Plus data-icon="inline-start" />
              Create Space
            </Button>
          )}
          {section === "space-detail" && space && (
            <Button variant="outline" onClick={() => openSpace(space)}>
              <Pencil data-icon="inline-start" />
              Edit Space
            </Button>
          )}
          {section === "recurring" && (
            <Button disabled={!walletOptions.length} onClick={() => openRecurring()}>
              <Plus data-icon="inline-start" />
              Add payment
            </Button>
          )}
          {section === "budgets" && (
            <Button disabled={!expenseOptions.length} onClick={openBudget}>
              <Plus data-icon="inline-start" />
              Set budget
            </Button>
          )}
        </div>
      </div>
      {write.isError && (
        <Alert variant="destructive">
          <AlertDescription>{write.error.message}</AlertDescription>
        </Alert>
      )}
      {exporter.isError && (
        <Alert variant="destructive">
          <AlertDescription>{exporter.error.message}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {!walletOptions.length && section !== "wallets" && section !== "settings" && (
        <Alert>
          <AlertDescription>
            Add or restore an active wallet to record transactions.
            <Link
              className={buttonVariants({ variant: "link" })}
              to="/app/$section"
              params={{ section: "wallets" }}
              search={(prev) => prev}
            >
              Manage wallets
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {section === "dashboard" && (
        <>
          {!data.transactions.length && (
            <Card>
              <CardHeader>
                <CardTitle>Start with your next transaction</CardTitle>
                <CardDescription>
                  Build a clear view of your finances in a few steps.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p>{data.wallets.length ? "✓ Wallet added" : "1. Add a wallet"}</p>
                <p>2. Record income or an expense</p>
                <p>{data.budgets.length ? "✓ Budget set" : "3. Set a spending budget"}</p>
                <p>
                  {data.recurring.length ? "✓ Recurring payment added" : "4. Add a monthly payment"}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                {walletOptions.length ? (
                  incomeButtons
                ) : (
                  <Button onClick={openWallet}>Add wallet</Button>
                )}
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to="/app/$section"
                  params={{ section: "budgets" }}
                  search={(prev) => prev}
                >
                  Set a budget
                </Link>
              </CardFooter>
            </Card>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline">All Spaces · Monthly view</Badge>
            <Field className="w-44">
              <FieldLabel htmlFor="overview-month" className="sr-only">
                Month
              </FieldLabel>
              <Input
                id="overview-month"
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              title="Income"
              value={money(monthlySummary.income)}
              detail="Across all Spaces this month"
            />
            <Metric
              title="Expenses"
              value={money(monthlySummary.expenses)}
              detail="Including preparation spending"
            />
            <Metric
              title="Net cash flow"
              value={money(monthlySummary.result)}
              detail="Income minus expenses this month"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Your wallets</CardTitle>
                <CardDescription>Current balances · Each wallet’s currency.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {data.wallets
                  .filter((w) => !w.archived)
                  .map((w) => (
                    <div key={w.id} className="flex justify-between gap-3">
                      <span className="text-sm">{w.name}</span>
                      <span className="text-sm font-medium tabular-nums">
                        {moneyLabel(walletBalance(data, w.id), w.currency)}
                      </span>
                    </div>
                  ))}
                {!walletOptions.length && (
                  <Nothing
                    title="A home for your money"
                    description="Add a bank account, e-wallet, or cash wallet."
                  />
                )}
              </CardContent>
              <CardFooter>
                <Link
                  className={buttonVariants({ variant: "link" })}
                  to="/app/$section"
                  params={{ section: "wallets" }}
                  search={(prev) => prev}
                >
                  Manage wallets
                </Link>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Upcoming payments</CardTitle>
                <CardDescription>Confirm payments once they are made.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {payments.slice(0, 5).map((p) => (
                  <div
                    key={`${p.recurring.id}-${p.dueDate}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.recurring.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.dueDate)}
                        {p.overdue ? " · Overdue" : p.dueDate === today ? " · Due today" : ""}
                        {paymentBlocked(p) ? " · Restore archived wallet/category" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={paymentBlocked(p)}
                      onClick={() => confirmPayment(p)}
                    >
                      Confirm
                    </Button>
                  </div>
                ))}
                {!payments.length && (
                  <p className="text-sm text-muted-foreground">
                    {data.recurring.length
                      ? "No active upcoming payments."
                      : "Add a recurring payment to track monthly commitments."}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Link
                  className={buttonVariants({ variant: "link" })}
                  to="/app/$section"
                  params={{ section: "recurring" }}
                  search={(prev) => prev}
                >
                  View recurring payments
                </Link>
              </CardFooter>
            </Card>
          </div>
          {data.transactions.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Monthly cash flow</CardTitle>
                  <CardDescription>
                    Last 12 recorded months · All Spaces · {user.reportingCurrency}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.months.length > 0 && (
                    <ChartContainer
                      className="mb-5 h-52 w-full"
                      config={{
                        income: { label: "Income", color: "var(--income)" },
                        expenses: { label: "Expenses", color: "var(--chart-2)" },
                      }}
                      aria-label={`Monthly income and expenses in ${user.reportingCurrency}; exact values are in the table below.`}
                    >
                      <BarChart
                        accessibilityLayer
                        data={summary.months.slice(-12).map((m) => ({
                          month: format(parseISO(`${m.month}-01`), "MMM yyyy"),
                          income: Number(m.income),
                          expenses: Number(m.expenses),
                        }))}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar
                          dataKey="income"
                          fill="var(--color-income)"
                          radius={3}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="expenses"
                          fill="var(--color-expenses)"
                          radius={3}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ChartContainer>
                  )}
                  {summary.months.length ? (
                    <>
                      <ItemGroup className="md:hidden">
                        {summary.months.slice(-12).map((m) => (
                          <Item key={m.month} variant="outline" size="sm">
                            <ItemContent>
                              <ItemTitle>{format(parseISO(`${m.month}-01`), "MMM yyyy")}</ItemTitle>
                              <ItemDescription>
                                Income {money(m.income)} · Expenses {money(m.expenses)}
                              </ItemDescription>
                              <ItemDescription>
                                Net {money(sumMoney([m.income, negateMoney(m.expenses)]))}
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        ))}
                      </ItemGroup>
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Month</TableHead>
                              <TableHead>Income</TableHead>
                              <TableHead>Expenses</TableHead>
                              <TableHead>Net</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.months.slice(-12).map((m) => (
                              <TableRow key={m.month}>
                                <TableCell>
                                  {format(parseISO(`${m.month}-01`), "MMM yyyy")}
                                </TableCell>
                                <TableCell>{money(m.income)}</TableCell>
                                <TableCell>{money(m.expenses)}</TableCell>
                                <TableCell>
                                  {money(sumMoney([m.income, negateMoney(m.expenses)]))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <Nothing
                      title="Your story starts here"
                      description="Monthly trends appear as you record transactions."
                    />
                  )}
                </CardContent>
                <CardFooter />
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Spending by category</CardTitle>
                  <CardDescription>{format(parseISO(`${month}-01`), "MMMM yyyy")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {monthlySummary.breakdown.map((c) => (
                    <div
                      key={c.categoryId}
                      className="flex flex-wrap justify-between gap-2 text-sm"
                    >
                      <span>{c.name}</span>
                      <span className="tabular-nums">{money(c.amount)}</span>
                      <Progress
                        className="basis-full"
                        value={Number(
                          (decimalUnits(c.amount) * 100n) / decimalUnits(monthlySummary.expenses),
                        )}
                        aria-label={`${c.name} share of spending`}
                      />
                    </div>
                  ))}
                  {!monthlySummary.breakdown.length && (
                    <p className="text-sm text-muted-foreground">No expenses in this month.</p>
                  )}
                </CardContent>
                <CardFooter />
              </Card>
              <section>
                <h2 className="section-title">Latest activity · All dates</h2>
                {transactionTable(filterTransactions(data, { search: "" }).slice(0, 8))}
              </section>
            </>
          )}
        </>
      )}
      {(section === "transactions" || section === "space-detail") && (
        <>
          {section === "space-detail" &&
            (space ? (
              report
            ) : (
              <Nothing
                title="Space not found"
                description="This Space may have been removed."
                icon="space"
              />
            ))}
          {toolbar}
          {transactionTable(filteredRows)}
          {section === "space-detail" && summary.breakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Spending by category</CardTitle>
                <CardDescription>Lifetime expenses · This Space only · All dates.</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.breakdown.map((c) => (
                  <div key={c.categoryId} className="flex justify-between py-2 text-sm">
                    <span>{c.name}</span>
                    <span>{money(c.amount)}</span>
                  </div>
                ))}
              </CardContent>
              <CardFooter />
            </Card>
          )}
        </>
      )}
      {section === "wallets" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={walletOptions.length < 2}
              onClick={() =>
                setEditor({
                  title: "Transfer between wallets",
                  description:
                    "Transfers don’t count as income or expenses. Record any fee as a separate expense.",
                  spec: {
                    fields: [
                      f("fromWalletId", "From wallet", walletOptions),
                      f("toWalletId", "To wallet", walletOptions),
                      f("sentAmount", "Amount sent (source currency)"),
                      f("receivedAmount", "Amount received (destination currency)"),
                      f("date", "Date", undefined, "date"),
                      f("notes", "Notes"),
                    ],
                    defaults: {
                      fromWalletId: defaultWallet,
                      toWalletId: walletOptions.find((w) => w.value !== defaultWallet)?.value ?? "",
                      sentAmount: "",
                      receivedAmount: "",
                      date: today,
                      notes: "",
                    },
                    fieldsFor: transferFields,
                    preview: (v) => {
                      const from = data.wallets.find((w) => w.id === v.fromWalletId);
                      const to = data.wallets.find((w) => w.id === v.toWalletId);
                      if (
                        !from ||
                        !to ||
                        !decimalSchema.safeParse(v.sentAmount).success ||
                        !decimalSchema.safeParse(receivedAmount(v)).success
                      )
                        return null;
                      return (
                        <Alert>
                          <AlertDescription>
                            After transfer: {from.name}{" "}
                            {moneyLabel(
                              sumMoney([
                                walletBalance(data, from.id),
                                negateMoney(v.sentAmount ?? "0"),
                              ]),
                              from.currency,
                            )}
                            ; {to.name}{" "}
                            {moneyLabel(
                              sumMoney([walletBalance(data, to.id), receivedAmount(v)]),
                              to.currency,
                            )}
                            .
                          </AlertDescription>
                        </Alert>
                      );
                    },
                    schema: transferInput,
                    submit: "Record transfer",
                    payload: (v) => ({ ...v, receivedAmount: receivedAmount(v) }),
                    path: "/api/finance/transfers",
                  },
                })
              }
            >
              Transfer money
            </Button>
            <Button
              variant="outline"
              disabled={!walletOptions.length}
              onClick={() =>
                setEditor({
                  title: "Adjust wallet balance",
                  description:
                    "Enter the balance you counted. The correction won’t affect income or expenses.",
                  spec: {
                    fields: [
                      f("walletId", "Wallet", walletOptions),
                      f(
                        "amount",
                        "Balance change (+ or − wallet currency)",
                        undefined,
                        "text",
                        "For example, -10 reduces the balance by 10.",
                      ),
                      f("date", "Date", undefined, "date"),
                      f("notes", "Reason"),
                    ],
                    defaults: {
                      walletId: defaultWallet,
                      mode: "actual",
                      actualBalance: editableDecimal(walletBalance(data, defaultWallet)),
                      amount: "",
                      date: today,
                      notes: "",
                    },
                    fieldsFor: (v) => [
                      f("walletId", "Wallet", walletOptions),
                      f("mode", "Correction method", [
                        { value: "actual", label: "Actual balance" },
                        { value: "delta", label: "Signed change (advanced)" },
                      ]),
                      f(
                        v.mode === "delta" ? "amount" : "actualBalance",
                        `${v.mode === "delta" ? "Signed change" : "Actual balance"} (${walletCurrency(v)})`,
                      ),
                      f("date", "Date", undefined, "date"),
                      f("notes", "Reason"),
                    ],
                    changes: (name, value): Record<string, string> =>
                      name === "walletId"
                        ? { actualBalance: editableDecimal(walletBalance(data, value)) }
                        : {},
                    preview: (v) => (
                      <Alert>
                        <AlertDescription>
                          Current balance:{" "}
                          {moneyLabel(walletBalance(data, v.walletId ?? ""), walletCurrency(v))}.
                          {adjustmentInput.shape.amount.safeParse(correction(v)).success
                            ? ` Correction: ${moneyLabel(correction(v), walletCurrency(v))}.`
                            : " Enter a valid balance."}
                        </AlertDescription>
                      </Alert>
                    ),
                    schema: adjustmentInput,
                    submit: "Record correction",
                    payload: (v) => ({
                      ...v,
                      amount: correction(v),
                      expectedBalance: walletBalance(data, v.walletId ?? ""),
                    }),
                    path: "/api/finance/adjustments",
                  },
                })
              }
            >
              Adjust balance
            </Button>
            {walletOptions.length < 2 && (
              <p className="text-xs text-muted-foreground">
                Add two active wallets to record a transfer.
              </p>
            )}
          </div>
          {data.wallets.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[false, true].map((archived) => (
                <Fragment key={String(archived)}>
                  {data.wallets.some((w) => w.archived === archived) && (
                    <h2 className="section-title col-span-full">
                      {archived ? "Archived wallets" : "Active wallets"}
                    </h2>
                  )}
                  {data.wallets
                    .filter((w) => w.archived === archived)
                    .map((w) => (
                      <Card key={w.id}>
                        <CardHeader>
                          <CardDescription>
                            {w.kind === "ewallet"
                              ? "E-wallet"
                              : w.kind === "bank"
                                ? "Bank account"
                                : "Cash"}{" "}
                            · {w.currency}
                            {w.archived ? " · Archived" : ""}
                          </CardDescription>
                          <CardTitle>{w.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-semibold tabular-nums">
                            {moneyLabel(walletBalance(data, w.id), w.currency)}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Opening balance {moneyLabel(w.openingBalance, w.currency)}
                          </p>
                        </CardContent>
                        <CardFooter className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditor({
                                title: "Edit wallet",
                                spec: {
                                  fields: [f("name", "Name")],
                                  defaults: { name: w.name, archived: String(w.archived) },
                                  schema: z.object({
                                    name: walletInput.shape.name,
                                    archived: z.boolean(),
                                  }),
                                  payload: (v) => ({
                                    name: v.name ?? "",
                                    archived: v.archived === "true",
                                  }),
                                  path: `/api/finance/wallets/${w.id}`,
                                  method: "PATCH",
                                },
                              })
                            }
                          >
                            Rename
                          </Button>
                          <Link
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                            to="/app/$section"
                            params={{ section: "transactions" }}
                            search={{ search: "", walletId: w.id }}
                          >
                            View activity
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveReference("wallets", w)}
                          >
                            {w.archived ? "Restore" : "Archive"}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                </Fragment>
              ))}
            </div>
          ) : (
            <Nothing
              title="Add your first wallet"
              description="Track a bank account, e-wallet, or cash balance."
              action={<Button onClick={openWallet}>Add wallet</Button>}
            />
          )}
          <section>
            <h2 className="section-title">Transfers</h2>
            {data.transfers.length ? (
              <ItemGroup>
                {data.transfers.map((t) => {
                  const from = data.wallets.find((w) => w.id === t.fromWalletId);
                  const to = data.wallets.find((w) => w.id === t.toWalletId);
                  return (
                    <Item key={t.id} role="listitem" variant="outline">
                      <ItemContent className="min-w-0">
                        <ItemTitle className="line-clamp-none break-words">
                          {from?.name} → {to?.name}
                        </ItemTitle>
                        <ItemDescription>
                          {formatDate(t.date)}
                          {t.notes ? ` · ${t.notes}` : ""}
                        </ItemDescription>
                        <p className="text-sm tabular-nums">
                          Sent {from && moneyLabel(t.sentAmount, from.currency)}
                          <br />
                          Received {to && moneyLabel(t.receivedAmount, to.currency)}
                        </p>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${t.notes || "transfer"}`}
                          onClick={() =>
                            setRemove({
                              title: `Delete transfer “${t.notes || `${from?.name} → ${to?.name}`}”?`,
                              description:
                                "This permanently removes the transfer and recalculates both wallet balances. Separate fee expenses are kept.",
                              path: `/api/finance/transfers/${t.id}`,
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            ) : (
              <p className="text-sm text-muted-foreground">No transfers recorded.</p>
            )}
          </section>
          <section>
            <h2 className="section-title">Balance adjustments</h2>
            {data.adjustments.length ? (
              <ItemGroup>
                {data.adjustments.map((a) => {
                  const w = data.wallets.find((w) => w.id === a.walletId);
                  return (
                    <Item key={a.id} role="listitem" variant="outline">
                      <ItemContent className="min-w-0">
                        <ItemTitle className="line-clamp-none break-words">
                          {w?.name} · {w && moneyLabel(a.amount, w.currency)}
                        </ItemTitle>
                        <ItemDescription>
                          {formatDate(a.date)} · {a.notes}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${a.notes}`}
                          onClick={() =>
                            setRemove({
                              title: `Delete correction “${a.notes}”?`,
                              description:
                                "This permanently removes the correction and recalculates this wallet’s balance.",
                              path: `/api/finance/adjustments/${a.id}`,
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            ) : (
              <p className="text-sm text-muted-foreground">No balance adjustments recorded.</p>
            )}
          </section>
        </>
      )}
      {section === "spaces" && (
        <div className="grid gap-4 md:grid-cols-2">
          {["active", "completed"].map((status) => (
            <Fragment key={status}>
              {data.spaces.some((s) => s.status === status) && (
                <h2 className="section-title col-span-full">
                  {status === "active" ? "Active Spaces" : "Completed Spaces"}
                </h2>
              )}
              {data.spaces
                .filter((s) => s.status === status)
                .map((s) => {
                  const totals = financialSummary(data, s.id);
                  return (
                    <Card key={s.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle>
                            <Link to="/app/spaces/$spaceId" params={{ spaceId: s.id }}>
                              {s.name}
                            </Link>
                          </CardTitle>
                          <Badge variant="secondary">
                            {s.isDefault
                              ? "Default"
                              : s.status === "completed"
                                ? "Completed"
                                : "Active"}
                          </Badge>
                        </div>
                        <CardDescription>
                          {s.description ||
                            (s.isDefault
                              ? "Your everyday finances"
                              : "A separate view of your shared ledger")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Income</p>
                            <p className="mt-1 font-medium tabular-nums">{money(totals.income)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Expenses</p>
                            <p className="mt-1 font-medium tabular-nums">
                              {money(totals.expenses)}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>
                            {s.isDefault
                              ? "Net cash flow"
                              : s.status === "completed"
                                ? "Final result"
                                : "Result so far"}
                          </span>
                          <span className="font-medium tabular-nums">{money(totals.result)}</span>
                        </div>
                        {s.budget && (
                          <BudgetProgress
                            spent={totals.expenses}
                            amount={s.budget}
                            currency={user.reportingCurrency}
                          />
                        )}
                        {s.startDate && (
                          <p className="text-xs text-muted-foreground">
                            {formatDate(s.startDate)}
                            {s.endDate ? ` – ${formatDate(s.endDate)}` : ""}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter className="flex flex-wrap gap-2">
                        <Link
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                          to="/app/spaces/$spaceId"
                          params={{ spaceId: s.id }}
                          search={(prev) => prev}
                        >
                          View Space
                          <ArrowUpRight data-icon="inline-end" />
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openSpace(s)}>
                          Edit
                        </Button>
                        {!s.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete Space"
                            onClick={() =>
                              setRemove({
                                title: `Delete “${s.name}”?`,
                                description:
                                  "Spaces with transactions or schedules cannot be deleted. Complete the Space to keep its history. An empty Space is permanently removed.",
                                path: `/api/finance/spaces/${s.id}`,
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
            </Fragment>
          ))}
        </div>
      )}
      {section === "budgets" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline">Monthly category limits · All Spaces</Badge>
            <Field className="w-44">
              <FieldLabel htmlFor="budget-month" className="sr-only">
                Budget month
              </FieldLabel>
              <Input
                id="budget-month"
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Budgeted limits:{" "}
              {money(sumMoney(data.budgets.filter((b) => b.month === month).map((b) => b.amount)))}{" "}
              · Spending in budgeted categories:{" "}
              {money(
                sumMoney(
                  data.budgets
                    .filter((b) => b.month === month)
                    .map((b) => budgetSpent(data, b.categoryId, month)),
                ),
              )}
            </p>
            <Button
              variant="outline"
              disabled={!budgetsToCopy.length || write.isPending}
              onClick={() => void copyBudgets()}
            >
              Copy previous month
            </Button>
          </div>
          {data.budgets.some((b) => b.month === month) ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.budgets
                .filter((b) => b.month === month)
                .map((b) => (
                  <Card key={b.id}>
                    <CardHeader>
                      <CardTitle>
                        {data.categories.find((c) => c.id === b.categoryId)?.name}
                      </CardTitle>
                      <CardDescription>{money(b.amount)} monthly limit</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BudgetProgress
                        spent={budgetSpent(data, b.categoryId, month)}
                        amount={b.amount}
                        currency={user.reportingCurrency}
                      />
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditor({
                            title: "Update category budget",
                            spec: {
                              fields: [f("amount", `Limit (${user.reportingCurrency})`)],
                              defaults: { amount: editableDecimal(b.amount) },
                              schema: budgetInput,
                              payload: (v) => ({ ...v, categoryId: b.categoryId, month: b.month }),
                              path: "/api/finance/budgets",
                            },
                          })
                        }
                      >
                        Edit limit
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete budget"
                        onClick={() =>
                          setRemove({
                            title: `Delete budget for “${data.categories.find((c) => c.id === b.categoryId)?.name}”?`,
                            description:
                              "This removes the spending limit. Existing transactions are kept.",
                            path: `/api/finance/budgets/${b.id}`,
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          ) : (
            <Nothing
              title="A plan for this month"
              description="Use Set budget above to create a spending limit, or copy last month’s limits."
              action={
                <Button variant="outline" onClick={openBudget}>
                  Set budget
                </Button>
              }
            />
          )}
          <h2 className="section-title">Space budgets</h2>
          {!data.spaces.some((s) => s.budget) && (
            <Nothing
              title="No Space budgets yet"
              description="Choose a Space and set its total spending limit."
              icon="space"
              action={
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to="/app/$section"
                  params={{ section: "spaces" }}
                  search={(prev) => prev}
                >
                  Choose a Space
                </Link>
              }
            />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {data.spaces
              .filter((s) => s.budget)
              .map((s) => (
                <Card key={s.id}>
                  <CardHeader>
                    <CardTitle>{s.name}</CardTitle>
                    <CardDescription>Lifetime spending, including preparation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {s.budget && (
                      <BudgetProgress
                        spent={financialSummary(data, s.id).expenses}
                        amount={s.budget}
                        currency={user.reportingCurrency}
                      />
                    )}
                  </CardContent>
                  <CardFooter>
                    <Link
                      className={buttonVariants({ variant: "link" })}
                      to="/app/spaces/$spaceId"
                      params={{ spaceId: s.id }}
                      search={(prev) => prev}
                    >
                      View Space
                    </Link>
                  </CardFooter>
                </Card>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Set a total Space budget when creating or editing a Space.
          </p>
        </>
      )}
      {section === "recurring" && (
        <>
          <section>
            <h2 className="section-title">Upcoming and overdue</h2>
            {payments.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {payments.map((p) => {
                  const w = data.wallets.find((w) => w.id === p.recurring.walletId);
                  const blocked = paymentBlocked(p);
                  return (
                    <Card key={`${p.recurring.id}-${p.dueDate}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle>{p.recurring.name}</CardTitle>
                          <Badge variant={p.overdue ? "destructive" : "secondary"}>
                            {p.overdue ? "Overdue" : p.dueDate === today ? "Due today" : "Upcoming"}
                          </Badge>
                        </div>
                        <CardDescription>
                          {formatDate(p.dueDate)} · {w?.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium tabular-nums">
                          {w && moneyLabel(p.recurring.amount, w.currency)}
                        </p>
                        {blocked && (
                          <p className="mt-2 text-sm text-destructive">
                            Wallet or category is archived. Restore it in Wallets/Settings, or
                            reassign this schedule.
                          </p>
                        )}
                      </CardContent>
                      <CardFooter className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={write.isPending || blocked}
                          onClick={() => confirmPayment(p)}
                        >
                          Confirm payment
                        </Button>
                        {blocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRecurring(p.recurring)}
                          >
                            Reassign schedule
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={write.isPending}
                          onClick={() =>
                            void write
                              .mutateAsync({
                                path: `/api/finance/recurring/${p.recurring.id}/confirm`,
                                payload: {
                                  dueDate: p.dueDate,
                                  status: "skipped",
                                  amount: p.recurring.amount,
                                  exchangeRate: "1",
                                  date: today,
                                },
                              })
                              .then((result) => setNotice(result.message))
                              .catch(() => {})
                          }
                        >
                          Skip
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Nothing
                title={
                  data.recurring.length
                    ? "No active upcoming payments"
                    : "No recurring payments yet"
                }
                description={
                  data.recurring.length
                    ? "Paused and completed schedules remain below. Resume a schedule to see its outstanding payments."
                    : "Add a monthly commitment, then confirm each payment after paying."
                }
                action={
                  !data.recurring.length && (
                    <Button disabled={!walletOptions.length} onClick={() => openRecurring()}>
                      Add payment
                    </Button>
                  )
                }
              />
            )}
          </section>
          <section>
            <h2 className="section-title">Schedules</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data.recurring.map((r) => {
                const next = payments.find((p) => p.recurring.id === r.id);
                const w = data.wallets.find((w) => w.id === r.walletId);
                return (
                  <Card key={r.id}>
                    <CardHeader>
                      <CardTitle>{r.name}</CardTitle>
                      <CardDescription>
                        Monthly from {formatDate(r.startDate)}
                        {r.endDate ? ` through ${formatDate(r.endDate)}` : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <Badge variant="secondary">
                        {r.paused
                          ? "Paused"
                          : r.endDate && r.endDate < today
                            ? "Completed"
                            : "Active"}
                      </Badge>
                      <p className="text-sm">
                        {w && moneyLabel(r.amount, w.currency)} · {w?.name}
                        {w?.archived ? " (archived)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.spaces.find((s) => s.id === r.spaceId)?.name}
                        {next ? ` · Next due ${formatDate(next.dueDate)}` : ""}
                      </p>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openRecurring(r)}>
                        Edit schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={write.isPending}
                        onClick={() =>
                          void write
                            .mutateAsync({
                              path: `/api/finance/recurring/${r.id}`,
                              method: "PATCH",
                              payload: { ...r, paused: !r.paused },
                            })
                            .then((result) => setNotice(result.message))
                            .catch(() => {})
                        }
                      >
                        {r.paused ? "Resume" : "Pause"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
            {!data.recurring.length && (
              <p className="text-sm text-muted-foreground">No schedules yet.</p>
            )}
          </section>
          <section>
            <h2 className="section-title">Payment history</h2>
            {data.occurrences.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {data.occurrences.map((o) => {
                  const r = data.recurring.find((r) => r.id === o.recurringId);
                  const transaction = data.transactions.find((t) => t.id === o.transactionId);
                  const w = data.wallets.find((w) => w.id === transaction?.walletId);
                  return (
                    <Card key={o.id}>
                      <CardHeader>
                        <CardTitle>{r?.name}</CardTitle>
                        <CardDescription>
                          Due {formatDate(o.dueDate)} · {o.status === "paid" ? "Paid" : "Skipped"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {transaction ? (
                          <p className="text-sm">
                            {w && moneyLabel(transaction.amount, w.currency)} · Paid{" "}
                            {formatDate(transaction.date)}
                            {w?.currency !== user.reportingCurrency
                              ? ` · ${money(transaction.reportingAmount)}`
                              : ""}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No expense recorded.</p>
                        )}
                      </CardContent>
                      <CardFooter>
                        {transaction ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTransaction(transaction.kind, transaction)}
                          >
                            Edit recorded expense
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={write.isPending}
                            onClick={() =>
                              void write
                                .mutateAsync({
                                  path: `/api/finance/occurrences/${o.id}`,
                                  method: "DELETE",
                                })
                                .then((result) => setNotice(result.message))
                                .catch(() => {})
                            }
                          >
                            Undo skip
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Confirmed and skipped payments appear here.
              </p>
            )}
          </section>
        </>
      )}
      {section === "settings" && (
        <div className="grid items-start gap-7 xl:grid-cols-2">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Account preferences</CardTitle>
              <CardDescription>
                Your email is verified. Reporting currency is fixed once financial records exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinanceForm
                key={`${user.name}-${user.reportingCurrency}-${user.timezone}`}
                onDirtyChange={setPreferencesDirty}
                onPendingChange={setPreferencesSaving}
                onSaved={(message) => {
                  setPreferencesDirty(false);
                  setNotice(message);
                }}
                spec={{
                  fields: [
                    f("name", "Name"),
                    {
                      ...f("reportingCurrency", "Reporting currency", choices(currencies)),
                      help: "Used for totals and budgets. Fixed after wallets or budgets exist.",
                      disabled: Boolean(
                        data.wallets.length ||
                        data.budgets.length ||
                        data.spaces.some((s) => s.budget),
                      ),
                    },
                    f("timezone", "Timezone", timezoneChoices),
                  ],
                  defaults: {
                    name: user.name,
                    reportingCurrency: user.reportingCurrency,
                    timezone: user.timezone,
                  },
                  schema: settingsSchema,
                  payload: (v) => v,
                  path: "/api/finance/settings",
                  method: "PATCH",
                }}
              />
            </CardContent>
            <CardFooter>
              <span className="text-xs text-muted-foreground">
                {user.username} · {user.email}
              </span>
            </CardFooter>
          </Card>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Categories</h2>
              <Button
                variant="outline"
                onClick={() =>
                  setEditor({
                    title: "Add category",
                    spec: {
                      fields: [
                        f("name", "Category name"),
                        f("kind", "Type", choices(["income", "expense"])),
                      ],
                      defaults: { name: "", kind: "expense" },
                      schema: categoryInput,
                      payload: (v) => v,
                      path: "/api/finance/categories",
                    },
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Add category
              </Button>
            </div>
            <ItemGroup>
              {data.categories.map((c) => (
                <Item key={c.id} role="listitem" variant="outline">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="line-clamp-none break-words">{c.name}</ItemTitle>
                    <ItemDescription>
                      {c.kind === "income" ? "Income" : "Expense"} ·{" "}
                      {c.archived ? "Archived" : "Active"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemFooter>
                    <Button size="sm" variant="ghost" onClick={() => renameCategory(c)}>
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => archiveReference("categories", c)}
                    >
                      {c.archived ? "Restore" : "Archive"}
                    </Button>
                  </ItemFooter>
                </Item>
              ))}
            </ItemGroup>
          </section>
        </div>
      )}
      {!titles[section] && (
        <Nothing title="Page not found" description="Choose a page from the sidebar." />
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent layout="form" className="editor-dialog" showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>{editor?.title}</DialogTitle>
            <DialogDescription>
              {editor?.description ?? "Changes update your financial records and reports."}
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <FinanceForm
              key={editor.spec.path}
              spec={{ ...editor.spec, submit: editor.spec.submit ?? editor.title }}
              onCancel={closeEditor}
              onDirtyChange={setDirty}
              onPendingChange={setSaving}
              onSaved={(message, values) => {
                setNotice(message);
                setDirty(false);
                setEditor(null);
                if (
                  editor.spec.path.startsWith("/api/finance/transactions") &&
                  values.walletId &&
                  values.categoryId
                )
                  sessionStorage.setItem(
                    `entry-${user.id}`,
                    JSON.stringify({
                      walletId: values.walletId,
                      categoryId: values.categoryId,
                      kind: values.kind,
                    }),
                  );
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={discard || blocker.status === "blocked"}
        onOpenChange={(open) => {
          setDiscard(open);
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>Your changes have not been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving || preferencesSaving}
              onClick={() => {
                setDirty(false);
                setDiscard(false);
                setEditor(null);
                if (blocker.status === "blocked") {
                  setPreferencesDirty(false);
                  blocker.proceed();
                }
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open && !write.isPending) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{remove?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {remove?.description ??
                "This permanently removes the named record and recalculates balances and reports. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {write.isError && (
            <Alert variant="destructive">
              <AlertDescription>{write.error.message}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={write.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={write.isPending}
              onClick={() => {
                if (remove)
                  void write
                    .mutateAsync({ path: remove.path, method: "DELETE" })
                    .then((result) => {
                      setNotice(result.message);
                      setRemove(null);
                    })
                    .catch(() => {});
              }}
            >
              {write.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
