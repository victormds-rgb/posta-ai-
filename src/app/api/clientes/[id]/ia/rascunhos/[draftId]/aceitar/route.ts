import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { assertWithinContentLimit } from '@/lib/plan-limits'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { AiGeneration, ContentItem } from '@/lib/types'

type Params = { params: Promise<{ id: string; draftId: string }> }

/** Converte um rascunho gerado por IA num content_item de verdade (status "ideia"). */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId, draftId } = await params
  const supabase = await createServerSupabase()
  const { data: draftData } = await supabase
    .from('ai_generations')
    .select('*')
    .eq('id', draftId)
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)
    .maybeSingle()
  const draft = draftData as AiGeneration | null
  if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (draft.content_item_id) return NextResponse.json({ error: 'Este rascunho já virou conteúdo.' }, { status: 400 })

  const limitCheck = await assertWithinContentLimit(supabase, ctx.organization.id, ctx.organization.plan)
  if (!limitCheck.ok) return NextResponse.json({ error: limitCheck.reason }, { status: 402 })

  const captionParts = [draft.result.caption, ...draft.result.carousel_slides.map((s) => `${s.heading}\n${s.body}`)]

  const { data: content, error } = await supabase
    .from('content_items')
    .insert({
      org_id: ctx.organization.id,
      client_id: clientId,
      title: draft.result.title,
      content_type: draft.result.carousel_slides.length > 1 ? 'carrossel' : 'post',
      caption: captionParts[0] || '',
      description: `Gerado por IA a partir do briefing: ${draft.brief}`,
      media_urls: [],
      channels: draft.result.suggested_channels,
      status: 'ideia',
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'ia.aceitar')

  await supabase.from('ai_generations').update({ content_item_id: (content as ContentItem).id }).eq('id', draftId)

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'ai_generation.accepted',
    entity_type: 'content_item',
    entity_id: (content as ContentItem).id,
  })

  await dispatchWebhookEvent(supabase, { orgId: ctx.organization.id, eventType: 'content.created', payload: { content } })

  return NextResponse.json({ item: content as ContentItem })
}
