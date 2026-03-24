'use client'

import { useState } from 'react'
import MethodBadge from './MethodBadge'

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

type Tab = 'body' | 'headers' | 'query'

function tryPrettyJson(str: string | null): string {
  if (!str) return ''
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

export default function RequestDetail({ request }: { request: Request | null }) {
  const [tab, setTab] = useState<Tab>('body')

  if (!request) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        select a request to inspect
      </div>
    )
  }

  const prettyBody = tryPrettyJson(request.body)
  const headers = request.headers ?? {}
  const queryParams = request.query_params ?? {}
  const hasBody = !!request.body
  const hasQuery = Object.keys(queryParams).length > 0
  const hasHeaders = Object.keys(headers).length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Meta bar */}
      <div className="px-4 py-3 border-b border-gray-600 bg-gray-750">
        <div className="flex items-center gap-2 mb-1">
          <MethodBadge method={request.method} />
          <span className="text-gray-100 text-sm font-mono truncate">{request.path}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{new Date(request.created_at).toLocaleString()}</span>
          {request.ip && <span>from {request.ip}</span>}
          {request.content_type && (
            <span className="truncate">{request.content_type}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-600 bg-gray-800">
        {(['body', 'headers', 'query'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
              tab === t
                ? 'text-orange-400 border-b border-orange-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
            {t === 'body' && hasBody && (
              <span className="ml-1 text-[9px] text-orange-500">●</span>
            )}
            {t === 'query' && hasQuery && (
              <span className="ml-1 text-[9px] text-blue-400">●</span>
            )}
            {t === 'headers' && hasHeaders && (
              <span className="ml-1 text-[9px] text-gray-400">●</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 text-xs font-mono">
        {tab === 'body' && (
          <>
            {hasBody ? (
              <pre className="text-gray-100 whitespace-pre-wrap break-all leading-relaxed">
                {prettyBody}
              </pre>
            ) : (
              <span className="text-gray-500 italic">empty body</span>
            )}
          </>
        )}

        {tab === 'headers' && (
          <>
            {hasHeaders ? (
              <table className="w-full">
                <tbody>
                  {Object.entries(headers).map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-700">
                      <td className="py-1.5 pr-4 text-gray-400 whitespace-nowrap align-top w-1/3">
                        {k}
                      </td>
                      <td className="py-1.5 text-gray-100 break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="text-gray-500 italic">no headers</span>
            )}
          </>
        )}

        {tab === 'query' && (
          <>
            {hasQuery ? (
              <table className="w-full">
                <tbody>
                  {Object.entries(queryParams).map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-700">
                      <td className="py-1.5 pr-4 text-gray-400 whitespace-nowrap align-top w-1/3">
                        {k}
                      </td>
                      <td className="py-1.5 text-gray-100 break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="text-gray-500 italic">no query parameters</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
