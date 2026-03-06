import { createClient } from './supabase-server'
import { redirect } from 'next/navigation'

export type UserProfile = {
  role: 'admin' | 'user'
  blocked: boolean
}

/** Requires a logged-in, non-blocked user. Redirects otherwise. */
export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, blocked')
    .eq('id', user.id)
    .single()

  if (profile?.blocked) redirect('/blocked')

  return {
    user,
    role: (profile?.role ?? 'user') as 'admin' | 'user',
    isAdmin: profile?.role === 'admin',
  }
}

/** Requires an admin user. Redirects to /dashboard if not admin. */
export async function requireAdmin() {
  const result = await requireUser()
  if (!result.isAdmin) redirect('/dashboard')
  return result
}
