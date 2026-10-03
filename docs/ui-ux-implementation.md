# UI and UX improvements

Implemented 3 October 2026 against the two review reports. Existing local application work was preserved. Changes are local; no deployment or database migration was performed.

## Delivered

| Area                   | Changes                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everyday entry         | Currency-labeled amounts, conversion previews, explicit foreign rates, remembered wallet/category defaults, readable decimal values, optional details, segmented choices, action-specific buttons, fixed dialog actions.                                                                                                                    |
| Validation and drafts  | Friendly Zod messages, touched/submitted error timing, linked error/help text, focus on invalid fields, visible Cancel, navigation/discard protection for dialogs and preferences, persistent save feedback.                                                                                                                                |
| Mobile                 | Transactions show signed amounts and edit/delete actions without sideways scrolling. Secondary filters use a Sheet with count and removable chips. Recurring payments, history, transfers, corrections, categories and monthly totals use readable item layouts.                                                                            |
| Reporting              | Explicit monthly/lifetime/current/all-date scope, router-persisted filters and month, Everyday-specific totals, active/completed result labels, neutral empty reports, recovery only with preparation costs, cash-flow chart and ranked spending bars with exact values. Empty dashboards focus on setup rather than repeated empty charts. |
| Recurring payments     | Due today/overdue/upcoming states, schedule amount and next due date, explicit Pause/Resume, paid amount/date and linked expense, Undo skip with ownership and concurrency protection, archived-reference repair guidance.                                                                                                                  |
| Wallets and references | Explicit Archive/Restore, active/archive grouping, dependent active schedules prevent archiving, historical edits retain archived names/references, same-currency transfer simplification and resulting balances, counted-balance correction with stale-balance protection.                                                                 |
| Budgets and Spaces     | Over-by and actual percentage text, aggregate budget summary, copy missing limits from previous month, setup actions, Active/Completed Space groups, default badge, report back link, named destructive targets and consequences.                                                                                                           |
| Account and navigation | Friendly timezone labels and currency explanation, password visibility, invalid reset-link recovery, correct verified state, session loading skeleton, `/app` redirect, production demo restriction, consistent 404, useful page titles and semantic navigation links.                                                                      |

## Validation

- `vp install` completed.
- `vp check --fix`: formatting, lint and TypeScript passed with no warnings.
- `FINANCIAL_OS_DB_TESTS=1 vp test`: **64 passed across 9 files**. Database tests use isolated temporary accounts and clean up their fixtures.
- `vp run build`: TypeScript and production client/Worker builds passed.
- Regression coverage includes report recovery, readable precision, validated search parameters, type filtering/export, auth validation/reset states, historical archived references, active schedule archive restrictions, skipped-occurrence undo/concurrency/ownership, existing archived-category budget edits and stale counted-balance corrections.
- Browser checks covered 390 × 844 mobile rows and dialog actions, mobile filtering and counts, no-match recovery, filter continuity, invalid date range/export guard, `/app` redirect, preferences navigation/discard, historical notes-only edits, recurring undo/pause and updated report amounts.

The original Touch and Go wallet remains MYR 54.89. QA Review MYR remains MYR 1,085; QA Review AUD remains AUD 283.33. Fixture schedule is paused, October skipped and September paid. Only labeled QA fixtures were changed; the test account's preferences were not saved. No real money movement, credential change, recovery email or permanent deletion was performed.

## Evidence and limits

- Mobile ledger: `/private/tmp/financial-os-ui-improvements/mobile-ledger.png`.
- Improved Overview: `/private/tmp/financial-os-ui-improvements/overview.png`.

CSV generation and filtering passed automated tests; the earlier browser download capture limitation remains. This pass is not a complete screen-reader, contrast, large-dataset or network-failure certification. No schema change is required for these improvements.
