export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import CopyButton from '@/components/CopyButton'
import RequestList from '@/components/RequestList'

export default async function EndpointPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify ownership
  const { data: endpoint } = await supabase
    .from('endpoints')
    .select('id, name, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!endpoint) notFound()

  // Fetch last 200 requests
  const { data: requests } = await supabase
    .from('requests')
    .select('id, method, path, headers, query_params, body, ip, content_type, created_at')
    .eq('endpoint_id', id)
    .order('created_at', { ascending: false })
    .limit(200)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/w/${id}`

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <Link
          href="/dashboard"
          className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
        >
          ← dashboard
        </Link>
        <span className="text-gray-800">|</span>
        <span className="text-green-400 font-bold text-sm">
          {endpoint.name || <span className="text-gray-500 font-normal italic">unnamed endpoint</span>}
        </span>
        <div className="flex-1" />
        {/* Webhook URL */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-3 py-1">
          <code className="text-xs text-gray-400 font-mono truncate max-w-xs">
            {webhookUrl}
          </code>
          <CopyButton text={webhookUrl} />
        </div>
      </header>

      {/* Main — takes remaining height */}
      <RequestList
        endpointId={id}
        initialRequests={requests ?? []}
      />
    </div>
  )
}
