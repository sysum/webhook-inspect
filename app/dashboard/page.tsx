export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { requireUser } from '@/lib/auth'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const { user, isAdmin } = await requireUser()
  const supabase = await createClient()

  const { data: endpoints } = await supabase
    .from('endpoints')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <DashboardClient
      initialEndpoints={endpoints ?? []}
      userEmail={user.email ?? ''}
      isAdmin={isAdmin}
    />
  )
}
