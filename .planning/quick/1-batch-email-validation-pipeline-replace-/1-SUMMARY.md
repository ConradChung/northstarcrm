---
phase: 1-batch-email-validation-pipeline-replace
plan: 1
subsystem: email-validation
tags: [supabase, edge-functions, api-routes, nextjs, deno]
tech-stack:
  added:
    - Supabase Edge Functions (Deno runtime)
    - Supabase PostgREST REST API (direct fetch in Edge Function)
    - Supabase Storage (CSV upload from Edge Function)
  patterns:
    - Fire-and-forget Edge Function invocation from Next.js API route
    - Service role client for inserts (bypass RLS)
    - Polling-based progress UX (2s interval, validation_jobs table)
key-files:
  created:
    - supabase/migrations/20260322000001_create_validation_tables.sql
    - supabase/migrations/20260322000002_migrate_validation_runs.sql
    - supabase/functions/email-validator/index.ts
    - app/api/validate/start/route.ts
    - app/api/validate/status/route.ts
    - app/api/validate/results/route.ts
  modified:
    - components/EmailValidator.tsx
    - tsconfig.json
  deleted:
    - app/api/validate-emails/route.ts
    - app/api/validate-emails/status/[runId]/route.ts
decisions:
  - Used direct PostgREST fetch in Edge Function (no npm Supabase client — avoids esm.sh dependency in Deno)
  - Service role client created inline in start/route.ts (avoids RLS blocking inserts on validation_jobs)
  - Excluded supabase/functions from Next.js tsconfig (Deno globals like Deno.env incompatible with Node TS check)
  - Cleared .next cache to remove stale type validator references to deleted route
metrics:
  duration: ~20 minutes
  completed: 2026-03-22
  tasks: 3
  files_created: 6
  files_modified: 2
  files_deleted: 2
---

# Quick Task 1: Batch Email Validation Pipeline Replacement Summary

**One-liner:** Replaced n8n-based email validation with Supabase Edge Function architecture — new DB tables, Deno Edge Function (MailTester + Telegram + Storage), 3 lightweight Vercel API routes, updated EmailValidator.tsx with 2s polling and status badges.

## What Was Built

### Database Migrations (not yet applied — requires Supabase CLI or SQL editor)

**Migration 1** (`20260322000001_create_validation_tables.sql`): Creates `validation_jobs` and `validation_rows` tables. `validation_jobs` tracks job-level state (status, counts, storage_path). `validation_rows` holds individual email rows with FK to `validation_jobs` and a status check constraint (`pending/valid/invalid/error`). Includes an auto-update trigger for `updated_at`.

**Migration 2** (`20260322000002_migrate_validation_runs.sql`): Copies completed rows from `email_validation_runs` into `validation_jobs` (only rows with `storage_path` set). Uses `ON CONFLICT DO NOTHING` for idempotency. Old table is left in place as safe rollback path.

### Supabase Edge Function (`supabase/functions/email-validator/index.ts`)

Deno TypeScript function. Uses `Deno.serve()` and `EdgeRuntime.waitUntil()` for fire-and-forget async processing. Direct PostgREST REST calls (no npm client needed). Flow:

1. Parse `{ job_id }` from POST body, return 400 if missing
2. Mark job `processing`
3. Loop: fetch 50 pending `validation_rows` at a time, call MailTester Ninja API per row
4. Update each row's status + `validation_result` JSON, update job counters after each row
5. Send Telegram notifications at 10% milestone intervals
6. After all rows: build valid-only CSV, upload to `validation-results` bucket at `jobs/{job_id}/valid.csv`
7. Mark job `completed` with `storage_path`; on any error mark `failed` with `error_message`

### New API Routes (Vercel/Next.js)

**`POST /api/validate/start`**: Parses CSV FormData, runs column detection (TIER1_NAMES, PERSONAL_SUBSTRINGS logic ported verbatim from old route), inserts `validation_jobs` + bulk inserts `validation_rows`, fire-and-forget invokes Edge Function with service role auth header, returns `{ job_id, total }`.

**`GET /api/validate/status?job_id=xxx`**: Reads `validation_jobs` row, returns `{ job_id, status, processed_rows, total_rows, valid_count, invalid_count, error_message, storage_path, filename }`.

