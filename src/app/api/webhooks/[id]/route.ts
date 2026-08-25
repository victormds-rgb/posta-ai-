import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, webhookUpdateSchema } from '@/lib/validation'
import type { WebhookConfig } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data: body, error: validationError } = await parseBody(request, webhookUpdateSchema)
  if (validationError) return validationError

  const updates: Record<string, unknown> = {}
  for (const key of ['url', 'events', 'active'] as const) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('webhook_configs')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .select('id, org_id, url, events, active, created_by, created_at')
    .single()

  if (error) return serverError(error, 'webhooks.update')
  return NextResponse.json({ webhook: data as WebhookConfig })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('webhook_configs').delete().eq('id', id).eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'webhooks.delete')
  return NextResponse.json({ success: true })
}
