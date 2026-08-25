import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, campaignUpdateSchema } from '@/lib/validation'
import type { Campaign, ContentItem } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Detalhe da campanha + conteúdos vinculados. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).eq('org_id', ctx.organization.id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: links } = await supabase.from('campaign_content_items').select('content_item_id').eq('campaign_id', id)
  const contentIds = (links ?? []).map((l) => l.content_item_id as string)

  let items: ContentItem[] = []
  if (contentIds.length > 0) {
    const { data } = await supabase.from('content_items').select('*').in('id', contentIds)
    items = (data ?? []) as ContentItem[]
  }

  return NextResponse.json({ campaign: campaign as Campaign, items })
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data: body, error: validationError } = await parseBody(request, campaignUpdateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const updates: Record<string, unknown> = {}
  for (const key of ['name', 'description', 'color', 'start_date', 'end_date', 'status'] as const) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'campanhas.update')
  return NextResponse.json({ campaign: data as Campaign })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('campaigns').delete().eq('id', id).eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'campanhas.delete')
  return NextResponse.json({ success: true })
}
