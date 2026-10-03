# Financial OS UI and UX review

Reviewed 3 October 2026 against the working tree and the local app at `http://127.0.0.1:5174`.

The app has a coherent visual foundation: Inter, restrained neutral colors, readable navigation, consistent shadcn controls, labeled fields, and modest borders. The biggest gains will come from simplifying everyday entry, making report scope explicit, improving empty states, and resolving misleading account and report messaging.

## Scope and evidence

- Signed into the authorized test account. Inspected Overview, Transactions, Wallets, Recurring payments, Budgets, Spaces, both existing Space reports, Settings, and their reachable create/edit dialogs.
- Inspected login, registration, password recovery, reset without a token, verified-email completion, `/app`, and the leftover `/form-demo` route.
- Tested desktop at 1280 × 800 and mobile at 390 × 844, including navigation, expense entry, transaction filters, and registration.
- Entered an unsaved sample amount to test draft dismissal. No financial records, account preferences, categories, or schedules were saved or deleted. No recovery or verification emails were sent.
- The account has a wallet and two Spaces, with no transactions, budgets, or recurring schedules. Populated ledger, overspending, transfer, payment-confirmation, and archive edge cases below are **source-reviewed**, not demonstrated end to end with saved fixtures.
- Loading states were observed. Error handling, pending writes, and screen-reader associations were also inspected in source. This is not a full screen-reader or contrast certification.

Evidence labels: **Observed** means reproduced in the browser; **Source** means supported by implementation inspection; **Recommendation** means a design improvement rather than a demonstrated defect. High priority affects frequent entry, financial interpretation, or recovery. Medium priority improves discovery, continuity, or scanning.

## Highest-priority changes

### 1. Make expense and income entry shorter — High, Observed + Source

Expense entry always shows eight fields, including an exchange rate for a reporting-currency wallet and preparation spending for Everyday. The mobile dialog scrolls before Notes and Save become visible. The Amount field does not name its currency. New foreign-currency entries and recurring confirmations default their exchange rate to `1`.

Show the selected currency alongside Amount. Keep amount, wallet, category, and date prominent; put optional notes and Space details in a compact secondary section. Automatically use rate `1` for reporting-currency wallets. For other currencies, require an explicit rate or a clearly identified last-used rate, and preview the converted reporting amount before Save. Explain the rate direction with actual currency codes, such as `1 AUD = … MYR`.

Treat preparation spending as an optional Space-specific choice. Do not make users decide about trip costs for every ordinary purchase. On mobile, keep the dialog title and Save/Cancel footer visible while only the fields scroll. Use an appropriate shadcn Dialog, Sheet, or Drawer composition.

Source: `src/components/workspace.tsx:208`, `:244`, `:352`, `:1623`; `src/components/finance-form.tsx:195`.

Acceptance: an ordinary same-currency expense needs no exchange-rate input; its currency is visible; the action remains reachable on a short viewport; foreign-currency conversion is understandable before submission.

### 2. Fix validation timing, language, and recovery — High, Observed + Source

On login, filling Username and focusing Password displays `Too small: expected string to have >=1 characters` for the untouched password. Opening `/reset-password` without a token displays the raw token regex while still offering a new-password form and submission button.

Use human messages such as “Enter your password” and show field errors after that field is touched or the form is submitted. Gate FieldError rendering consistently with the field's invalid state. Do not render form-level validation alerts on initial mount. A missing or malformed reset token should show “This reset link is invalid” with a route to request another link. Handle expired links with an equally clear recovery action.

The shared Select receives change handling but no field blur callback; Inputs associate descriptions with help text only, and error elements have no IDs linked to their controls. Wire select lifecycle events into TanStack Form, associate error and help IDs through `aria-describedby`, and focus the first invalid control on a failed submit. Keep Zod schemas and TanStack Form as the validation foundation.

Source: `src/components/finance-form.tsx:89`, `:117`, `:155`, `:166`; `src/components/auth-screen.tsx:102`; `src/lib/contracts.ts:53`.

### 3. Make Space reports fit their purpose and avoid false success — High, Observed + Source

Everyday currently shows “Preparation spending,” “Includes costs paid before the trip,” and “Preparation cost recovery.” Both empty Space reports say income covers their costs despite having no transactions. An active trip is labeled with a “Final result” even though activity may still be ongoing.

Use an everyday report with Income, Expenses, and Net cash flow. For trips/projects, retain preparation and running costs, but show “Result so far” while active and “Final result” after completion. Until relevant activity exists, show a neutral “No activity yet” state. Show cost-recovery messaging when there are preparation costs to recover.

Source: `src/components/workspace.tsx:571`; `src/lib/finance.ts:50` and its `recovered` calculation.

Acceptance: an empty ledger never claims a financial milestone; Everyday avoids trip terminology; active and completed results are clearly distinguished.

### 4. Protect drafts and make save results visible — High, Observed + Source

