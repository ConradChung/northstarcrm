---
phase: 1-batch-email-validation-pipeline-replace
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260322000001_create_validation_tables.sql
  - supabase/migrations/20260322000002_migrate_validation_runs.sql
  - supabase/functions/email-validator/index.ts
  - app/api/validate/start/route.ts
  - app/api/validate/status/route.ts
  - app/api/validate/results/route.ts
  - components/EmailValidator.tsx
  - app/api/validate-emails/route.ts (deleted)
  - app/api/validate-emails/status/[runId]/route.ts (deleted)
autonomous: true
requirements:
  - REPLACE-01
must_haves:
  truths:
    - "Uploading a CSV creates a validation_jobs row and returns a job_id"
    - "GET /api/validate/status?job_id=xxx returns processed_rows, total_rows, valid_count, status"
    - "Supabase Edge Function processes all pending validation_rows via MailTester Ninja, updates job status to completed, uploads valid-only CSV to storage"
    - "EmailValidator.tsx polls /api/validate/status every 2s and shows live progress"
    - "Previous Runs section queries validation_jobs (not email_validation_runs)"
    - "Download works: storage_path present → signed URL; storage_path absent → results API CSV"
    - "Old /api/validate-emails routes are removed"
    - "Migrated email_validation_runs rows appear in Previous Runs with completed status"
  artifacts:
    - path: "supabase/migrations/20260322000001_create_validation_tables.sql"
      provides: "validation_jobs and validation_rows table definitions"
    - path: "supabase/migrations/20260322000002_migrate_validation_runs.sql"
      provides: "Migration of email_validation_runs into validation_jobs"
    - path: "supabase/functions/email-validator/index.ts"
      provides: "Deno Edge Function: receives job_id, validates rows via MailTester, uploads result CSV"
    - path: "app/api/validate/start/route.ts"
      provides: "POST: parse CSV, insert job+rows, fire-and-forget Edge Function call"
    - path: "app/api/validate/status/route.ts"
      provides: "GET: read validation_jobs row for progress"
    - path: "app/api/validate/results/route.ts"
      provides: "GET: build+return valid-only CSV from validation_rows"
    - path: "components/EmailValidator.tsx"
      provides: "Updated UI: new API paths, validation_jobs table, status badges"
  key_links:
    - from: "app/api/validate/start/route.ts"
      to: "supabase Edge Function"
      via: "fire-and-forget fetch to https://rcfrumrbauwvyzfebxck.supabase.co/functions/v1/email-validator"
    - from: "supabase/functions/email-validator/index.ts"
      to: "validation_jobs + validation_rows"
      via: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars, direct Supabase REST/PostgREST"
    - from: "components/EmailValidator.tsx"
      to: "/api/validate/status"
      via: "setInterval every 2000ms polling on job_id"
---

<objective>
Replace the n8n-based email validation pipeline with a Supabase Edge Function architecture. The Edge Function runs inside Supabase with no timeout constraint. Vercel handles only lightweight job creation + status polling. All existing UI (RingChart, dark theme, Copy for Clay, Previous Runs, download) is preserved — changes are additive.

Purpose: Eliminate Vercel timeout risk by offloading long-running MailTester API calls to Supabase Edge Functions.
Output: New DB tables, Edge Function, 3 lightweight API routes, updated EmailValidator.tsx, old routes removed.
</objective>

<execution_context>
@/Users/conradchung/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/conradchung/northstarcrm/app/api/validate-emails/route.ts
@/Users/conradchung/northstarcrm/app/api/validate-emails/status/[runId]/route.ts
@/Users/conradchung/northstarcrm/components/EmailValidator.tsx
@/Users/conradchung/northstarcrm/lib/supabase/server.ts
@/Users/conradchung/northstarcrm/lib/supabase/client.ts

<interfaces>
<!-- Existing patterns to carry forward -->

From app/api/validate-emails/route.ts — port these functions verbatim into start/route.ts:
```typescript
const TIER1_NAMES = new Set(['email', 'work_email', 'business_email'])
const PERSONAL_SUBSTRINGS = ['personal']
function normalizeHeader(h: string): string { ... }
function detectEmailColumn(headers: string[]): { column: string } | { ambiguous: string[] } | { error: string } { ... }
function parseCSVRow(row: string): string[] { ... }
function parseCSV(text: string): { headers: string[]; rows: string[][] } { ... }
```

