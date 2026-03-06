-- Run this in your Supabase SQL editor to set up the database

-- 1. Endpoints table
create table if not exists endpoints (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text,
  created_at timestamptz default now() not null
);

-- 2. Requests table
create table if not exists requests (
  id           uuid primary key default gen_random_uuid(),
  endpoint_id  uuid references endpoints(id) on delete cascade not null,
  created_at   timestamptz default now() not null,
  method       text not null,
  path         text,
  headers      jsonb,
  query_params jsonb,
  body         text,
  ip           text,
  content_type text
);

-- Indexes for common query patterns
create index if not exists requests_endpoint_id_created_at
  on requests (endpoint_id, created_at desc);

-- Row Level Security
alter table endpoints enable row level security;
alter table requests enable row level security;

-- Endpoints: users can only access their own
create policy "users_own_endpoints"
  on endpoints for all
  using (auth.uid() = user_id);

-- Requests: users can SELECT requests for endpoints they own
-- (INSERT is done via service role key, which bypasses RLS)
create policy "users_read_own_requests"
  on requests for select
  using (
    exists (
      select 1 from endpoints
      where id = endpoint_id
      and user_id = auth.uid()
    )
  );

-- Enable Realtime for the requests table
-- Run this to add the table to the realtime publication:
alter publication supabase_realtime add table requests;
