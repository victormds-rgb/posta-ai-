import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, contentCreateSchema } from '@/lib/validation'
import { assertWithinContentLimit } from '@/lib/plan-limits'
import { getPortalClientIds } from '@/lib/portal'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { ContentItem } from '@/lib/types'

export async function GET(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  const supabase = await createServerSupabase()

  // Membro `role: cliente` só enxerga conteúdo do(s) cliente(s) vinculado(s)
  // a ele no Portal — nunca o board inteiro da organização.
  if (ctx.member.role === 'cliente') {
    const allowedClientIds = await getPortalClientIds(supabase, ctx.member.id)
    if (clientId && !allowedClientIds.includes(clientId)) {
      return NextResponse.json({ items: [] })
    }
    if (allowedClientIds.length === 0) return NextResponse.json({ items: [] })
    const query = supabase
      .from('content_items')
      .select('*')
      .eq('org_id', ctx.organization.id)
      .in('client_id', clientId ? [clientId] : allowedClientIds)
      .order('created_at', { ascending: false })
    const { data, error } = await query
    if (error) return serverError(error, 'conteudos')
    return NextResponse.json({ items: (data ?? []) as ContentItem[] })
  }

  let query = supabase
    .from('content_items')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return serverError(error, 'conteudos')
  return NextResponse.json({ items: (data ?? []) as ContentItem[] })
}

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, contentCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()

  const limitCheck = await assertWithinContentLimit(supabase, ctx.organization.id, ctx.organization.plan)
  if (!limitCheck.ok) return NextResponse.json({ error: limitCheck.reason }, { status: 402 })

  const { data, error } = await supabase
    .from('content_items')
    .insert({
      org_id: ctx.organization.id,
      client_id: body.client_id,
      title: body.title?.trim() || 'Sem título',
      content_type: body.content_type,
      description: body.description || null,
      caption: body.caption || null,
      media_urls: body.media_urls,
      cover_url: body.cover_url || null,
      channels: body.channels,
      status: body.status || 'ideia',
      scheduled_at: body.scheduled_at || null,
      created_by: ctx.userId,
      assigned_to: body.assigned_to || null,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'conteudos')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'content.created',
    entity_type: 'content_item',
    entity_id: (data as ContentItem).id,
    details: { title: (data as ContentItem).title },
  })

  await dispatchWebhookEvent(supabase, { orgId: ctx.organization.id, eventType: 'content.created', payload: { content: data } })

  return NextResponse.json({ item: data as ContentItem }, { status: 201 })
}
