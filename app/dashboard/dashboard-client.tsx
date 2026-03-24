'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import EndpointNameEditor from '@/components/EndpointNameEditor'

type Endpoint = {
  id: string
  name: string | null
  created_at: string
  requestCount: number
}

type SortKey = 'date' | 'name' | 'requests'

/** Minimal clipboard icon next to the /api/w/{id} path */
function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Copy webhook URL"
      className="shrink-0 text-gray-400 hover:text-orange-400 transition-colors"
    >
      {copied ? (
        <span className="text-orange-400 text-xs">✓</span>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

export default function DashboardClient({
  initialEndpoints,
  userEmail,
  isAdmin,
  appUrl,
}: {
  initialEndpoints: Endpoint[]
  userEmail: string
  isAdmin: boolean
  appUrl: string
}) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>(initialEndpoints)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const router = useRouter()
  const supabase = createClient()

  /** Clicking the active key toggles direction; clicking a new key resets to desc */
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let list = [...endpoints]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          (e.name ?? '').toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q),
      )
    }

    if (sortKey === 'date') {
      list.sort((a, b) => {
        const diff =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return sortDir === 'desc' ? diff : -diff
      })
    } else if (sortKey === 'name') {
      list.sort((a, b) => {
        const cmp = (a.name ?? '').localeCompare(b.name ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortKey === 'requests') {
      list.sort((a, b) => {
        const diff = b.requestCount - a.requestCount
        return sortDir === 'desc' ? diff : -diff
      })
    }

    return list
  }, [endpoints, search, sortKey, sortDir])

  async function createEndpoint() {
    setCreating(true)
    const res = await fetch('/api/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() || null }),
    })
    if (res.ok) {
      const ep = await res.json()
      setEndpoints((prev) => [{ ...ep, requestCount: 0 }, ...prev])
      setNewName('')
      setShowForm(false)
      router.push(`/e/${ep.id}`)
    }
    setCreating(false)
  }

  async function deleteEndpoint(id: string) {
    setConfirmDeleteId(null)
    setDeletingId(id)
    await fetch(`/api/endpoints/${id}`, { method: 'DELETE' })
    setEndpoints((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-orange-400 font-bold tracking-tight">webhook.inspect</span>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-xs">{userEmail}</span>
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="text-purple-400 hover:text-purple-300 text-xs transition-colors border border-purple-600 hover:border-purple-400 px-2 py-0.5 rounded"
            >
              admin
            </button>
          )}
          <button
            onClick={signOut}
            className="text-gray-300 hover:text-gray-100 text-xs transition-colors"
          >
            sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">endpoints</h1>
            <p className="text-gray-300 text-xs mt-0.5">
              {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-orange-600 hover:bg-orange-500 text-gray-950 text-xs font-bold py-1.5 px-4 rounded transition-colors"
          >
            + new endpoint
          </button>
        </div>

        {/* New endpoint form */}
        {showForm && (
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-4 flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createEndpoint()}
              placeholder="endpoint label (optional)"
              className="flex-1 bg-gray-700 border border-gray-500 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              onClick={createEndpoint}
              disabled={creating}
              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-gray-950 text-xs font-bold px-4 rounded transition-colors"
            >
              {creating ? '...' : 'create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-300 hover:text-gray-100 text-xs px-2 transition-colors"
            >
              cancel
            </button>
          </div>
        )}

        {/* Search + Sort bar */}
        {endpoints.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search endpoints…"
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-gray-400 text-xs">sort:</span>
              {(['date', 'name', 'requests'] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    sortKey === key
                      ? 'bg-gray-600 text-gray-100'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {key}
                  {sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Endpoint list */}
        {endpoints.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">⌘</div>
            <div className="text-sm">no endpoints yet — create one to get started</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            no endpoints match &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ep) => (
              <Link
                key={ep.id}
                href={`/e/${ep.id}`}
                className="group cursor-pointer bg-gray-800 border border-gray-600 hover:border-gray-500 hover:bg-gray-750 rounded-lg px-4 py-3 flex items-center gap-3 transition-colors"
              >
                {/* Name + path + creator */}
                <div className="flex-1 min-w-0">
                  <EndpointNameEditor
                    id={ep.id}
                    initialName={ep.name}
                    block
                    className="text-sm text-gray-100"
                  />
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="text-xs text-gray-400 font-mono truncate">
                      /api/w/{ep.id}
                    </div>
                    <CopyUrlButton url={`${appUrl}/api/w/${ep.id}`} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    created by {userEmail}
                  </div>
                </div>

                {/* Request count */}
                <div className="text-xs shrink-0 tabular-nums">
                  {ep.requestCount > 0 ? (
                    <span className="text-gray-200">
                      {ep.requestCount.toLocaleString()}
                      <span className="text-gray-400 ml-1">req</span>
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>

                {/* Date */}
                <div className="text-xs text-gray-400 shrink-0">
                  {new Date(ep.created_at).toLocaleDateString()}
                </div>

                {/* Delete — with inline confirm; always stop propagation */}
                {deletingId === ep.id ? (
                  <span className="text-gray-400 text-xs shrink-0">deleting…</span>
                ) : confirmDeleteId === ep.id ? (
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-gray-300">sure?</span>
                    <button
                      onClick={() => deleteEndpoint(ep.id)}
                      className="text-red-400 hover:text-red-300 text-xs transition-colors font-semibold"
                    >
                      yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-gray-400 hover:text-gray-200 text-xs transition-colors"
                    >
                      no
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(ep.id) }}
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    delete
                  </button>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 px-6 py-2 flex items-center justify-end shrink-0">
        <span className="text-gray-500 text-xs">v0.2.0 · last updated Mar 6, 2026</span>
      </footer>
    </div>
  )
}
