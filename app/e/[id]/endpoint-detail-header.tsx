'use client'

import Link from 'next/link'
import CopyButton from '@/components/CopyButton'
import EndpointNameEditor from '@/components/EndpointNameEditor'

export default function EndpointDetailHeader({
  endpointId,
  initialName,
  webhookUrl,
}: {
  endpointId: string
  initialName: string | null
  webhookUrl: string
}) {
  return (
    <header className="border-b border-gray-700 px-4 py-2.5 flex items-center gap-3 shrink-0">
      <Link
        href="/dashboard"
        className="text-gray-500 hover:text-gray-200 text-xs transition-colors shrink-0"
      >
        ← dashboard
      </Link>
      <span className="text-gray-600 shrink-0">|</span>
      <EndpointNameEditor
        id={endpointId}
        initialName={initialName}
        className="text-green-400 font-bold text-sm"
      />
      <div className="flex-1" />
      {/* Webhook URL */}
      <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-1 shrink-0">
        <code className="text-xs text-gray-300 font-mono truncate max-w-xs">
          {webhookUrl}
        </code>
        <CopyButton text={webhookUrl} />
      </div>
    </header>
  )
}
