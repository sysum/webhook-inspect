import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAdmin()
  const { id } = await params

  // Prevent admins from blocking themselves
  if (id === user.id) {
    return NextResponse.json({ error: 'You cannot block your own account.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const { blocked } = body

  if (typeof blocked !== 'boolean') {
    return NextResponse.json({ error: 'blocked must be a boolean' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('profiles')
    .update({ blocked })
    .eq('id', id)
    .select('id, email, role, blocked')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
