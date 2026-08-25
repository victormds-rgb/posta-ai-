import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, campaignLinkContentSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

/** Vincula um conteúdo existente à campanha. */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: campaignId } = await params
  const { data: body, error: validationError } = await parseBody(request, campaignLinkContentSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: campaign } = await supabase.from('campaigns').select('id, client_id').eq('id', campaignId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: content } = await supabase
    .from('content_items')
    .select('id, client_id')
    .eq('id', body.content_item_id)
    .eq('org_id', ctx.organization.id)
    .maybeSingle()
  if (!content) return NextResponse.json({ error: 'Conteúdo inválido' }, { status: 400 })
  if (content.client_id !== campaign.client_id) {
    return NextResponse.json({ error: 'O conteúdo precisa ser do mesmo cliente da campanha' }, { status: 400 })
  }

  const { error } = await supabase
    .from('campaign_content_items')
    .upsert({ campaign_id: campaignId, content_item_id: body.content_item_id }, { onConflict: 'campaign_id,content_item_id' })

  if (error) return serverError(error, 'campanhas.conteudos.link')
  return NextResponse.json({ success: true }, { status: 201 })
}

/** Desvincula um conteúdo da campanha (?content_item_id=). */
export async function DELETE(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: campaignId } = await params
  const { searchParams } = new URL(request.url)
  const contentItemId = searchParams.get('content_item_id')
  if (!contentItemId) return NextResponse.json({ error: 'content_item_id é obrigatório' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', campaignId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { error } = await supabase
    .from('campaign_content_items')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('content_item_id', contentItemId)

  if (error) return serverError(error, 'campanhas.conteudos.unlink')
  return NextResponse.json({ success: true })
}
