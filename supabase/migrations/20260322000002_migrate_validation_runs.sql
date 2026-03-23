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
