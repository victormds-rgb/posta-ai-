import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { createAdminSupabase } from '@/lib/supabase/server'
import { getAgentOrgId } from '@/lib/agent-auth'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import { parseBody, agentContentCreateSchema } from '@/lib/validation'
import { assertWithinContentLimit } from '@/lib/plan-limits'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { ContentItem, Organization } from '@/lib/types'

export async function GET(request: Request) {
  const supabase = createAdminSupabase()
  const orgId = await getAgentOrgId(request, supabase)
  if (!orgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limit = rateLimit(`agent:${orgId}`, 120, 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase.from('content_items').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return serverError(error, 'agent.conteudos')
  return NextResponse.json({ items: (data ?? []) as ContentItem[] })
}

/** Cria um conteúdo em rascunho (status "ideia") pra um cliente da organização. */
export async function POST(request: Request) {
  const supabase = createAdminSupabase()
  const orgId = await getAgentOrgId(request, supabase)
  if (!orgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limit = rateLimit(`agent:${orgId}`, 30, 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { data: body, error: validationError } = await parseBody(request, agentContentCreateSchema)
  if (validationError) return validationError

  const { data: client } = await supabase.from('clients').select('id').eq('id', body.client_id).eq('org_id', orgId).maybeSingle()
  if (!client) return NextResponse.json({ error: 'client_id inválido' }, { status: 400 })

  const { data: org } = await supabase.from('organizations').select('plan').eq('id', orgId).single()
  const limitCheck = await assertWithinContentLimit(supabase, orgId, (org as Pick<Organization, 'plan'>).plan)
  if (!limitCheck.ok) return NextResponse.json({ error: limitCheck.reason }, { status: 402 })

  const { data, error } = await supabase
    .from('content_items')
    .insert({
      org_id: orgId,
      client_id: body.client_id,
      title: body.title,
      content_type: body.content_type,
      caption: body.caption || null,
      description: body.description || null,
      media_urls: body.media_urls,
      channels: body.channels,
      status: 'ideia',
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'agent.conteudos.create')

  await dispatchWebhookEvent(supabase, { orgId, eventType: 'content.created', payload: { content: data } })

  return NextResponse.json({ item: data as ContentItem }, { status: 201 })
}
