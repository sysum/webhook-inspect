import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
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

  // Grand total — unfiltered
  const { count: grandTotal } = await serviceClient
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint_id', id)

  // Filtered + paginated data
  let query = serviceClient
    .from('requests')
    .select('id, method, path, headers, query_params, body, ip, content_type, created_at', { count: 'exact' })
    .eq('endpoint_id', id)
    .order('created_at', { ascending: false })

  if (method) query = query.eq('method', method.toUpperCase())
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate)

  const from_idx = (page - 1) * pageSize
  const { data, count: filteredTotal, error } = await query.range(from_idx, from_idx + pageSize - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    filteredTotal: filteredTotal ?? 0,
    grandTotal: grandTotal ?? 0,
    page,
    pageSize,
  })
}
