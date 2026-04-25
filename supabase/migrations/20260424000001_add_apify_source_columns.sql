alter table validation_jobs
  add column if not exists source text not null default 'csv'
    check (source in ('csv', 'apify')),
  add column if not exists filter_stats jsonb;

alter table validation_rows
  add column if not exists row_data jsonb;
