import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { fetchRequestCount } from '@/lib/request-counts'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireUser()
  const { id } = await params
  const supabase = await createClient()

  // Verify ownership
  const { data: endpoint } = await supabase
    .from('endpoints')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sp = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const pageSize = Math.min(500, Math.max(10, parseInt(sp.get('pageSize') ?? '100')))
  const method = sp.get('method') ?? null
  const fromDate = sp.get('from') ?? null
  const toDate = sp.get('to') ?? null

  const serviceClient = createServiceClient()
  const filters = { method, from: fromDate, to: toDate }
  const offset = (page - 1) * pageSize

  // All three go through RPCs rather than PostgREST range/count. A plain
  // `.range()` at a deep offset made the planner drop the index for a seq scan
  // plus an on-disk sort, and `{ count: 'exact' }` walked every matching row —
  // either one alone could exceed the 8s statement timeout on a busy endpoint.
  const [{ data, error }, filtered, grand] = await Promise.all([
    serviceClient.rpc('get_endpoint_requests', {
      p_endpoint_id: id,
      p_limit: pageSize,
      p_offset: offset,
      p_method: method,
      p_from: fromDate,
      p_to: toDate,
    }),
    fetchRequestCount(serviceClient, id, filters),
    fetchRequestCount(serviceClient, id),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    filteredTotal: filtered.total,
    filteredTotalEstimated: filtered.isEstimated,
    grandTotal: grand.total,
    grandTotalEstimated: grand.isEstimated,
    page,
    pageSize,
  })
}
