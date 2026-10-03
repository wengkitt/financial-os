# Financial OS populated UI/UX retest

Reviewed 3 October 2026 using the authorized test account and the local development app at `http://127.0.0.1:5174`. This supplements [the original review](./ui-ux-review.md), which covered empty screens, public account flows, and source inspection. This pass saved clearly labeled fake records through the UI and exercised populated workflows. No application code was changed.

The arithmetic in the exercised workflows reconciles. The most important improvements concern access to amounts/actions on mobile, recovery from archived references, explicit report scope, and recurring-payment history. The existing light theme, typography, navigation, and consistent controls remain a good foundation.

## What was exercised

| Workflow                                                    | Result                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Create MYR and AUD wallets with opening balances            | Saved; balances later matched income, expenses, transfer, correction, and payment edits.                       |
| Create and edit a dated Space with a budget                 | Saved; dates displayed as 1–31 October; trip totals and overspending updated.                                  |
| Create an expense category                                  | Saved and available for transaction entry and category budgets.                                                |
| Record income and expenses in both currencies               | Saved; AUD 50 × rate 3 displayed as MYR 150; AUD 100 income displayed as MYR 300.                              |
| Record preparation spending before a trip                   | September entry remained separate from October totals and appeared in trip preparation costs.                  |
| Create an October category budget                           | MYR 100 limit, MYR 125 spending, MYR 25 overspend correctly calculated.                                        |
| Record a cross-currency wallet transfer                     | MYR 100 sent, AUD 33.33 received; wallet balances changed without inflating income/expenses.                   |
| Record a signed balance adjustment                          | MYR −5 correction affected the wallet and stayed out of income/expense reporting.                              |
| Create recurring payments and confirm an overdue occurrence | September due date confirmed with actual MYR 32 paid in October; one linked expense appeared.                  |
| Edit that confirmed payment                                 | Updated to MYR 35; dashboard, wallet, and Everyday expense totals reflected the change.                        |
| Skip October occurrence                                     | Moved to skipped history; no new expense, but no undo action exposed.                                          |
| Pause and resume schedule                                   | Pending November occurrence disappeared and returned; paused again at completion.                              |
| Archive/restore the fixture wallet and category             | Archived references reproduced blocked payment confirmation and blocked historical editing; both restored.     |
| Search, date filters, month selection, navigation           | Filtering worked; no-match wording and navigation resets reproduced.                                           |
| Desktop and 390 × 844 mobile layout                         | Desktop information is readable; mobile ledger/payment tables conceal key columns behind horizontal scrolling. |
| Space deletion prompt                                       | Inspected and canceled; no records deleted.                                                                    |

CSV export was clicked, but the browser's download event did not yield a captured file. No visible error appeared. Export contents remain unverified; this is not evidence of a broken export. Authentication was covered in the original pass and was not repeated. This is not a full keyboard, screen-reader, contrast, large-dataset, or network-failure certification.

## Reconciled results

| Value                                                  | Expected and displayed                   |
| ------------------------------------------------------ | ---------------------------------------- |
| October income / expenses / net                        | MYR 1,300 / 310 / 990                    |
| September income / expenses / net                      | MYR 0 / 150 / −150                       |
| QA Review MYR balance                                  | MYR 1,085.00                             |
| QA Review AUD balance                                  | AUD 283.33                               |
| Original Touch and Go balance                          | MYR 54.89, unchanged                     |
| QA Review Trip income / preparation / running expenses | MYR 300 / 150 / 150                      |
| Trip total expenses / result / overspend               | MYR 300 / 0 / 50 over its MYR 250 budget |
| Everyday income / expenses / result                    | MYR 1,000 / 160 / 840                    |
| QA Review Food October spending                        | MYR 125 against MYR 100 budget           |

MYR wallet reconciliation: `500 + 1000 − 45 − 80 − 150 − 35 − 100 − 5 = 1085`. AUD wallet reconciliation: `200 + 100 − 50 + 33.33 = 283.33`. These are recorded ledger entries, not real money movements.

## Confirmed improvements, in priority order

### 1. Keep amounts and actions visible on mobile — High

