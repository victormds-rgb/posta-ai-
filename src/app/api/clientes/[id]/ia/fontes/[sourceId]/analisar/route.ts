import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import { analyzeContentSource, isAnthropicConfigured } from '@/lib/anthropic'
import type { ContentSource } from '@/lib/types'

type Params = { params: Promise<{ id: string; sourceId: string }> }

/** Pede pra IA analisar (resumo, ângulos, nota) um material de referência já cadastrado. */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: 'Geração por IA não está configurada neste ambiente (ANTHROPIC_API_KEY ausente).' }, { status: 501 })
  }

  const limit = rateLimit(`ia:${ctx.organization.id}`, 20, 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { id: clientId, sourceId } = await params
  const supabase = await createServerSupabase()
  const { data: source } = await supabase
    .from('content_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)
    .maybeSingle()
  if (!source) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const result = await analyzeContentSource(source.raw_text)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 })

  const { data, error } = await supabase
    .from('content_sources')
    .update({ analysis: result.data, analyzed_at: new Date().toISOString() })
    .eq('id', sourceId)
    .select('*')
    .single()

  if (error) return serverError(error, 'ia.fontes.analisar')
  return NextResponse.json({ source: data as ContentSource })
}
