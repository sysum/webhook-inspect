import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isEmailAllowed, isAdminEmail } from '@/lib/allowlist'
import { createServiceClient } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email ?? ''

      // Allowlist check — reject emails not on the permitted list
      if (!isEmailAllowed(email)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_allowed`)
      }

      // Create profile on first login (ignoreDuplicates keeps existing blocked status)
      const serviceClient = createServiceClient()
      await serviceClient.from('profiles').upsert(
        {
          id: data.user.id,
          email,
          role: isAdminEmail(email) ? 'admin' : 'user',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
