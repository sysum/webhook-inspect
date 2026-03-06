'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type Endpoint = {
  id: string
  name: string | null
  created_at: string
}

export default function DashboardClient({
  initialEndpoints,
  userEmail,
  isAdmin,
}: {
  initialEndpoints: Endpoint[]
  userEmail: string
  isAdmin: boolean
}) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>(initialEndpoints)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function createEndpoint() {
    setCreating(true)
    const res = await fetch('/api/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() || null }),
    })
    if (res.ok) {
      const ep: Endpoint = await res.json()
      setEndpoints((prev) => [ep, ...prev])
      setNewName('')
      setShowForm(false)
      router.push(`/e/${ep.id}`)
    }
    setCreating(false)
  }

  async function deleteEndpoint(id: string) {
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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="text-green-400 font-bold tracking-tight">webhook.inspect</span>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-xs">{userEmail}</span>
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="text-purple-400 hover:text-purple-300 text-xs transition-colors border border-purple-800 hover:border-purple-600 px-2 py-0.5 rounded"
            >
              admin
            </button>
          )}
          <button
            onClick={signOut}
            className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">endpoints</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-green-600 hover:bg-green-500 text-gray-950 text-xs font-bold py-1.5 px-4 rounded transition-colors"
          >
            + new endpoint
          </button>
        </div>

        {/* New endpoint form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createEndpoint()}
              placeholder="endpoint label (optional)"
              className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            />
            <button
              onClick={createEndpoint}
              disabled={creating}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-gray-950 text-xs font-bold px-4 rounded transition-colors"
            >
              {creating ? '...' : 'create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-gray-300 text-xs px-2 transition-colors"
            >
              cancel
            </button>
          </div>
        )}

        {/* Endpoint list */}
        {endpoints.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-4xl mb-3">⌘</div>
            <div className="text-sm">no endpoints yet — create one to get started</div>
          </div>
        ) : (
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-4 py-3 flex items-center gap-3 transition-colors"
              >
                <div
                  className="flex-1 cursor-pointer min-w-0"
                  onClick={() => router.push(`/e/${ep.id}`)}
                >
                  <div className="text-sm text-gray-100 truncate">
                    {ep.name || (
                      <span className="text-gray-500 italic">unnamed</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 font-mono mt-0.5 truncate">
                    /api/w/{ep.id}
                  </div>
                </div>
                <div className="text-xs text-gray-600 shrink-0">
                  {new Date(ep.created_at).toLocaleDateString()}
                </div>
                <button
                  onClick={() => router.push(`/e/${ep.id}`)}
                  className="text-green-500 hover:text-green-400 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  inspect →
                </button>
                <button
                  onClick={() => deleteEndpoint(ep.id)}
                  disabled={deletingId === ep.id}
                  className="text-red-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0 disabled:opacity-50"
                >
                  {deletingId === ep.id ? '...' : 'delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
