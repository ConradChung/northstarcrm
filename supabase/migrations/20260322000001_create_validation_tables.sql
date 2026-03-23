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