From current EmailValidator.tsx — keep ALL of this unchanged:
- RingChart component (lines 24-88)
- Step type: 'upload' | 'ambiguous' | 'processing' | 'done' | 'error'
- handleUpload, handleFileChange, handleColumnSelect, downloadCurrent, copyForClay, csvToTsv, reset functions
- All JSX/UI structure and Tailwind classes
- Props interface: { onStatusChange? }
- copyRunForClay, handleDownload signatures (update internals only for new table shape)

New ValidationRun interface (replaces old one):
```typescript
interface ValidationRun {
  id: string
  filename: string       // was file_name
  total_rows: number     // was total
  valid_count: number
  invalid_count: number
  processed_rows: number // was processed
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  storage_path: string | null
  created_at: string
}
```

Supabase project URL: https://rcfrumrbauwvyzfebxck.supabase.co
MailTester API: https://happy.mailtester.ninja/ninja?email=${email}&key=${MAILTESTER_API_KEY}
Telegram pattern: same as existing route.ts (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID env vars)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Database migrations and Supabase Edge Function</name>
  <files>
    supabase/migrations/20260322000001_create_validation_tables.sql
    supabase/migrations/20260322000002_migrate_validation_runs.sql
    supabase/functions/email-validator/index.ts
  </files>
  <action>
Create the supabase/ directory structure manually (Supabase CLI not installed — files are for manual deploy via `supabase db push` or Supabase SQL editor).

**Migration 1: supabase/migrations/20260322000001_create_validation_tables.sql**

```sql
create table if not exists validation_jobs (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  total_rows int not null,
  processed_rows int not null default 0,
  valid_count int not null default 0,
  invalid_count int not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  error_message text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists validation_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references validation_jobs(id) on delete cascade,
  email text not null,
  row_index int not null,
  status text not null default 'pending' check (status in ('pending','valid','invalid','error')),
  validation_result jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_validation_rows_job_status on validation_rows(job_id, status);

-- Auto-update updated_at on validation_jobs
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_validation_jobs_updated_at on validation_jobs;
create trigger set_validation_jobs_updated_at
  before update on validation_jobs
  for each row execute function update_updated_at_column();
```

**Migration 2: supabase/migrations/20260322000002_migrate_validation_runs.sql**

Migrate completed runs from email_validation_runs → validation_jobs. Only rows with storage_path set (completed runs). Do NOT create validation_rows for migrated runs.

```sql
insert into validation_jobs (
  id,
  filename,
  total_rows,
  processed_rows,
  valid_count,
  invalid_count,
  status,
  storage_path,
  created_at,
  updated_at
)
select
  id,
  file_name as filename,
  total as total_rows,
  coalesce(processed, total) as processed_rows,
  coalesce(valid_count, 0) as valid_count,
  coalesce(total - valid_count, 0) as invalid_count,
  'completed' as status,
  storage_path,
  created_at,
  now() as updated_at
from email_validation_runs
where storage_path is not null and storage_path != ''
on conflict (id) do nothing;
```

**Edge Function: supabase/functions/email-validator/index.ts**

