'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: 'Your email address is not authorised to use this service.',
  auth_failed: 'Authentication failed. Please try again.',
}

export default function LoginForm({ urlError }: { urlError?: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(urlError ? (ERROR_MESSAGES[urlError] ?? urlError) : '')
  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-orange-400 tracking-tight mb-1">
            webhook.inspect
          </div>
          <div className="text-gray-500 text-sm">
            capture &amp; inspect HTTP requests in real time
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          {sent ? (
            <div className="text-center">
              <div className="text-orange-400 text-sm mb-2">✓ magic link sent</div>
              <div className="text-gray-400 text-xs">
                check <span className="text-gray-200">{email}</span> for your sign-in link
              </div>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                  email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {error && (
                <div className="text-red-400 text-xs bg-red-950 border border-red-900 rounded px-3 py-2">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 text-sm font-semibold py-2 px-4 rounded transition-colors"
              >
                {loading ? 'sending...' : 'send magic link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
