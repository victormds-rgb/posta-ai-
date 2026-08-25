import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import { parseBody, aiGenerateSchema } from '@/lib/validation'
import { generateContentDraft, isAnthropicConfigured } from '@/lib/anthropic'
import type { AiGeneration, BrandAsset, Client } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Gera um rascunho de conteúdo com IA a partir de um briefing — nunca é chamado automaticamente. */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: 'Geração por IA não está configurada neste ambiente (ANTHROPIC_API_KEY ausente).' }, { status: 501 })
  }

  // Rate limit relativamente apertado — cada chamada tem custo real de API.
  const limit = rateLimit(`ia:gerar:${ctx.organization.id}`, 15, 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { id: clientId } = await params
  const { data: body, error: validationError } = await parseBody(request, aiGenerateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).eq('org_id', ctx.organization.id).maybeSingle()
  const client = clientData as Client | null
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: brandData } = await supabase.from('brand_assets').select('*').eq('client_id', clientId).maybeSingle()
  const brand = brandData as BrandAsset | null

  let referenceSummaries: string[] = []
  if (body.source_ids?.length) {
    const { data: sources } = await supabase.from('content_sources').select('title, raw_text').eq('client_id', clientId).in('id', body.source_ids)
    referenceSummaries = (sources ?? []).map((s) => `${s.title}: ${s.raw_text.slice(0, 1000)}`)
  }

  const result = await generateContentDraft({
    clientName: client.name,
    brand: brand ? { primaryColor: brand.primary_color, fonts: brand.fonts, guidelines: brand.guidelines } : undefined,
    brief: body.brief,
    referenceSummaries,
  })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 })

  const { data, error } = await supabase
    .from('ai_generations')
    .insert({
      org_id: ctx.organization.id,
      client_id: clientId,
      campaign_id: body.campaign_id || null,
      brief: body.brief,
      result: result.data,
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'ia.gerar')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'ai_generation.created',
    entity_type: 'ai_generation',
    entity_id: (data as AiGeneration).id,
  })

  return NextResponse.json({ generation: data as AiGeneration }, { status: 201 })
}
