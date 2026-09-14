import { createServiceClient } from '@/lib/supabase-service'
import { NextRequest, NextResponse } from 'next/server'

type Params = { endpointId: string; path?: string[] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

/**
 * Removes NUL bytes, which Postgres cannot store: `text` rejects them outright
 * ("null character not permitted", SQLSTATE 54000) and `jsonb` rejects \u0000
 * inside strings. A delivery carrying one can never be stored as sent, so we
 * strip rather than fail — retrying would send identical bytes forever.
 */
const stripNul = (value: string) => value.replace(/\u0000/g, '')

async function handleWebhook(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { endpointId, path: pathSegments } = await params
  const supabase = createServiceClient()

  // Verify endpoint exists
  const { data: endpoint, error: endpointError } = await supabase
    .from('endpoints')
    .select('id')
    .eq('id', endpointId)
    .single()

  if (endpointError || !endpoint) {
    return NextResponse.json(
      { received: false, error: 'Endpoint not found' },
      { status: 404, headers: CORS }
    )
  }

  // Collect headers (exclude internal ones)
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (!key.startsWith('x-vercel-') && key !== 'connection') {
      headers[key] = stripNul(value)
    }
  })

  // Collect query params
  const queryParams: Record<string, string> = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    queryParams[key] = stripNul(value)
  })

  // Read body
  let body: string | null = null
  const method = request.method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    try {
      body = stripNul(await request.text())
    } catch (err) {
      // A body we could not read (truncated upload, client disconnect) must not
      // be recorded as an empty one — that is indistinguishable from a request
      // genuinely sent without a body.
      console.error('Failed to read request body:', { endpointId, err })
      return NextResponse.json(
        { received: false, error: 'Could not read request body' },
        { status: 400, headers: CORS }
      )
    }
  }

  const path = stripNul(pathSegments ? '/' + pathSegments.join('/') : '/')
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null

  const contentType = request.headers.get('content-type') ?? null

  const { error: insertError } = await supabase.from('requests').insert({
    endpoint_id: endpointId,
    method,
    path,
    headers,
    query_params: queryParams,
    body,
    ip,
    content_type: contentType,
  })

  if (insertError) {
    // Never report success for a request we failed to store: the sender would
    // have no reason to retry and the delivery would vanish silently. The
    // Postgres code makes the next failure diagnosable from the log alone
    // (57014 = statement timeout, 54000 = NUL byte, 23503 = unknown endpoint).
    console.error('Failed to store request:', {
      endpointId,
      code: insertError.code,
      message: insertError.message,
    })

    return NextResponse.json(
      { received: false, error: 'Failed to store request' },
      { status: 500, headers: CORS }
    )
  }

  return NextResponse.json(
    { received: true, id: endpointId },
    { status: 200, headers: CORS }
  )
}

export const GET = handleWebhook
export const POST = handleWebhook
export const PUT = handleWebhook
export const DELETE = handleWebhook
export const PATCH = handleWebhook
export const HEAD = handleWebhook

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
