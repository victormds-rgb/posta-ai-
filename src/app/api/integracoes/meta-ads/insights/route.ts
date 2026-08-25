import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { getOrgMetaAdsConfig } from '@/lib/org-meta-ads'
import { metaGetAdAccountInsights } from '@/lib/meta-ads'

/** Busca insights ao vivo da conta de anúncios conectada (últimos 30 dias). */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const config = await getOrgMetaAdsConfig(supabase, ctx.organization.id)
  if (!config) return NextResponse.json({ error: 'Meta Ads não conectado.' }, { status: 400 })

  const result = await metaGetAdAccountInsights(config.accessToken, config.adAccountId)
  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Falha ao buscar insights.' }, { status: 502 })
  }

  return NextResponse.json({ insights: result.data!.data })
}
