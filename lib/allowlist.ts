/** Emails or domains permitted to log in */
export function isEmailAllowed(email: string): boolean {
  const lower = email.toLowerCase()
  return lower === 'sam.sysum@gmail.com' || lower.endsWith('@marshallreddick.com')
}

/** Emails that get the admin role */
export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return lower === 'sam.sysum@gmail.com' || lower === 'sam.sysum@marshallreddick.com'
}