At 390 px, the transaction table is approximately 716 px wide inside a 350 px scroll container. The initial visible columns are Date, Description, and part of Wallet; Amount, Space, Edit, and Delete require horizontal scrolling. The filter area uses roughly 300 px before the ledger begins. The recurring-payment table is approximately 711 px wide inside the same 350 px area: expected amount, status, Confirm, and Skip are offscreen. Payment history also overflows.

Compose a mobile transaction row from existing shadcn primitives: description/category, signed currency amount, date, and an accessible actions control. Put wallet/Space in secondary details. For recurring entries, show name, due date, amount, status, and Confirm together. Keep Search prominent and place secondary filters in a Sheet with active-filter chips and a result count. Desktop can retain the table.

Acceptance: the amount and primary action are visible without sideways scrolling on a 390 px viewport; filtering does not dominate the first screen.

### 2. Handle archived dependencies before users hit a failed save — High

Archiving QA Review MYR succeeded with an active schedule and historical transactions. Confirming its next occurrence then failed with “This wallet is archived.” Editing the existing lunch transaction showed a blank Wallet placeholder, rather than the archived wallet name, and a notes-only change failed with the same error. Archiving QA Review Food similarly removed its label from the edit selector, then a notes-only save failed with “Choose an active category matching the transaction type.” Both fixture references were restored after testing.

Warn about dependent schedules during archive. Preserve the historical selected name, clearly mark it archived, and define an explicit policy for edits: allow changes that preserve that reference, or offer restore/reassign before submission. Show a repair action on affected schedules and avoid an apparently usable confirmation flow ending in a generic server error.

Acceptance: archived names never disappear from historical forms; dependent schedules have an actionable explanation; notes-only history edits have a predictable supported path.

### 3. Make each report's time scope unambiguous — High

Filtering the trip from 1 October removed the September preparation transaction from the table, but the headline preparation amount and category breakdown still included MYR 150. There was no nearby lifetime label. On Overview, choosing September correctly changed the headline totals and category spending, while Recent transactions continued to show October entries. Returning after visiting another section reset the selected month to October.

Either apply the selected period to the whole report or label the lifetime and period sections explicitly. State that wallet balances are current and recent activity covers all dates. Persist view state through validated TanStack Router search parameters.

Acceptance: the date scope of every total is understandable from the screen; navigation restores the chosen view.

### 4. Make recurring history auditable and mistakes recoverable — High

The September occurrence was paid on 3 October for MYR 32, then edited to MYR 35. History still showed only “03 Sep 2026 · paid,” without the actual amount or payment date. October's Skip wrote immediately and exposed no undo. An occurrence due today was labeled Upcoming, just like a future occurrence. Schedule cards omit expected amount and next due date.

Show due date, actual payment date, amount, and a link to the recorded expense. Add Undo skip with duplicate protection. Distinguish Overdue, Due today, and Upcoming. Show expected amount and next due date on schedule cards. Replace Paused Yes/No with clear Pause/Resume controls. A paused schedule should produce an explanation such as “No active upcoming payments,” rather than “Add a monthly payment” under All caught up.

### 5. Reduce repetitive entry and clarify successful saves — Medium

Each new transaction reset Wallet to the original Touch and Go instead of the fixture wallet used moments before. Category also returned to a default. This requires repeated selection and makes accidental misclassification easy. Saved values reopened as `45.00000000`, `30.00000000`, and exchange rate `1.00000000`. Saves closed the modal without lasting confirmation, and every form used generic Save/Reset labels.

Remember the last-used wallet where appropriate, make defaults explicit, and preserve useful context when entering from a wallet or Space. Format currency fields to readable precision and exchange rates to meaningful precision while preserving decimal accuracy. Name the amount currency and preview conversion. Use action-specific submission labels, visible Cancel, draft protection, and persistent success feedback as detailed in the original review.

### 6. Improve overspending presentation — Medium

Both category and trip overspending were calculated correctly. The category showed “MYR −25.00 remaining · Over budget”; the trip showed “MYR −50.00 remaining · Over budget.” Both progress indicators reported 100%, even though actual usage was 125% and 120% respectively. The visual bar can remain capped, but its text/accessibility representation should convey actual usage.

