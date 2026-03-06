// Force dynamic rendering so the login form isn't prerendered without env vars
export const dynamic = 'force-dynamic'

import LoginForm from './login-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // searchParams is async in Next.js 15+; unwrap via use() or pass the promise
  // We read it in a server component and pass the value down as a plain prop
  return <LoginFormWrapper searchParams={searchParams} />
}

async function LoginFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <LoginForm urlError={error} />
}
