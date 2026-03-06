export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import AdminClient from './admin-client'

export type UserProfile = {
  id: string
  email: string
  role: 'admin' | 'user'
  blocked: boolean
  created_at: string
}

export default async function AdminPage() {
  const { user } = await requireAdmin()

  const serviceClient = createServiceClient()
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, email, role, blocked, created_at')
    .order('created_at', { ascending: true })

  return (
    <AdminClient
      profiles={(profiles ?? []) as UserProfile[]}
      currentUserId={user.id}
    />
  )
}