Typing a sample amount, closing the expense dialog, and reopening it loses the draft without warning. Forms offer Reset instead of a visible Cancel action. Successful dialog saves set a message inside FinanceForm and immediately close the dialog, so that message disappears. Generic Save/Saving labels are also used for authentication actions.

Use Save expense, Create wallet, Set budget, and Sign in/Signing in as appropriate. Provide Cancel in dialogs; omit Reset from login, recovery, and verification forms. Confirm discard only for a dirty draft, or preserve the draft during the session. Keep submission state visible and guard against dismissing an in-flight operation without explaining its status. Display success feedback outside the closing dialog using the project's feedback components.

Source: `src/components/workspace.tsx:1617`; `src/components/finance-form.tsx:90`, `:195`.

### 5. Clarify date and report scope — High, Source + Recommendation

The Overview month selector controls headline totals and category spending, while the cash-flow table uses historical data and Recent transactions uses all dates. Space date filters affect the transaction list and CSV, while Space metrics and breakdown retain lifetime totals. That can be reasonable, but the scope is not explicit enough near each section.

Label sections “Current balances,” “Last 12 recorded months” or a true 12-calendar-month range, and “Latest activity · All dates.” Label Space headline totals “Lifetime totals” or make the selected period govern the whole report. If lifetime preparation costs remain visible alongside a period filter, explicitly identify that choice.

Source: `src/components/workspace.tsx:370`, `:718`, `:843`, `:886`, `:909`.

Acceptance: users can tell which period a number covers without inferring it from implementation or position.

## Improvements across the remaining screens

| Priority | Area                      | Finding and proposed improvement                                                                                                                                                                                                                                                                                                                                                                                                        | Evidence                                                                                      |
| -------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Medium   | Overview                  | The empty dashboard repeats zero metrics and several empty report sections. Use a compact first-use checklist: record a transaction, set a budget, add a recurring commitment. Preserve completed setup steps and expand reports as activity arrives. Surface wallet balance and a clear next action above the empty reports.                                                                                                           | Observed; `workspace.tsx:718`                                                                 |
| Medium   | Transactions              | The filter toolbar wraps at desktop width and consumes much of the mobile screen. Keep Search visible, move secondary filters into a shadcn Popover/Sheet, show active-filter chips and a result count, and label CSV as “Export CSV.” Add an income/expense filter.                                                                                                                                                                    | Observed; `workspace.tsx:414`                                                                 |
| Medium   | Filter continuity         | Filters and month selection live inside content that remounts on section changes. Preserve the user's view through typed TanStack Router search parameters, enabling Back/Forward and shareable views. Validate date ranges; From after To should explain the problem.                                                                                                                                                                  | Source; `workspace.tsx:165`, `:191`; `contracts.ts:171`                                       |
| Medium   | Empty transaction results | The same “No transactions yet” message is used for a ledger with no records and a filtered query with no matches. Distinguish these states and offer Clear filters only for the latter.                                                                                                                                                                                                                                                 | Source; `workspace.tsx:496`                                                                   |
| Medium   | Wallets                   | Transfer money is disabled with one wallet and gives no nearby explanation. Explain that two active wallets are needed and offer Add wallet. Make wallet balance/card navigation lead to that wallet's activity. Use a clearer archived section rather than mixing archived and active wallets equally.                                                                                                                                 | Observed + Source; `workspace.tsx:920`, `:992`                                                |
| Medium   | Balance corrections       | “Adjust balance” requires a signed delta. Offer “Actual balance” plus current balance and a calculated correction preview; retain an explicit advanced delta option if useful. Currency codes should replace “wallet currency.”                                                                                                                                                                                                         | Observed; `workspace.tsx:955`                                                                 |
| Medium   | Transfers                 | Source and destination amounts are separate even for same-currency wallets. Name the currencies, copy the sent amount for same-currency transfers, and preview both resulting balances. Preserve the existing fee-as-expense explanation.                                                                                                                                                                                               | Source; `workspace.tsx:928`                                                                   |
| High     | Archived references       | Transaction editing excludes archived wallets/categories, even when the historical record references them; the server rejects archived references on update. Recurring schedules can also point to subsequently archived wallets/categories, making confirmation fail. Define a clear policy: allow history-preserving edits or explain restore/reassignment; warn about dependent schedules when archiving and provide repair actions. | Source; `workspace.tsx:200`, `:244`; `worker/services/finance.ts:72`, `:82`, `:292`, `:441`   |
| High     | Recurring recovery        | Skip immediately writes an occurrence; skipped history has no correction action. Paid history shows neither actual amount nor payment date. Add an explicit Undo skip/correction workflow with ownership and duplicate protections, show actual payment details, and link to the resulting transaction.                                                                                                                                 | Source; `workspace.tsx:1386`, `:1459`; `worker/services/finance.ts:441`                       |
| Medium   | Recurring clarity         | “All caught up” is shown with no schedules. Differentiate “No recurring payments yet” from genuinely having no outstanding occurrences. Show “Monthly” in the create form, expected amount and next due date on schedules, and explain why an edited first due date is locked. Use an explicit Pause/Resume action instead of a Yes/No dropdown.                                                                                        | Observed + Source; `workspace.tsx:320`, `:1342`, `:1419`                                      |
| Medium   | Budgets                   | Empty category budgets have no action inside the empty state; empty Space budgets leave a heading and a large blank area. Add contextual setup actions. Add a compact spent/limit/remaining overview and Copy previous month after core fixes. For overspending, display “Over by …” instead of a negative “remaining” value; include percent used.                                                                                     | Observed + Source; `workspace.tsx:112`, `:1230`                                               |
| Medium   | Spaces                    | Give the report a breadcrumb/back link; distinguish Everyday visibly as the default. Add Active/Completed grouping when Spaces grow. Name the exact Space in deletion dialogs and explain when completion is the appropriate alternative.                                                                                                                                                                                               | Observed + Source; `workspace.tsx:1150`, `:1647`                                              |
| Medium   | Settings/categories       | Preferences and category management compete on one long page. Group them into clear sections or tabs, use friendly timezone labels such as “Kuala Lumpur (UTC+8),” and explain the fixed reporting currency beside that control. Replace Archived Yes/No with an explicit archive/restore action and explain its effect on new entries.                                                                                                 | Observed; `workspace.tsx:1494`                                                                |
| Medium   | Registration              | Currency and timezone add decisions during signup, but the form doesn't explain that currency becomes fixed after financial setup. Add a short explanation, friendly labels, password visibility, and remove Reset. Make the default choices easy to accept.                                                                                                                                                                            | Observed + Source; `auth-screen.tsx:56`                                                       |
| Medium   | Verification completion   | A verified account still sees “Verify your email” and instructions to check its inbox beside Open Financial OS. Branch the title and description by state: “Email verified — you're ready.” Avoid briefly showing signed-out instructions while the session loads.                                                                                                                                                                      | Observed; `auth-screen.tsx:122`, `:152`                                                       |
| Medium   | Routes and polish         | `/app` renders the shell with a blank main area. Add an index redirect to Overview. Remove or restrict `/form-demo` from the production route tree, style the real 404 consistently, and give each page a useful browser title.                                                                                                                                                                                                         | Observed + Source; `routes/app.tsx:3`, `routes/form-demo.tsx:4`, `components/not-found.tsx:3` |

