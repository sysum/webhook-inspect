'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserProfile } from './page'

export default function AdminClient({
  profiles: initialProfiles,
  currentUserId,
}: {
  profiles: UserProfile[]
  currentUserId: string
}) {
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfiles)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()

  async function toggleBlock(profile: UserProfile) {
    setLoadingId(profile.id)
    const res = await fetch(`/api/admin/users/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: !profile.blocked }),
    })

    if (res.ok) {
      const updated: UserProfile = await res.json()
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
    }
    setLoadingId(null)
  }

  const admins = profiles.filter((p) => p.role === 'admin')
  const users = profiles.filter((p) => p.role === 'user')

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-600 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-300 hover:text-gray-100 text-xs transition-colors"
        >
          ← dashboard
        </button>
        <span className="text-gray-500">|</span>
        <span className="text-purple-400 font-bold text-sm">admin</span>
        <span className="ml-2 text-[10px] text-purple-300 border border-purple-600 rounded px-1.5 py-0.5 uppercase tracking-wider">
          {profiles.length} user{profiles.length !== 1 ? 's' : ''}
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Admins */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">
            admins ({admins.length})
          </h2>
          <div className="space-y-1">
            {admins.map((profile) => (
              <UserRow
                key={profile.id}
                profile={profile}
                isSelf={profile.id === currentUserId}
                loading={loadingId === profile.id}
                onToggle={toggleBlock}
              />
            ))}
          </div>
        </section>

        {/* Users */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">
            users ({users.length})
          </h2>
          {users.length === 0 ? (
            <div className="text-gray-400 text-sm">no regular users yet</div>
          ) : (
            <div className="space-y-1">
              {users.map((profile) => (
                <UserRow
                  key={profile.id}
                  profile={profile}
                  isSelf={profile.id === currentUserId}
                  loading={loadingId === profile.id}
                  onToggle={toggleBlock}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function UserRow({
  profile,
  isSelf,
  loading,
  onToggle,
}: {
  profile: UserProfile
  isSelf: boolean
  loading: boolean
  onToggle: (p: UserProfile) => void
}) {
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 flex items-center gap-3">
      {/* Status dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          profile.blocked ? 'bg-red-400' : 'bg-green-400'
        }`}
      />

      {/* Email + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-100 truncate">{profile.email}</span>
          {isSelf && (
            <span className="text-[10px] text-gray-300 border border-gray-500 rounded px-1">
              you
            </span>
          )}
          {profile.role === 'admin' && (
            <span className="text-[10px] text-purple-300 border border-purple-600 rounded px-1">
              admin
            </span>
          )}
          {profile.blocked && (
            <span className="text-[10px] text-red-300 border border-red-600 rounded px-1">
              blocked
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">
          joined {new Date(profile.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Block / Unblock */}
      {!isSelf && (
        <button
          onClick={() => onToggle(profile)}
          disabled={loading}
          className={`text-xs px-3 py-1 rounded border transition-colors disabled:opacity-40 shrink-0 ${
            profile.blocked
              ? 'text-green-300 border-green-600 hover:bg-green-900'
              : 'text-red-300 border-red-600 hover:bg-red-900'
          }`}
        >
          {loading ? '...' : profile.blocked ? 'unblock' : 'block'}
        </button>
      )}
    </div>
  )
}
