import type { SupabaseClient } from '@supabase/supabase-js'

export type RequestCount = {
  total: number
  /** True when `total` is the planner's estimate rather than an exact count. */
  isEstimated: boolean
}

export type RequestFilters = {
  method?: string | null
  from?: string | null
  to?: string | null
}

/**
 * Counts requests for an endpoint in bounded time.
 *
 * `{ count: 'exact' }` walks every matching row, which on a busy endpoint runs
 * past Supabase's 8s statement timeout. The `endpoint_request_count` function
 * counts exactly while the result set is small and falls back to the planner's
 * estimate once it isn't, so the cost no longer grows with the table.
 *
 * Requires the service client — the function is only granted to service_role,
 * so callers must have already verified endpoint ownership.
 */
export async function fetchRequestCount(
  client: SupabaseClient,
  endpointId: string,
  filters: RequestFilters = {}
): Promise<RequestCount> {
  const { data, error } = await client
    .rpc('endpoint_request_count', {
      p_endpoint_id: endpointId,
      p_method: filters.method ?? null,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
    })
    .returns<{ total: number | string; is_estimated: boolean }[]>()
    .single()

  if (error || !data) return { total: 0, isEstimated: false }

  return {
    total: Number(data.total) || 0,
    isEstimated: Boolean(data.is_estimated),
  }
}

/** Renders a count, marking estimates with a leading "~". */
export function formatCount(total: number, isEstimated = false): string {
  return `${isEstimated ? '~' : ''}${total.toLocaleString()}`
}
