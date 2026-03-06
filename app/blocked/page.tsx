import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BlockedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If not logged in at all, send to login
  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-red-500 text-4xl mb-4">⊘</div>
        <h1 className="text-gray-100 text-lg font-semibold mb-2">access blocked</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your account has been suspended. Contact an administrator if you believe this is a
          mistake.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-gray-500 hover:text-gray-300 text-xs border border-gray-800 hover:border-gray-600 px-4 py-2 rounded transition-colors"
          >
            sign out
          </button>
        </form>
      </div>
    </div>
  )
}
