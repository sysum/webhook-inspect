'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { formatCount } from '@/lib/request-counts'
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

type DatePreset = '' | 'today' | '24h' | '7d' | '30d' | 'custom'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const PAGE_SIZE_OPTIONS = [50, 100, 200]

function getPresetRange(preset: Exclude<DatePreset, '' | 'custom'>): { from: string; to: string } {
  const now = new Date()
  switch (preset) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { from: start.toISOString(), to: now.toISOString() }
    }
    case '24h':
      return { from: new Date(now.getTime() - 86_400_000).toISOString(), to: now.toISOString() }
    case '7d':
      return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString(), to: now.toISOString() }
    case '30d':
      return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString(), to: now.toISOString() }
  }
}

export default function RequestList({
  endpointId,
  initialRequests,
  totalCount,
  totalCountEstimated = false,
}: {
  endpointId: string
  initialRequests: Request[]
  totalCount: number
  totalCountEstimated?: boolean
}) {
  // ── mode ────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'live' | 'history'>('live')
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  // ── live state ───────────────────────────────────────────────────────────
  const [liveRequests, setLiveRequests] = useState<Request[]>(initialRequests)
  const [connected, setConnected] = useState(false)

  // ── history state ────────────────────────────────────────────────────────
  const [historyRequests, setHistoryRequests] = useState<Request[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [filteredEstimated, setFilteredEstimated] = useState(false)
  const [grandTotal, setGrandTotal] = useState(totalCount)
  const [grandEstimated, setGrandEstimated] = useState(totalCountEstimated)
  const [loading, setLoading] = useState(false)

  // ── filters ──────────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>('')
  const [filterMethod, setFilterMethod] = useState('')
  // Custom date: inputFrom/To are the text field values; activeFrom/To drive the query
  const [inputFrom, setInputFrom] = useState('')
  const [inputTo, setInputTo] = useState('')
  const [activeCustomFrom, setActiveCustomFrom] = useState('')
  const [activeCustomTo, setActiveCustomTo] = useState('')

  // ── shared selection ─────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Request | null>(initialRequests[0] ?? null)

  const supabase = createClient()
  const listRef = useRef<HTMLDivElement>(null)

  // ── realtime subscription (always on) ───────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`requests:${endpointId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'requests', filter: `endpoint_id=eq.${endpointId}` },
        (payload) => {
          const newReq = payload.new as Request
          setLiveRequests((prev) => [newReq, ...prev])
          setGrandTotal((n) => n + 1)
          if (modeRef.current === 'live') setSelected(newReq)
        }
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [endpointId, supabase])

  // ── history fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'history') return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({
      page: String(historyPage),
      pageSize: String(pageSize),
    })
    if (filterMethod) params.set('method', filterMethod)
    if (datePreset === 'custom') {
      if (activeCustomFrom) params.set('from', new Date(activeCustomFrom + 'T00:00:00').toISOString())
      if (activeCustomTo) params.set('to', new Date(activeCustomTo + 'T23:59:59').toISOString())
    } else if (datePreset) {
      const range = getPresetRange(datePreset as Exclude<DatePreset, '' | 'custom'>)
      params.set('from', range.from)
      params.set('to', range.to)
    }

    fetch(`/api/endpoints/${endpointId}/requests?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        setHistoryRequests(json.data ?? [])
        setFilteredTotal(json.filteredTotal ?? 0)
        setFilteredEstimated(json.filteredTotalEstimated ?? false)
        setGrandTotal(json.grandTotal ?? 0)
        setGrandEstimated(json.grandTotalEstimated ?? false)
        setSelected(json.data?.[0] ?? null)
        listRef.current?.scrollTo({ top: 0 })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [mode, historyPage, pageSize, filterMethod, datePreset, activeCustomFrom, activeCustomTo, endpointId])

  // ── helpers ──────────────────────────────────────────────────────────────
  const hasFilters = datePreset !== '' || filterMethod !== ''

  function clearFilters() {
    setDatePreset('')
    setFilterMethod('')
    setInputFrom('')
    setInputTo('')
    setActiveCustomFrom('')
    setActiveCustomTo('')
    setHistoryPage(1)
  }

  function applyCustomDate() {
    setActiveCustomFrom(inputFrom)
    setActiveCustomTo(inputTo)
    setHistoryPage(1)
  }

  function switchMode(next: 'live' | 'history') {
    setMode(next)
    if (next === 'history') {
      setHistoryPage(1)
    } else {
      setSelected(liveRequests[0] ?? null)
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const displayRequests = mode === 'live' ? liveRequests : historyRequests
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize))

  return (
    <div className="flex flex-1 min-h-0">
      {/* ── Left pane ──────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-600 min-h-0">

        {/* Status bar */}
        <div className="px-3 py-2 border-b border-gray-600 flex items-center justify-between bg-gray-800 gap-2">
          <div className="text-xs text-gray-300 truncate min-w-0">
            {mode === 'live' ? (
              <>
                <span>{liveRequests.length}</span>
                <span className="text-gray-500"> / {formatCount(grandTotal, grandEstimated)} total</span>
              </>
            ) : hasFilters ? (
              <>
                <span>{formatCount(filteredTotal, filteredEstimated)} results</span>
                <span className="text-gray-500"> of {formatCount(grandTotal, grandEstimated)}</span>
              </>
            ) : (
              <span>{formatCount(grandTotal, grandEstimated)} total</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === 'live' && (
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-orange-400 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-[10px] text-gray-400">{connected ? 'live' : 'connecting…'}</span>
              </div>
            )}
            <button
              onClick={() => switchMode(mode === 'live' ? 'history' : 'live')}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap ${
                mode === 'history'
                  ? 'border-purple-500 text-purple-300 bg-purple-900/30'
                  : 'border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400'
              }`}
            >
              {mode === 'live' ? 'history' : '← live'}
            </button>
          </div>
        </div>

        {/* Filter bar — history mode only */}
        {mode === 'history' && (
          <div className="px-3 py-2 border-b border-gray-600 bg-gray-800/50 flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <select
                value={datePreset}
                onChange={(e) => { setDatePreset(e.target.value as DatePreset); setHistoryPage(1) }}
                className="flex-1 min-w-0 text-[11px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-orange-500"
              >
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom…</option>
              </select>
              <select
                value={filterMethod}
                onChange={(e) => { setFilterMethod(e.target.value); setHistoryPage(1) }}
                className="text-[11px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-orange-500 w-[74px] shrink-0"
              >
                <option value="">Method</option>
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {datePreset === 'custom' && (
              <div className="flex gap-1.5 items-center">
                <input
                  type="date"
                  value={inputFrom}
                  onChange={(e) => setInputFrom(e.target.value)}
                  className="flex-1 min-w-0 text-[11px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-orange-500"
                />
                <span className="text-gray-500 text-[11px] shrink-0">–</span>
                <input
                  type="date"
                  value={inputTo}
                  onChange={(e) => setInputTo(e.target.value)}
                  className="flex-1 min-w-0 text-[11px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={applyCustomDate}
                  className="text-[11px] px-2 py-1 bg-orange-700 hover:bg-orange-600 rounded text-white transition-colors shrink-0"
                >
                  go
                </button>
              </div>
            )}

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors text-left"
              >
                × clear filters
              </button>
            )}
          </div>
        )}

        {/* Request list */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-xs mt-8">loading…</div>
          ) : displayRequests.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-xs mt-8">
              {mode === 'live' ? 'waiting for requests…' : 'no requests found'}
            </div>
          ) : (
            displayRequests.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelected(req)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-700 transition-colors ${
                  selected?.id === req.id ? 'bg-gray-700' : 'hover:bg-gray-700/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method={req.method} />
                  <span className="text-gray-200 text-xs font-mono truncate">{req.path}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {formatTime(req.created_at)}
                  {req.ip && <span className="ml-2 text-gray-500">{req.ip}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination — history mode only */}
        {mode === 'history' && (
          <div className="px-3 py-2 border-t border-gray-600 bg-gray-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-1 py-0.5"
              >
                ←
              </button>
              <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                {historyPage} / {totalPages}
              </span>
              <button
                onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                disabled={historyPage >= totalPages}
                className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-1 py-0.5"
              >
                →
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setHistoryPage(1) }}
              className="text-[11px] bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-300 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}/pg</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Right pane ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-800">
        <RequestDetail request={selected} />
      </div>
    </div>
  )
}
