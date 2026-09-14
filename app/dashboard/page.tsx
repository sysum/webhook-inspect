export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/auth'
import { fetchRequestCount } from '@/lib/request-counts'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const { user, isAdmin } = await requireUser()
  const supabase = await createClient()

  const { data: rawEndpoints } = await supabase
    .from('endpoints')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const epList = rawEndpoints ?? []

  // Counts go through endpoint_request_count so a high-volume endpoint can't
  // blow the statement timeout — an exact count of ~550k rows took seconds, and
  // this page fires one request per endpoint at once.
  const serviceClient = createServiceClient()
  const counts = await Promise.all(
    epList.map(async (ep) => ({ id: ep.id, ...(await fetchRequestCount(serviceClient, ep.id)) }))
  )
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c]))

  const endpoints = epList.map((ep) => ({
    id: ep.id as string,
    name: ep.name as string | null,
    created_at: ep.created_at as string,
    requestCount: countMap[ep.id]?.total ?? 0,
    requestCountEstimated: countMap[ep.id]?.isEstimated ?? false,
  }))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <DashboardClient
      initialEndpoints={endpoints}
      userEmail={user.email ?? ''}
      isAdmin={isAdmin}
      appUrl={appUrl}
    />
  )
}