Deno TypeScript. Uses Supabase env vars injected automatically (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Reads `MAILTESTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` from env.

Structure:
1. Parse POST body for `{ job_id }`. Return 400 if missing.
2. Create Supabase client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` via native fetch (no npm client needed — use PostgREST REST API directly with `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` and `apikey: ${SUPABASE_SERVICE_ROLE_KEY}` headers and Content-Type application/json).
3. Set job status to 'processing'.
4. Helper `supabaseRequest(method, path, body?)` — wraps fetch to `${SUPABASE_URL}/rest/v1/${path}` with correct headers (`apikey`, `Authorization Bearer`, `Content-Type`, `Prefer: return=minimal` for mutations).
5. Helper `validateEmail(email: string): Promise<{ valid: boolean; result: object }>` — fetch MailTester URL, return parsed JSON. Treat HTTP errors as `{ valid: false, result: { error } }`.
6. Helper `sendTelegram(message: string)` — POST to Telegram Bot API if tokens set.
7. Main loop: fetch 50 pending rows at a time (`GET /rest/v1/validation_rows?job_id=eq.${job_id}&status=eq.pending&order=row_index.asc&limit=50`). For each row:
   - Call validateEmail
   - PATCH `/rest/v1/validation_rows?id=eq.${row.id}` with `{ status: valid?'valid':'invalid', validation_result: result, processed_at: new Date().toISOString() }`
   - PATCH `/rest/v1/validation_jobs?id=eq.${job_id}` with `{ processed_rows: currentProcessed, valid_count: currentValid, invalid_count: currentInvalid }`
   - Check milestone (10%, 20%...100%) and send Telegram notification. Track last notified milestone to avoid duplicate sends.
   - Await 100ms between calls to avoid rate-limit hammering.
8. After all rows processed: fetch all valid rows, build CSV (headers: email + any result fields like deliverable, domain), upload to `validation-results` bucket at path `jobs/${job_id}/valid.csv` using Storage API (`POST /storage/v1/object/validation-results/jobs/${job_id}/valid.csv`).
9. PATCH job: `{ status: 'completed', storage_path: 'jobs/${job_id}/valid.csv' }`.
10. Wrap entire flow in try/catch — on error: PATCH job `{ status: 'failed', error_message: err.message }`.
11. Return 200 immediately after kicking off the async work — use `EdgeRuntime.waitUntil(asyncWork)` pattern so Supabase Edge Function doesn't time out waiting for response.

CSV build: header row is `email`, then for each valid row emit `row.email`. If validation_result contains a `deliverable` field, include it. Keep simple — just email column is fine if result shape is unclear.

Telegram milestone messages: `Email validation ${pct}% complete (${processed}/${total}) — ${valid} valid so far.`
  </action>
  <verify>
    Files exist at correct paths. SQL is valid (no syntax errors visible). Edge Function has no TypeScript errors in structure (can't run locally without Deno). Manual check: confirm `supabase/migrations/` directory exists with both .sql files and `supabase/functions/email-validator/index.ts` exists.
  </verify>
  <done>
    - supabase/migrations/20260322000001_create_validation_tables.sql creates validation_jobs and validation_rows with correct schema
    - supabase/migrations/20260322000002_migrate_validation_runs.sql migrates completed email_validation_runs rows
    - supabase/functions/email-validator/index.ts is complete Deno TypeScript: receives job_id, processes rows via MailTester, updates DB after each row, sends Telegram milestones, uploads valid CSV to storage, sets job status completed or failed
  </done>
</task>

<task type="auto">
  <name>Task 2: New Vercel API routes (start, status, results)</name>
  <files>
    app/api/validate/start/route.ts
    app/api/validate/status/route.ts
    app/api/validate/results/route.ts
  </files>
  <action>
Create three lightweight Next.js API routes under `app/api/validate/`. Use `import { createClient } from '@/lib/supabase/server'` (service role key not needed here — anon key + RLS is fine for reading/inserting, but note: for insert into validation_jobs we may need service role. Use the server client as-is since current app does the same pattern; if RLS blocks inserts add `SUPABASE_SERVICE_ROLE_KEY` fallback).

**app/api/validate/start/route.ts**

Port `TIER1_NAMES`, `PERSONAL_SUBSTRINGS`, `normalizeHeader`, `detectEmailColumn`, `parseCSVRow`, `parseCSV` verbatim from the old `app/api/validate-emails/route.ts`.

POST handler:
1. Parse FormData: `file` (File), `column` (string | null).
2. Read file text, parseCSV.
3. If no column override: run detectEmailColumn. Return `{ status: 'ambiguous', columns }` or `{ error }` as needed.
4. If column override: validate it exists in headers.
5. Generate `job_id = crypto.randomUUID()`.
6. Insert into `validation_jobs`: `{ id: job_id, filename: file.name, total_rows: rows.length, status: 'pending' }`.
7. Bulk insert `validation_rows`: build array of `{ job_id, email: row[colIndex], row_index: i, status: 'pending' }` for all rows. Use a single insert call (Supabase supports array insert).
8. Fire-and-forget fetch to Edge Function: `fetch('https://rcfrumrbauwvyzfebxck.supabase.co/functions/v1/email-validator', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }, body: JSON.stringify({ job_id }) }).catch(...)`.
9. Return `NextResponse.json({ job_id, total: rows.length })`.

Error handling: wrap in try/catch, return `{ error: msg }` with appropriate status.

**app/api/validate/status/route.ts**

GET handler, reads `job_id` from `request.nextUrl.searchParams`:
1. Query `validation_jobs` by id.
2. Return: `{ job_id, status, processed_rows, total_rows, valid_count, invalid_count, error_message, storage_path, filename }`.
3. 404 if not found.

**app/api/validate/results/route.ts**

GET handler, reads `job_id` from search params:
1. If job's `storage_path` is set: generate signed URL from `validation-results` bucket and redirect or return `{ signedUrl }`.
2. Else: query `validation_rows WHERE job_id=x AND status='valid'`, build CSV (header: `email`, rows: one email per line), return as `text/csv` with `Content-Disposition: attachment; filename="validated_emails.csv"`.
3. 404 if job not found.
  </action>
  <verify>
    TypeScript compiles without errors: `npx tsc --noEmit` from project root (or `next build` dry-run). Check that all three route files exist and import paths resolve.
  </verify>
  <done>
    - POST /api/validate/start parses CSV, detects column (with ambiguous handling), inserts validation_jobs + validation_rows, fires Edge Function, returns { job_id, total }
    - GET /api/validate/status?job_id=xxx returns job progress fields
    - GET /api/validate/results?job_id=xxx returns either signed URL JSON or valid-only CSV text
    - All routes use createClient from @/lib/supabase/server
  </done>
</task>

<task type="auto">
  <name>Task 3: Update EmailValidator.tsx and remove old routes</name>
  <files>
    components/EmailValidator.tsx
    app/api/validate-emails/route.ts (delete)
    app/api/validate-emails/status/[runId]/route.ts (delete)
  </files>
  <action>
**Update components/EmailValidator.tsx**

Keep ALL existing UI, RingChart, styling, and non-submit logic. Make these targeted changes:

1. **Update `ValidationRun` interface** (top of file) to match `validation_jobs` schema:
```typescript
interface ValidationRun {
  id: string
  filename: string
  total_rows: number
  valid_count: number
  invalid_count: number
  processed_rows: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  storage_path: string | null
  created_at: string
}
```

2. **Add `jobIdRef`**: `const jobIdRef = useRef<string | null>(null)` to track current job_id during polling.

3. **Update `loadRuns`**: Query `validation_jobs` instead of `email_validation_runs`. Change `.from('email_validation_runs')` → `.from('validation_jobs')`. Keep `.order('created_at', { ascending: false }).limit(20)`.

4. **Update `submit()`**:
   - Change fetch URL from `/api/validate-emails` → `/api/validate/start`
   - On success: extract `job_id` (not `runId`) from response. Store in `jobIdRef.current = job_id`.
   - Change `{ runId, total }` → `{ job_id, total }`. Set `progress({ processed: 0, total })`.
   - Change polling fetch from `/api/validate-emails/status/${runId}` → `/api/validate/status?job_id=${job_id}`
   - Change polling interval from 3000 → 2000ms
   - Map poll response fields: `poll.processed_rows` (not `poll.processed`), `poll.total_rows` (not `poll.total`), `poll.valid_count` stays same
   - Change status check: `poll.status === 'completed'` (not `'complete'`), `poll.status === 'failed'` (not `'error'`)
   - On completed: if `poll.storage_path` is set, fetch signed URL via results API or directly via Supabase client; else fetch `/api/validate/results?job_id=${job_id}` as text and set `validCsv`.
   - On completed without storage_path: `const csvRes = await fetch('/api/validate/results?job_id=${job_id}'); setValidCsv(await csvRes.text())`
   - On completed with storage_path: `const { data } = await supabase.storage.from('validation-results').createSignedUrl(poll.storage_path, 3600); const csvRes = await fetch(data.signedUrl); setValidCsv(await csvRes.text())`
   - On failed: `setError(poll.error_message || 'Validation failed in Edge Function.')` then `setStep('error')`
   - Update processing status text: change "running on n8n" → "running on Supabase Edge Function"

5. **Update `handleDownload(run)`**: Change `run.storage_path` check — if `run.storage_path` is non-null/non-empty, use signed URL (same as before). Keep the existing `supabase.storage.from('validation-results').createSignedUrl(run.storage_path, 3600)` call. If no storage_path, fetch from `/api/validate/results?job_id=${run.id}` and trigger blob download.

6. **Update `copyRunForClay(run)`**: Same logic as handleDownload for source — if storage_path, use signed URL; else fetch results API text.

7. **Update Previous Runs rendering**: Update field references in the runs.map():
   - `run.file_name` → `run.filename`
   - `run.total` → `run.total_rows`
   - Keep `run.valid_count` unchanged
   - Add status badge next to filename:
     - `status === 'processing'`: amber dot + "Validating…" text (animated pulse)
     - `status === 'failed'`: red dot + "Failed" text, show `run.error_message` in tooltip or below
     - `status === 'pending'`: gray dot + "Queued"
     - `status === 'completed'`: no badge (existing UI is sufficient)
   - For `status !== 'completed'`: disable Download and Copy for Clay buttons (add `disabled={run.status !== 'completed'}`)

**Remove old routes**

Delete these two files (do not leave them in place):
- `app/api/validate-emails/route.ts`
- `app/api/validate-emails/status/[runId]/route.ts`

If deleting the files would leave an empty `app/api/validate-emails/` directory tree, also remove those empty directories.
  </action>
  <verify>
    `npx tsc --noEmit` passes with no errors on EmailValidator.tsx. Old route files no longer exist at their paths. Verify: `ls app/api/validate-emails/` should return "not found" or the directory should be gone.
  </verify>
  <done>
    - EmailValidator.tsx uses /api/validate/start and /api/validate/status with 2s polling interval
    - ValidationRun interface matches validation_jobs schema (filename, total_rows, processed_rows, status, storage_path nullable)
    - Previous Runs queries validation_jobs, shows status badges for pending/processing/failed
    - Download/Copy for Clay disabled for non-completed runs
    - Download handles both storage_path (signed URL) and no storage_path (results API) cases
    - Old /api/validate-emails/ route files deleted
    - All existing UI unchanged: RingChart, dark theme, ambiguous column flow, copy-for-clay, reset
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. Check file structure:
   - `ls supabase/migrations/` — two .sql files present
   - `ls supabase/functions/email-validator/` — index.ts present
   - `ls app/api/validate/` — start/, status/, results/ directories each with route.ts
   - `ls app/api/validate-emails/` — should NOT exist (deleted)

2. TypeScript check:
   - `npx tsc --noEmit` — no errors

3. Spot-check SQL migration 1 contains: `create table validation_jobs`, `create table validation_rows`, foreign key constraint, status check constraints.

4. Spot-check migration 2 contains: `insert into validation_jobs ... select ... from email_validation_runs where storage_path is not null`.

5. Spot-check Edge Function contains: MailTester fetch, sequential row processing loop, Telegram milestone sends, storage upload, job status PATCH to completed/failed.

6. Manual deployment steps (do NOT run — these require Supabase CLI):
   ```
   # User runs these after installing Supabase CLI:
   supabase db push
   supabase functions deploy email-validator
   # Also set env vars in Supabase dashboard:
   # MAILTESTER_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
   ```
</verification>

<success_criteria>
- All three new API routes exist and TypeScript compiles cleanly
- Both migration SQL files are valid and complete
- Edge Function is complete Deno TypeScript (no runtime errors detectable from static review)
- EmailValidator.tsx polls /api/validate/status every 2s, maps validation_jobs fields correctly, shows status badges
- Old /api/validate-emails routes are deleted
- `npx tsc --noEmit` exits 0
</success_criteria>

<output>
After completion, create `.planning/quick/1-batch-email-validation-pipeline-replace-/1-SUMMARY.md` summarizing what was built, key decisions made, and any notes for future reference.
</output>
