import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ContentItem } from '@/lib/types'

export async function GET(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  const supabase = await createServerSupabase()
  let query = supabase
    .from('content_items')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: (data ?? []) as ContentItem[] })
}

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.client_id) {
    return NextResponse.json({ error: 'client_id é obrigatório' }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('content_items')
    .insert({
      org_id: ctx.organization.id,
      client_id: body.client_id,
      title: body.title?.trim() || 'Sem título',
      content_type: body.content_type || 'post',
      description: body.description || null,
      caption: body.caption || null,
      media_urls: body.media_urls || [],
      cover_url: body.cover_url || null,
      channels: body.channels || [],
      status: body.status || 'ideia',
      scheduled_at: body.scheduled_at || null,
      created_by: ctx.userId,
      assigned_to: body.assigned_to || null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'content.created',
    entity_type: 'content_item',
    entity_id: (data as ContentItem).id,
    details: { title: (data as ContentItem).title },
  })

  return NextResponse.json({ item: data as ContentItem }, { status: 201 })
}
