create table if not exists password_attempt (
  id bigserial primary key,
  bucket text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists password_attempt_bucket_time_idx
  on password_attempt (bucket, attempted_at);
