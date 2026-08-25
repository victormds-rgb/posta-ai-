import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import type { ApprovalLink, Client, ContentItem } from '@/lib/types'

type Params = { params: Promise<{ token: string }> }

/** Endpoint público (sem login) usado pela página /aprovacao. */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const supabase = createAdminSupabase()

  const { data: linkData } = await supabase.from('approval_links').select('*').eq('token', token).maybeSingle()
  const link = linkData as ApprovalLink | null
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  const { data: contentData } = await supabase.from('content_items').select('*').eq('id', link.content_id).single()
  const content = contentData as ContentItem | null
  if (!content) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, logo_url, brand_primary_color')
    .eq('id', content.client_id)
    .single()

  return NextResponse.json({ link, content, client: client as Pick<Client, 'id' | 'name' | 'logo_url' | 'brand_primary_color'> | null })
}

/** Cliente final aprova ou pede ajuste. */
export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  const body = await request.json().catch(() => ({}))
  const action: 'aprovado' | 'ajuste' = body.action
  if (action !== 'aprovado' && action !== 'ajuste') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const supabase = createAdminSupabase()
  const { data: linkData } = await supabase.from('approval_links').select('*').eq('token', token).maybeSingle()
  const link = linkData as ApprovalLink | null
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  await supabase
    .from('approval_links')
    .update({
      status: action,
      reviewer_name: body.reviewer_name || null,
      comment: body.comment || null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', link.id)

  await supabase
    .from('content_items')
    .update({ status: action === 'aprovado' ? 'agendado' : 'producao' })
    .eq('id', link.content_id)

  await supabase.from('activity_log').insert({
    org_id: link.org_id,
    user_id: null,
    action: action === 'aprovado' ? 'approval.approved' : 'approval.adjustment_requested',
    entity_type: 'content_item',
    entity_id: link.content_id,
    details: { reviewer_name: body.reviewer_name || null, comment: body.comment || null },
  })

  return NextResponse.json({ success: true })
}
