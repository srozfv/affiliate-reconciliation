# Ledger — Affiliate Reconciliation

A browser-based workbench for reconciling affiliate-tracker FTD records with advertiser CPA statements. Includes contract validation, status history, last-click checks, an exception queue and financial exports.

**[Open application](https://srozfv.github.io/affiliate-reconciliation/)**

English is the default interface language. Switch to Russian using the control at the bottom left. The language preference is remembered where browser storage is available. Changing language preserves the current filters and search.

## Run

Open `dist/index.html` after extracting the complete archive. No installation or account is required. Alternatively, run `npm start` with Node.js 20+ and open http://127.0.0.1:4178.

## Sources

| CSV | Grain | Amount field |
| --- | --- | --- |
| clicks.csv | One observed click, optional registration | None |
| tracker.csv | FTD status snapshot | deposit_amount is the first deposit |
| advertiser.csv | Advertiser status snapshot | amount is CPA commission |
| contracts.csv | Partner, offer, country and effective period | advertiser_cpa, partner_cpa, min_deposit |

Download each input example from Sources. Import all four files together. Invalid input leaves the previous dataset unchanged. CSV must use UTF-8, comma or semicolon, the shown column names, UTC timestamps and nonnegative decimal amounts with at most two places. Quoted fields and line breaks are supported. Each file must contain data, with a maximum of 20 MB and 100,000 rows.

Available activity dates: **1 April–24 November 2026**. The FTD date filters financial totals. The separate funnel uses a click cohort, with outcomes observed at the as-of date. Use the cutoff to view earlier known statuses. Source-quality counters cover the full as-of dataset, independently of the period and partner filters.

## Calculation rules

- Latest known updated_at wins. Exact retries are deduplicated. Conflicting snapshots and changed event identity block accrual.
- Registration must occur within 30 exact UTC days of the last observed click; FTD within 90 days of registration. Boundaries are inclusive. Tied final clicks and multiple FTD IDs per player require review.
- Exactly one contract must match the partner, offer, country and FTD date. Its minimum-deposit and currency conditions must pass.
- Checked accrual uses advertiser-approved amounts. Status differences are flagged; the advertiser status governs recognition. An amount mismatch is flagged while the actual advertiser amount is retained.
- Partner obligations follow the applicable CPA contract, even if an approved advertiser amount is zero. Hold runs from the latest advertiser update. Due indicates expiry of the configured hold, not an actual invoice or payment.
- Pending, rejected and reversed statuses do not accrue revenue. Reversals remove current accrual; cash-payment recoveries are outside the model.
- Money uses integer minor units. Two-decimal currencies are assumed. Different currencies are never added or converted.
- Candidate shortfall is an investigation amount, not lost revenue. Invalid identity, currency or contract conditions exclude unreliable expected amounts.
- Contribution excludes operating expenses and taxes. The tool does not calculate RevShare, NGR, GGR, cash-payment history, profit, KYC/AML or fraud verdicts.

## Verification and exports

```sh
npm ci
npm test
npm run generate
npm run report
```

Node.js alone is sufficient for `node scripts/generate.cjs` and `node scripts/report.cjs`. The report command also accepts a directory containing the four CSVs and a cutoff date: `node scripts/report.cjs /absolute/path/to/directory 2026-11-24`.

Outputs are `results/summary.json`, `results/ledger.csv` (integer monetary fields labelled _cents), and `results/quality.csv`. UI CSV exports use decimal amounts. JSON audit exports preserve the calculation options and results. CSV output escapes spreadsheet formulas.

Tests cover monetary fixtures, attribution boundaries, status lifecycle, hold, currency isolation, aggregate reconciliation, CSV parsing and localised interface workflows. GitHub Actions verifies calculations and reproducibility. DOM integration tests do not replace a real-browser visual review.

## Code

`dist/engine.js` is shared by the browser and CLI. `dist/app.js` manages views and imports; `dist/i18n.js` handles English/Russian text and numeric locale. `scripts/` contains input and report utilities; `test/` contains engine and UI checks.

Original code is MIT-licensed. The MrQ Partners logo is excluded; see THIRD_PARTY.md.
