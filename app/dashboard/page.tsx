export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { requireUser } from '@/lib/auth'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const { user, isAdmin } = await requireUser()
  const supabase = await createClient()

  const { data: rawEndpoints } = await supabase
    .from('endpoints')
    .select('id, name, created_at, requests(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const endpoints = (rawEndpoints ?? []).map((ep) => ({
    id: ep.id as string,
    name: ep.name as string | null,
    created_at: ep.created_at as string,
    requestCount: (ep.requests as unknown as { count: number }[])?.[0]?.count ?? 0,
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
