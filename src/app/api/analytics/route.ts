import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ContentItem, ContentStatus, Client } from '@/lib/types'

/**
 * Analytics internos, calculados ao vivo a partir do que o produto já tem
 * (conteúdo, aprovações) — sem depender de nenhuma API externa de métricas
 * de engajamento (curtidas/alcance), que exigiria integração própria por
 * rede social (Meta/TikTok/etc, cada uma com seu próprio app revisado —
 * fora do escopo desta fase; ver Meta Ads pra anúncios pagos).
 */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()

  const [{ data: itemsData, error: itemsError }, { data: clientsData }, { data: internalApprovals }, { data: externalApprovals }] =
    await Promise.all([
      supabase.from('content_items').select('*').eq('org_id', ctx.organization.id),
      supabase.from('clients').select('*').eq('org_id', ctx.organization.id),
      supabase.from('internal_approvals').select('created_at, reviewed_at, status').eq('org_id', ctx.organization.id),
      supabase.from('approval_links').select('created_at, responded_at, status').eq('org_id', ctx.organization.id),
    ])

  if (itemsError) return serverError(itemsError, 'analytics')

  const items = (itemsData ?? []) as ContentItem[]
  const clients = (clientsData ?? []) as Client[]

  const byStatus: Record<ContentStatus, number> = {
      ideia: 0,
      producao: 0,
      aprovacao_interna: 0,
      aprovacao_cliente: 0,
      agendado: 0,
      processando: 0,
      publicado: 0,
    }
  for (const item of items) byStatus[item.status]++

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const publishedLast30d = items.filter((i) => i.status === 'publicado' && i.published_at && new Date(i.published_at).getTime() >= thirtyDaysAgo).length

  const perClient = clients.map((client) => {
    const clientItems = items.filter((i) => i.client_id === client.id)
    return {
      client_id: client.id,
      name: client.name,
      total: clientItems.length,
      published: clientItems.filter((i) => i.status === 'publicado').length,
      scheduled: clientItems.filter((i) => i.status === 'agendado').length,
    }
  })

  function avgHours(rows: { created_at: string; reviewed_at?: string; responded_at?: string }[]): number | null {
    const durations = rows
      .map((r) => {
        const end = r.reviewed_at || r.responded_at
        if (!end) return null
        return (new Date(end).getTime() - new Date(r.created_at).getTime()) / 3_600_000
      })
      .filter((n): n is number => n !== null && n >= 0)
    if (durations.length === 0) return null
    return durations.reduce((a, b) => a + b, 0) / durations.length
  }

  return NextResponse.json({
    totals: {
      total: items.length,
      byStatus,
      publishedLast30d,
    },
    perClient,
    approvalTurnaroundHours: {
      internal: avgHours(internalApprovals ?? []),
      external: avgHours(externalApprovals ?? []),
    },
  })
}
