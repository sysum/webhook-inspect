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

-- Indexes for common query patterns.
-- `id` is carried as an INCLUDE payload so the "which rows are on this page"
-- lookup can run as an index-only scan (see get_endpoint_requests below).
create index if not exists requests_endpoint_created_covering
  on requests (endpoint_id, created_at desc) include (id);

-- requests is insert-only and high volume; keep the visibility map and planner
-- statistics fresh so index-only scans stay heap-free and estimates stay close.
alter table requests set (
  autovacuum_vacuum_insert_scale_factor = 0.02,
  autovacuum_analyze_scale_factor       = 0.02
);

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

-- -------------------------------------------------------
-- 3. Profiles table (role + blocked status per user)
-- -------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'user' check (role in ('admin', 'user')),
  blocked    boolean not null default false,
  created_at timestamptz default now() not null
);

alter table profiles enable row level security;

-- Users can read their own profile (needed for blocked/role check in server components)
create policy "users_read_own_profile"
  on profiles for select
  using (auth.uid() = id);

-- Note: all profile writes (insert, update) are done via the service role key
-- in API routes, which bypasses RLS. No additional policies are needed for writes.

-- -------------------------------------------------------
-- 4. Bounded counting and pagination
-- -------------------------------------------------------
-- See supabase/migrations/0001_scale_request_counts_and_pagination.sql for the
-- full rationale. Short version: `{ count: 'exact' }` and deep LIMIT/OFFSET are
-- both O(table), and on an endpoint with hundreds of thousands of requests they
-- exceeded Supabase's 8s statement timeout (SQLSTATE 57014).

-- Exact while the result set is small, planner estimate once it isn't.
create or replace function public.endpoint_request_count(
  p_endpoint_id uuid,
  p_method      text        default null,
  p_from        timestamptz default null,
  p_to          timestamptz default null,
  p_exact_max   bigint      default 25000
)
returns table (total bigint, is_estimated boolean)
language plpgsql
-- volatile (the default): EXPLAIN is not permitted inside a STABLE function.
set search_path = public, pg_temp
as $$
declare
  v_sql  text;
  v_plan json;
  v_est  bigint;
begin
  v_sql := format(
    'select 1 from public.requests where endpoint_id = %L',
    p_endpoint_id
  );

  if p_method is not null then
    v_sql := v_sql || format(' and method = %L', upper(p_method));
  end if;
  if p_from is not null then
    v_sql := v_sql || format(' and created_at >= %L::timestamptz', p_from);
  end if;
  if p_to is not null then
    v_sql := v_sql || format(' and created_at <= %L::timestamptz', p_to);
  end if;

  execute 'explain (format json) ' || v_sql into v_plan;
  v_est := coalesce((v_plan -> 0 -> 'Plan' ->> 'Plan Rows')::bigint, 0);

  if v_est <= p_exact_max then
    execute 'select count(*) from (' || v_sql || ') c' into total;
    is_estimated := false;
  else
    total := v_est;
    is_estimated := true;
  end if;

  return next;
end;
$$;

-- Resolves the page's ids index-only, then fetches wide columns by primary key,
-- so skipped rows never reach the heap and the planner stays off the seq scan.
create or replace function public.get_endpoint_requests(
  p_endpoint_id uuid,
  p_limit       int         default 100,
  p_offset      int         default 0,
  p_method      text        default null,
  p_from        timestamptz default null,
  p_to          timestamptz default null
)
returns table (
  id           uuid,
  method       text,
  path         text,
  headers      jsonb,
  query_params jsonb,
  body         text,
  ip           text,
  content_type text,
  created_at   timestamptz
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_where text;
begin
  v_where := format('where q.endpoint_id = %L', p_endpoint_id);

  if p_method is not null then
    v_where := v_where || format(' and q.method = %L', upper(p_method));
  end if;
  if p_from is not null then
    v_where := v_where || format(' and q.created_at >= %L::timestamptz', p_from);
  end if;
  if p_to is not null then
    v_where := v_where || format(' and q.created_at <= %L::timestamptz', p_to);
  end if;

  return query execute format(
    'select r.id, r.method, r.path, r.headers, r.query_params,
            r.body, r.ip, r.content_type, r.created_at
       from public.requests r
       join (select q.id
               from public.requests q
               %s
              order by q.created_at desc
              limit %s offset %s) s on s.id = r.id
      order by r.created_at desc',
    v_where,
    greatest(p_limit, 0),
    greatest(p_offset, 0)
  );
end;
$$;

-- Neither function checks endpoint ownership, so both are service-role only.
-- Every caller is a server route that has already verified the signed-in user
-- owns the endpoint.
-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- and authenticated explicitly, so revoking from PUBLIC alone is not enough —
-- those roles have to be named.
revoke all on function public.endpoint_request_count(uuid, text, timestamptz, timestamptz, bigint)
  from public, anon, authenticated;
revoke all on function public.get_endpoint_requests(uuid, int, int, text, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.endpoint_request_count(uuid, text, timestamptz, timestamptz, bigint) to service_role;
grant execute on function public.get_endpoint_requests(uuid, int, int, text, timestamptz, timestamptz) to service_role;
