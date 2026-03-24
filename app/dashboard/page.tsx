export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireUser } from '@/lib/auth'
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

  // Fetch request counts in parallel via service client (bypasses slow RLS correlated subquery)
  const serviceClient = createServiceClient()
  const counts = await Promise.all(
    epList.map((ep) =>
      serviceClient
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('endpoint_id', ep.id)
        .then(({ count }) => ({ id: ep.id, count: count ?? 0 }))
    )
  )
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]))

  const endpoints = epList.map((ep) => ({
    id: ep.id as string,
    name: ep.name as string | null,
    created_at: ep.created_at as string,
    requestCount: countMap[ep.id] ?? 0,
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
