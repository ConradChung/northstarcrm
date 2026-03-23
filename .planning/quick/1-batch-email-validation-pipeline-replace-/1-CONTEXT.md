# Quick Task 1: Batch Email Validation Pipeline - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the existing email validation pipeline (currently n8n webhook-based, previously SSE-based) with a Supabase Edge Function architecture that eliminates Vercel timeout risk entirely. The Edge Function runs inside Supabase infra with no timeout constraint. Vercel handles only lightweight job creation + status polling. Existing UI (EmailValidator.tsx) must be preserved — UI changes are additive only.

</domain>

<decisions>
## Implementation Decisions

### Validation Logic
- **Keep MailTester Ninja API** — port the existing `validateEmail()` function (currently in route.ts) into the Edge Function. Same accuracy. Sequential calls, same rate-limit approach.
- Do NOT switch to self-contained MX/regex validation.

### Database: New Tables
- `validation_jobs` and `validation_rows` tables as specified in the task.
- Add nullable `storage_path text` column to `validation_jobs` — needed for migrated old runs that have CSV in Supabase Storage but no `validation_rows`.

### Data Migration
- Migrate existing `email_validation_runs` rows into `validation_jobs` (completed runs only — those with storage_path set).
- Map: file_name→filename, total→total_rows, valid_count→valid_count, (total-valid_count)→invalid_count, processed→processed_rows, storage_path→storage_path, status 'complete'→'completed'.
- Do NOT create validation_rows for migrated runs (too complex — they have no row-level data).
- `email_validation_runs` table: keep in place, do not drop (safe rollback path).

### Download for Migrated Runs
- For jobs with `storage_path` set (migrated): generate signed URL from `validation-results` bucket.
- For new jobs (no storage_path): use `GET /api/validate/results` to generate CSV from validation_rows.
- UI checks: if `storage_path` non-empty → signed URL download; else → results API.

### New API Routes Location
- `POST /api/validate/start` (new)
- `GET /api/validate/status` (new)
- `GET /api/validate/results` (new)
- Remove old `/api/validate-emails/` routes and `/api/validate-emails/status/[runId]/` after new routes work.

### Supabase CLI
- Not installed. Create `supabase/migrations/` directory structure manually.
- Write migration SQL files that the user can run via `supabase db push` after installing CLI, OR run directly in Supabase SQL editor.
- Edge Function: write to `supabase/functions/email-validator/index.ts`.
- Deploy instructions: `supabase functions deploy email-validator`.

### Previous Runs UI
- Query `validation_jobs` table (not old `email_validation_runs`).
- Show status badge: pending/processing/completed/failed.
- Completed with storage_path → signed URL download.
- Completed without storage_path → results API download.
- Failed → show error_message + retry button.
- Processing → show progress (animated).

### Claude's Discretion
- Exact Supabase Edge Function Deno runtime imports (use `https://esm.sh/` for npm packages if needed).
- Batch size within Edge Function (spec says 50 — keep that).
- Exact polling interval in UI (spec says 2s — keep that).
- SUPABASE_SERVICE_ROLE_KEY is already available as env var in Supabase Edge Functions (automatic).

</decisions>

<specifics>
## Specific References

- Existing column detection logic: keep TIER1_NAMES, PERSONAL_SUBSTRINGS, normalizeHeader, detectEmailColumn, parseCSVRow, parseCSV from current route.ts — port into /api/validate/start.
- MailTester API: `https://happy.mailtester.ninja/ninja?email=${email}&key=${MAILTESTER_API_KEY}`
- Supabase project URL: `https://rcfrumrbauwvyzfebxck.supabase.co` (from existing code)
- Storage bucket for old runs: `validation-results`
- New storage bucket for validated CSVs from new runs: `validation-results` (same bucket, different path prefix if needed)
- Telegram notifications: keep in Edge Function for milestones (10%, 20%... 100%)
- The EmailValidator component already has RingChart, download, copy-for-clay, previous runs — preserve all of these, only change the submit() function and runs data source.

</specifics>
