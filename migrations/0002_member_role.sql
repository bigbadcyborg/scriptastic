create table if not exists member_role (
  user_id text primary key references "user" ("id") on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);
