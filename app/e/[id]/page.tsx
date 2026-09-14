export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/auth'
import { fetchRequestCount } from '@/lib/request-counts'
import { notFound } from 'next/navigation'
import EndpointDetailHeader from './endpoint-detail-header'
import RequestList from '@/components/RequestList'

export default async function EndpointPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user } = await requireUser()
  const supabase = await createClient()

  // Verify ownership
  const { data: endpoint } = await supabase
    .from('endpoints')
    .select('id, name, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!endpoint) notFound()

  const serviceClient = createServiceClient()

  // Fetch initial requests + total count in parallel via service client (avoids RLS overhead).
  // Both go through RPCs that stay on the covering index instead of scanning the table.
  const [{ data: requests }, totalCount] = await Promise.all([
    serviceClient.rpc('get_endpoint_requests', {
      p_endpoint_id: id,
      p_limit: 200,
      p_offset: 0,
    }),
    fetchRequestCount(serviceClient, id),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/w/${id}`

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <EndpointDetailHeader
        endpointId={id}
        initialName={endpoint.name}
        webhookUrl={webhookUrl}
      />
      <RequestList
        endpointId={id}
        initialRequests={requests ?? []}
        totalCount={totalCount.total}
        totalCountEstimated={totalCount.isEstimated}
      />
    </div>
  )
}
