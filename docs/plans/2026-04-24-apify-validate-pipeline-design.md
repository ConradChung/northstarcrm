# Apify → Filter → Validate Pipeline

**Date:** 2026-04-24
**Status:** Approved

## Overview

A Claude Code skill that pulls the last run from a configured Apify actor, applies FMCSA carrier filters and cargo categorization, then runs the resulting email list through the existing Vertis Sync email validator edge function. Each Apify run appears on the dashboard as a distinct job (tagged `source: 'apify'`) with status polling and a downloadable CSV of validated leads with all original columns preserved.

---

## Architecture

```
Claude Code Skill (apify-validate)
      │
      ▼
POST /api/validate/apify/start       ← fast: ~1-2s
  1. Fetch all items from last Apify actor run
  2. Apply HARD FILTERS + CARGO EXCLUSIONS
  3. Assign cargo_category (first-match priority)
  4. Insert filtered rows into validation_rows (with row_data JSONB)
  5. Create validation_jobs record (source: 'apify', filter_stats JSONB)
  6. Fire-and-forget → email-validator edge function
  7. Return job_id + filter report + category breakdown
      │
      │ (fire-and-forget)
      ▼
email-validator Edge Function        ← slow: validates emails via MailTester Ninja
  - Existing validation loop unchanged
  - New branch: if source === 'apify', build CSV from row_data
    (all 29 cols + cargo_category + cargo_carried_raw, nested objects JSON-stringified)
      │
      ▼
Supabase Storage                     ← validated CSV uploaded on completion
```

---

## Filtering Rules

### HARD FILTERS (drop record if any fails)

| # | Field | Rule |
|---|-------|------|
| 1 | `entity_type` | Must equal `"CARRIER"` |
| 2 | `operation_classification` | Array must contain `"AUTHORIZED FOR HIRE"` |
| 3 | `power_units` | Integer between 5 and 100 inclusive |
| 4 | `mcs150_date` | Must parse to a date within the last 24 months |

### CARGO EXCLUSIONS (drop if `cargo_carried` contains any)

- Hazardous Materials
- Livestock
- Mobile Homes
- Motor Vehicles
- Passengers
- US Mail

---

## Cargo Categorization (`cargo_category` column)

First-match wins, checked top to bottom:

| Priority | Category | Trigger |
|----------|----------|---------|
| 1 | Mixed Generalist | 6+ distinct cargo_carried values |
| 2 | Refrigerated | Refrigerated Food, Fresh Produce, Meat |
| 3 | Tanker | Liquids/Gases, Chemicals, Oilfield Equipment |
| 4 | Specialty Flatbed | Metal: sheets/coils/rolls, Logs/Poles/Beams/Lumber, Machinery Large Objects, Building Materials |
| 5 | Construction/Agricultural | Construction, Coal/Coke, Agricultural/Farm Supplies, Grain/Feed/Hay |
| 6 | Household Goods | Household Goods |
| 7 | Beverage/Paper/Dry Bulk | Beverages, Paper Products, Commodities Dry Bulk |
| 8 | General Freight | General Freight |
| 9 | Other | Everything else |

---

## Output CSV Columns

All 29 original Apify fields preserved. Nested objects (`inspections_us`, `inspections_ca`, `safety_rating`) JSON-stringified. Two additional columns appended:

- `cargo_category` — assigned category string
- `cargo_carried_raw` — original array joined with `;`

---

## Database Changes

Already applied via Supabase SQL editor:

```sql
ALTER TABLE validation_jobs
  ADD COLUMN source TEXT NOT NULL DEFAULT 'csv'
    CHECK (source IN ('csv', 'apify')),
  ADD COLUMN filter_stats JSONB;

ALTER TABLE validation_rows
  ADD COLUMN row_data JSONB;
```

---

## Claude Code Skill Behaviour

1. Call `POST /api/validate/apify/start`
2. Print filter report:
   - Raw record count
   - Dropped: not CARRIER, not AUTHORIZED FOR HIRE, out-of-band fleet size, stale MCS150, each excluded cargo type
   - Final count after all filters
3. Print category breakdown sorted by count descending
4. Poll `GET /api/validate/status?job_id=...` every 5s, show progress
5. On completion: confirm validated CSV is ready for download
6. *(Future)* Send Telegram summary using `TELEGRAM_CHAT_ID` env var

---

## Environment Variables

| Variable | Sensitive | Purpose |
|----------|-----------|---------|
| `APIFY_API_TOKEN` | Yes | Apify authentication |
| `APIFY_ACTOR_ID` | No | Actor to pull last run from (`MB6MTbLZh4tkXpJxg`) |

Both added to Vercel dashboard. Apify token to be rotated after setup.

---

## Dashboard

Apify-sourced jobs display with an **Apify** source badge. Status polling, progress bar, and download button work identically to CSV-uploaded jobs.