## Visual direction

Keep the existing light theme and shadcn foundation. The current sidebar, neutral palette, typeface, and primary action treatment already align with the intended direction. The improvement is hierarchy and density: fewer large empty panels, fewer redundant captions, compact aligned toolbars, and clearer grouping of primary versus optional fields.

The current [Linear product previews](https://linear.app/) are the visual reference: focused navigation, restrained surfaces, compact controls, and clear content hierarchy. Apply those principles to the app's light theme. Use shared semantic tokens and supported shadcn variants; retain accessible focus indicators, labeled controls, dialog titles, and reduced-motion behavior.

For populated reports, introduce a restrained cash-flow chart and ranked spending bars only after the period and financial semantics are clear. Keep exact values available in tables. For populated mobile tables, use a compact transaction row composition with date, description, amount, and accessible actions; the current horizontally scrolling table needs fixture-based verification before selecting a final solution.

## Suggested implementation sequence

1. **Trust and correctness:** validation timing/messages, reset-link states, empty report claims, verified-email messaging, `/app` redirect, explicit period scope, and archived-reference policy.
2. **Daily entry:** currency-aware forms, optional advanced fields, visible Save/Cancel, draft handling, success feedback, and clearer transfer/correction previews.
3. **Navigation and first use:** compact empty states with actions, persistent filters, mobile filter sheet, breadcrumbs, and budget setup guidance.
4. **Reporting and management:** recurring recovery/history, budget summaries/copying, active/archive grouping, and restrained visual charts.

## Validation and follow-up limits

- `vp check` passed formatting, lint, and type checking.
- `vp test` passed: 43 tests across 8 files; the opt-in database suite was skipped (13 tests).
- `vp install` produced no output and was stopped after several minutes. Review used existing dependencies; no dependency updates were intended.
- No implementation changes, migrations, deployment, email sends, or financial mutations were performed. The only repository addition is this review.
- Next verification should use clearly disposable development fixtures covering many transactions, multiple currencies, archived references, over-budget spending, and paid/skipped/overdue occurrences. Exercise real save/error flows, keyboard traversal, screen-reader feedback, long labels, and mobile table layouts. The observations above do not claim these populated workflows have already passed.

Browser evidence captured locally: `/private/tmp/financial-os-ui-review/everyday-report.jpg`. Mobile layouts were inspected through browser screenshots; the saved screenshot export did not preserve the viewport override, so it is not presented as mobile evidence.