**`GET /api/validate/results?job_id=xxx`**: If `storage_path` is set returns `{ signedUrl }` (3600s TTL). Otherwise queries `validation_rows WHERE status='valid'` and returns `text/csv` with email-per-line content.

### Updated EmailValidator.tsx

- `ValidationRun` interface updated to match `validation_jobs` schema (`filename`, `total_rows`, `processed_rows`, `status`, `error_message`, `storage_path`)
- `loadRuns` queries `validation_jobs` (not `email_validation_runs`)
- `submit()`: POSTs to `/api/validate/start`, polls `/api/validate/status` every 2s, maps new field names
- Handles `completed` (not `complete`) and `failed` (not `error`) status strings
- On completion: fetches CSV via signed URL if `storage_path` set, else via results API
- `handleDownload` and `copyRunForClay`: dual path (signed URL or results API) based on `storage_path`
- Previous Runs: status badges (amber pulse for `processing`, gray for `pending`, red for `failed`), Download/Copy disabled for non-completed runs
- Processing text updated from "n8n" to "Supabase Edge Function"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded supabase/functions from Next.js tsconfig**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** TypeScript compiler flagged `Deno.env`, `Deno.serve()` as unknown names since Deno globals don't exist in the Node.js TS environment
- **Fix:** Added `"supabase/functions"` to the `exclude` array in `tsconfig.json`
- **Files modified:** `tsconfig.json`
- **Commit:** 343d8ce

**2. [Rule 3 - Blocking] Cleared .next cache containing stale route type references**
- **Found during:** Task 3 verification (`npx tsc --noEmit`)
- **Issue:** `.next/dev/types/validator.ts` and `.next/types/validator.ts` still referenced the deleted `app/api/validate-emails/route.js` causing TS2307 errors
- **Fix:** `rm -rf .next` to clear Next.js build cache; TypeScript then compiled cleanly
- **Files modified:** None (build artifact removal)

**3. [Rule 2 - Security/Correctness] Service role client for DB inserts**
- **Found during:** Task 2 implementation review
- **Issue:** The server client uses anon key which could be blocked by RLS on `validation_jobs` inserts (no RLS policy defined yet for anon users)
- **Fix:** Created a separate `createServiceClient()` helper in `start/route.ts` that uses `SUPABASE_SERVICE_ROLE_KEY` for the insert operations only
- **Files modified:** `app/api/validate/start/route.ts`

## Deployment Notes

The migration files and Edge Function are written but not yet applied. The user must:

1. **Apply DB migrations** (choose one):
   - Run `supabase db push` after installing Supabase CLI
   - Or paste migration SQL directly into Supabase SQL editor

2. **Deploy Edge Function:**
   ```
   supabase functions deploy email-validator
   ```

3. **Set Edge Function env vars** in Supabase Dashboard → Edge Functions → email-validator → Secrets:
   - `MAILTESTER_API_KEY`
   - `TELEGRAM_BOT_TOKEN` (optional)
   - `TELEGRAM_CHAT_ID` (optional)
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically

4. **Set Vercel env var** (for start route to invoke Edge Function):
   - `SUPABASE_SERVICE_ROLE_KEY` (used in Authorization header for Edge Function invocation)

5. **Create storage bucket** `validation-results` in Supabase Dashboard → Storage (if it doesn't already exist from previous runs).

## Self-Check: PASSED

All key files verified present. Deleted old routes confirmed gone. All three task commits found.

| Check | Result |
|---|---|
| supabase/migrations/20260322000001_create_validation_tables.sql | FOUND |
| supabase/migrations/20260322000002_migrate_validation_runs.sql | FOUND |
| supabase/functions/email-validator/index.ts | FOUND |
| app/api/validate/start/route.ts | FOUND |
| app/api/validate/status/route.ts | FOUND |
| app/api/validate/results/route.ts | FOUND |
| components/EmailValidator.tsx | FOUND |
| app/api/validate-emails/route.ts | DELETED (confirmed) |
| npx tsc --noEmit | PASSED (0 errors) |
| Commit 789f1cb | Task 1: DB migrations + Edge Function |
| Commit 343d8ce | Task 2: New API routes + tsconfig fix |
| Commit 9d1ad72 | Task 3: EmailValidator.tsx + old routes deleted |
