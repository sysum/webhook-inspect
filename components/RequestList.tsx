'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import MethodBadge from './MethodBadge'
import RequestDetail from './RequestDetail'

type Request = {
  id: string
  method: string
  path: string
  headers: Record<string, string> | null
  query_params: Record<string, string> | null
  body: string | null
  ip: string | null
  content_type: string | null
  created_at: string
}

export default function RequestList({
  endpointId,
  initialRequests,
}: {
  endpointId: string
  initialRequests: Request[]
}) {
  const [requests, setRequests] = useState<Request[]>(initialRequests)
  const [selected, setSelected] = useState<Request | null>(initialRequests[0] ?? null)
  const [connected, setConnected] = useState(false)
  const supabase = createClient()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`requests:${endpointId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'requests',
          filter: `endpoint_id=eq.${endpointId}`,
        },
        (payload) => {
          const newReq = payload.new as Request
          setRequests((prev) => [newReq, ...prev])
          setSelected(newReq)
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [endpointId, supabase])

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left pane — request list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-600 min-h-0">
        {/* Status bar */}
        <div className="px-3 py-2 border-b border-gray-600 flex items-center justify-between bg-gray-800">
          <span className="text-xs text-gray-300">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}
            />
            <span className="text-[10px] text-gray-400">
              {connected ? 'live' : 'connecting...'}
            </span>
          </div>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto bg-gray-850">
          {requests.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-xs mt-8">
              waiting for requests...
            </div>
          ) : (
            requests.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelected(req)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-700 transition-colors ${
                  selected?.id === req.id
                    ? 'bg-gray-700'
                    : 'hover:bg-gray-700/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method={req.method} />
                  <span className="text-gray-200 text-xs font-mono truncate">
                    {req.path}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {formatTime(req.created_at)}
                  {req.ip && (
                    <span className="ml-2 text-gray-500">{req.ip}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right pane — detail */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-800">
        <RequestDetail request={selected} />
      </div>
    </div>
  )
}
