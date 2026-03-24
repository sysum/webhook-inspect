# webhook.inspect

A self-hosted webhook inspection tool — a private alternative to [Webhook.site](https://webhook.site) and [Beeceptor](https://beeceptor.com).

Create unique URLs, fire HTTP requests at them from anywhere, and watch the full request details (method, headers, body, query params) appear in real time. All history is persisted so you can go back and inspect past requests at any time.

---

## Why we built this

Public webhook inspection tools are great for quick debugging, but they come with trade-offs: your request payloads (which often contain API keys, tokens, or business-sensitive data) are sent to a third-party server you don't control. We built webhook.inspect to keep that data entirely within infrastructure we own, while adding access control so only authorised team members can use it.

---

## Features

- **Real-time request capture** — any HTTP method (GET, POST, PUT, DELETE, PATCH, etc.), with full headers, body, and query params displayed as they arrive
- **Persistent history** — all requests are stored in Supabase; refresh the page and everything is still there
- **Multiple endpoints** — create as many unique webhook URLs as you need, rename or delete them at any time
- **Email allowlist** — only permitted email addresses and domains can log in; everyone else is rejected at the auth step
- **Admin panel** — designated admins can see all users and block/unblock access without touching the database
- **Magic link auth** — no passwords; sign in via email link powered by Supabase Auth

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Auth | Supabase Auth (magic link) |
| Hosting | Vercel |

---

## Prerequisites

- A [Supabase](https://supabase.com) project
- A [Vercel](https://vercel.com) account (or any Node.js host)
- Node.js 18+

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/webhook-inspect.git
cd webhook-inspect
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3060
```

Keys are found in your Supabase project under **Settings → API**.

> `SUPABASE_SERVICE_ROLE_KEY` is only ever used server-side (in the webhook capture route and admin API). It is never sent to the browser.

### 3. Run the database schema

In your Supabase project, open **SQL Editor** and run the contents of [`supabase-schema.sql`](./supabase-schema.sql).

This creates three tables (`endpoints`, `requests`, `profiles`), sets up Row Level Security policies, and enables Realtime on the `requests` table.

### 4. Configure Supabase Auth

In your Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3060` (update to your production URL after deploying)
- **Redirect URLs**: add `http://localhost:3060/auth/callback`

### 5. Update the allowlist

Edit [`lib/allowlist.ts`](./lib/allowlist.ts) to control who can log in and who gets admin access:

```ts
export function isEmailAllowed(email: string): boolean {
  return email === 'you@gmail.com' || email.endsWith('@yourcompany.com')
}

export function isAdminEmail(email: string): boolean {
  return email === 'you@yourcompany.com'
}
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3060](http://localhost:3060) and sign in with an allowlisted email.

---

## Deploying to Vercel

1. Push the repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add the four environment variables in Vercel's project settings (use your production URL for `NEXT_PUBLIC_APP_URL`)
4. Deploy — every subsequent push to `main` redeploys automatically
5. Add your Vercel URL to Supabase's **Redirect URLs** list

---

## How it works

```
Browser → POST /api/w/{endpoint-id}/optional/path
             ↓
      Webhook capture route (server-side, no auth required)
      Reads method, headers, body, query params, IP
      Writes to `requests` table via service role key
             ↓
      Supabase Realtime pushes INSERT event to subscribed clients
             ↓
      Dashboard updates in real time
```

The webhook capture URL (`/api/w/*`) is intentionally public — callers don't need to authenticate. All other routes require a valid Supabase session from an allowlisted, non-blocked user.

---

## Project structure

```
app/
  login/            Magic link login page
  dashboard/        Endpoint list (create, rename, delete)
  e/[id]/           Real-time request viewer for a single endpoint
  admin/            User management (admins only)
  api/
    endpoints/      CRUD for endpoints
    w/[id]/[[...path]]/  Webhook capture — all HTTP methods
    admin/users/    List + block/unblock users
  auth/callback/    Supabase auth code exchange
  blocked/          Shown to blocked users
lib/
  allowlist.ts      Email permit list and admin check
  auth.ts           requireUser() / requireAdmin() helpers
  supabase-*.ts     Browser, server, and service role clients
components/
  RequestList.tsx   Realtime-subscribed request list
  RequestDetail.tsx Body / Headers / Query tab view
  MethodBadge.tsx   Coloured HTTP method pill
  CopyButton.tsx    Copy-to-clipboard
proxy.ts            Auth middleware (Next.js 16)
supabase-schema.sql Run this once in Supabase SQL Editor
```

---

## Troubleshooting

**Dashboard shows no endpoints despite data existing in the database**

The `requests` table RLS policy uses a correlated subquery that runs for every row. Fetching request counts via an embedded `requests(count)` join triggers a statement timeout on large tables. The dashboard avoids this by fetching counts separately using the service role client (which bypasses RLS) after first fetching the endpoint list with the anon client (RLS-protected). If you see a timeout, check `app/dashboard/page.tsx`.

**New users are being assigned the admin role**

The app code in `lib/allowlist.ts` controls which emails receive admin — all others get `user`. If users are unexpectedly becoming admins, check your Supabase dashboard under **Database → Triggers** for any trigger on `auth.users` or `profiles` that hard-codes `role = 'admin'`. The auth callback uses `ignoreDuplicates: true`, so a trigger-created profile will not be overwritten.

**Endpoints are visible in Supabase but not in the dashboard**

This is usually a RLS policy issue. Confirm the `users_own_endpoints` policy exists on the `endpoints` table (**Database → Policies**). If it's missing, recreate it:

```sql
create policy "users_own_endpoints"
  on endpoints for all
  using (auth.uid() = user_id);
```
