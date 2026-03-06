import { createServiceClient } from '@/lib/supabase-service'
import { NextRequest, NextResponse } from 'next/server'

type Params = { endpointId: string; path?: string[] }

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
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  // Collect headers (exclude internal ones)
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (!key.startsWith('x-vercel-') && key !== 'connection') {
      headers[key] = value
    }
  })

  // Collect query params
  const queryParams: Record<string, string> = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value
  })

  // Read body
  let body: string | null = null
  const method = request.method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    try {
      body = await request.text()
    } catch {
      body = null
    }
  }

  const path = pathSegments ? '/' + pathSegments.join('/') : '/'
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
    console.error('Failed to store request:', insertError)
  }

  return NextResponse.json(
    { received: true, id: endpointId },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    }
  )
}

export const GET = handleWebhook
export const POST = handleWebhook
export const PUT = handleWebhook
export const DELETE = handleWebhook
export const PATCH = handleWebhook
export const HEAD = handleWebhook

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
