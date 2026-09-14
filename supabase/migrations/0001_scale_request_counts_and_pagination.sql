-- Fixes "canceling statement due to statement timeout" (SQLSTATE 57014) on the
-- dashboard, the endpoint detail page and the History view.
--
-- Two separate O(table) operations were running on every page view against the
-- 8s statement_timeout that Supabase sets on the `authenticator` role:
--
--   1. PostgREST `count=exact` (supabase-js `{ count: 'exact' }`) fully counts
--      every matching row. On an endpoint with ~550k requests that is seconds
--      of work, and the dashboard fired one per endpoint in parallel.
--   2. Deep `LIMIT/OFFSET` paging made the planner abandon the index in favour
--      of a sequential scan plus an on-disk sort (~10s at offset 400k).
--
-- Both are replaced with bounded work below.

-- ---------------------------------------------------------------------------
-- 1. Covering index
-- ---------------------------------------------------------------------------
-- Adding `id` as an INCLUDE payload lets the "which rows are on this page"
-- lookup run as an index-only scan, so paging never touches the heap for rows
-- it is about to discard. Supersedes requests_endpoint_id_created_at, which had
-- the same leading columns.
create index if not exists requests_endpoint_created_covering
  on public.requests (endpoint_id, created_at desc) include (id);

drop index if exists public.requests_endpoint_id_created_at;

-- Keep the visibility map current so index-only scans stay heap-free. The table
-- is insert-only and high volume, so the default insert scale factor lets far
-- too many pages go unmarked between autovacuums.
alter table public.requests set (
  autovacuum_vacuum_insert_scale_factor = 0.02,
  autovacuum_analyze_scale_factor       = 0.02
);

-- ---------------------------------------------------------------------------
-- 2. endpoint_request_count() — bounded count
-- ---------------------------------------------------------------------------
-- Asks the planner how many rows match. Below p_exact_max an exact count is
-- cheap, so we run one and report an exact number; above it we return the
-- planner's estimate, which is O(1) regardless of table size. The caller is
-- told which it got so the UI can render "~" for an estimate.
--
-- Predicates are appended only when supplied, so each filter combination gets a
-- plan built for the literals actually used rather than a generic cached plan.
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

-- ---------------------------------------------------------------------------
-- 3. get_endpoint_requests() — offset paging that stays on the index
-- ---------------------------------------------------------------------------
-- Resolves the page's ids first (index-only, no heap access for skipped rows),
-- then fetches the wide columns for just those ids by primary key. This keeps
-- the planner on the index instead of switching to a seq scan + external sort.
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

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------
-- Both functions read across endpoints without an ownership check, so they are
-- reachable only by the service role. Every caller is a server route that has
-- already verified the signed-in user owns the endpoint.
-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- and authenticated explicitly, so revoking from PUBLIC alone is not enough —
-- those roles have to be named.
revoke all on function public.endpoint_request_count(uuid, text, timestamptz, timestamptz, bigint)
  from public, anon, authenticated;
revoke all on function public.get_endpoint_requests(uuid, int, int, text, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.endpoint_request_count(uuid, text, timestamptz, timestamptz, bigint) to service_role;
grant execute on function public.get_endpoint_requests(uuid, int, int, text, timestamptz, timestamptz) to service_role;
