import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin()

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('profiles')
    .select('id, email, role, blocked, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
