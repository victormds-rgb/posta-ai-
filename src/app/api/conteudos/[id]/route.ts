import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ContentItem } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

const EDITABLE_FIELDS = [
  'title',
  'content_type',
  'description',
  'caption',
  'media_urls',
  'cover_url',
  'channels',
  'status',
  'scheduled_at',
  'assigned_to',
] as const

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = await createServerSupabase()

  const updates: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('content_items')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ('status' in updates) {
    await supabase.from('activity_log').insert({
      org_id: ctx.organization.id,
      user_id: ctx.userId,
      action: 'content.status_changed',
      entity_type: 'content_item',
      entity_id: id,
      details: { status: updates.status },
    })
  }

  return NextResponse.json({ item: data as ContentItem })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('content_items').delete().eq('id', id).eq('org_id', ctx.organization.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
