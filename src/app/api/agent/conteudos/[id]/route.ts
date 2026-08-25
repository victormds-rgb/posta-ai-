import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { createAdminSupabase } from '@/lib/supabase/server'
import { getAgentOrgId } from '@/lib/agent-auth'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import { parseBody, agentContentUpdateSchema } from '@/lib/validation'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { ContentItem } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const supabase = createAdminSupabase()
  const orgId = await getAgentOrgId(request, supabase)
  if (!orgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limit = rateLimit(`agent:${orgId}`, 60, 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { id } = await params
  const { data: body, error: validationError } = await parseBody(request, agentContentUpdateSchema)
  if (validationError) return validationError
  if (Object.keys(body).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })

  const { data: before } = await supabase.from('content_items').select('status').eq('id', id).eq('org_id', orgId).maybeSingle()
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('content_items')
    .update(body)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) return serverError(error, 'agent.conteudos.update')

  if (body.status && body.status !== before.status) {
    await dispatchWebhookEvent(supabase, { orgId, eventType: 'content.status_changed', payload: { content: data } })
    if (body.status === 'publicado') {
      await dispatchWebhookEvent(supabase, { orgId, eventType: 'content.published', payload: { content: data } })
    }
  }

  return NextResponse.json({ item: data as ContentItem })
}