Display “Over by MYR 25 · 125% used,” the budget limit, and an accessible overspend state. Preserve restrained color and do not depend on color alone.

Source: `src/components/workspace.tsx:112` (`BudgetProgress`).

### 7. Distinguish no matches and name destructive targets — Medium

A search for “QA Review no matching record” displayed “No transactions yet / Record an income or expense…” despite seven existing transactions. Returning from Overview cleared the earlier Search filter. The trip deletion prompt said “Delete Space?” with generic record/balance wording and did not identify the Space or describe its attached entries. It was canceled.

Show “No matching transactions,” a result count, and Clear filters. Preserve filters across navigation. Name the target in confirmation text and explain the actual consequence or reference restriction before Delete is available.

Source: `src/components/workspace.tsx:566` (shared empty ledger state).

### 8. Correct Button/Link composition warnings — Medium

The browser console captured Base UI warnings that a component expected a native button while rendering a non-button. Workspace actions render TanStack Router Links through the shared Base UI Button without explicitly declaring a non-native button.

Keep typed Links and shadcn Button composition; set the appropriate `nativeButton={false}` on Link-rendering Button instances and verify link semantics and keyboard behavior. This is a confirmed runtime warning; it is not evidence that navigation failed.

Source: `src/components/ui/button.tsx:6`; Link-rendering actions in `src/components/workspace.tsx:710`, `:778`, `:816`, `:1204`, `:1329`.

## Suggested implementation order

1. Archived-reference policy, explicit report scope, recurring history and Undo skip.
2. Mobile rows and filters, shorter currency-aware forms, readable edit values, save/draft feedback.
3. Persistent view state, no-match states, clearer budgets, named deletion prompts, Button/Link semantics.

Use the current shadcn components, shared theme tokens, TanStack Router/Query/Form, and Zod. Keep the calm light visual style. Prioritize information hierarchy and fewer decisions over decorative redesign. The original review's account-state, empty-report, validation, and `/app` route findings remain relevant.

## Test data left for reproduction

All newly created names/notes begin **QA Review**. Records remain in the test account so the populated findings can be reproduced; original records were not edited or deleted. Fake entries in Everyday naturally change its aggregate reports.

- Wallets: QA Review MYR (opening MYR 500), QA Review AUD (opening AUD 200); both active after archive tests.
- Space: QA Review Trip, 1–31 October 2026, MYR 250 budget, active.
- Category: QA Review Food, expense, active after archive tests.
- Transactions: salary MYR 1,000; lunch MYR 45; groceries MYR 80; preparation MYR 150 on 28 September; lodging AUD 50; AUD wages AUD 100; bill MYR 35. All others dated 3 October. AUD entries use MYR conversion rate 3.
- Category budget: QA Review Food, October 2026, MYR 100.
- Transfer: QA Review transfer, MYR 100 → AUD 33.33.
- Adjustment: QA Review correction, MYR −5.
- Schedule: QA Review bill, MYR 30 monthly, 3 September–3 November. September paid, October skipped, **schedule paused at completion**.

No permanent deletion, real payment, account-preference change, email send, migration, or deployment was performed. No implementation changes were made, so the original check/test results are not presented as a new validation run. Browser date input initially resisted automation; native date controls were used and stored dates were verified. That tooling limitation is not counted as an app defect.

## Browser evidence

- Populated final dashboard: `/private/tmp/financial-os-ui-review/populated-overview.jpg`
- Overspent budgets: `/private/tmp/financial-os-ui-review/populated-budgets.jpg`
- Trip filter with lifetime preparation totals: `/private/tmp/financial-os-ui-review/populated-trip-filter.jpg`
- Recurring history: `/private/tmp/financial-os-ui-review/populated-recurring.jpg`
- Archived wallet error: `/private/tmp/financial-os-ui-review/archived-wallet-error.jpg`
- Paused fixture schedule: `/private/tmp/financial-os-ui-review/paused-fixture.jpg`

Mobile screenshots were inspected live and table/container dimensions read from the rendered DOM. The exported screenshot API did not reliably preserve viewport overrides; these saved files are desktop evidence.
