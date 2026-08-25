'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import type { ContentStatus } from '@/lib/types'

const STATUS_LABELS: Record<ContentStatus, string> = {
  ideia: 'Ideia',
  producao: 'Em produção',
  aprovacao_interna: 'Aprovação interna',
  aprovacao_cliente: 'Aprovação do cliente',
  agendado: 'Agendado',
  publicado: 'Publicado',
}

interface AnalyticsData {
  totals: { total: number; byStatus: Record<ContentStatus, number>; publishedLast30d: number }
  perClient: { client_id: string; name: string; total: number; published: number; scheduled: number }[]
  approvalTurnaroundHours: { internal: number | null; external: number | null }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/analytics')
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  if (!data) return <p className="text-sm text-muted">Carregando…</p>

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <BarChart3 className="size-6 text-brand" />
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted">
            Métricas internas de produção e aprovação. Métricas de engajamento (curtidas/alcance) exigem integração própria por
            rede social — veja Meta Ads em Configurações pra anúncios pagos.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted">Total de conteúdos</p>
          <p className="mt-1 text-2xl font-bold">{data.totals.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Publicados (30 dias)</p>
          <p className="mt-1 text-2xl font-bold">{data.totals.publishedLast30d}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Tempo médio de aprovação</p>
          <p className="mt-1 text-2xl font-bold">
            {data.approvalTurnaroundHours.internal != null ? `${data.approvalTurnaroundHours.internal.toFixed(1)}h` : '—'}
          </p>
          <p className="text-xs text-muted">interno</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="mb-3 text-sm font-semibold">Por status</p>
        <div className="space-y-2">
          {(Object.keys(STATUS_LABELS) as ContentStatus[]).map((s) => {
            const count = data.totals.byStatus[s]
            const pct = data.totals.total > 0 ? (count / data.totals.total) * 100 : 0
            return (
              <div key={s}>
                <div className="flex justify-between text-xs text-muted">
                  <span>{STATUS_LABELS[s]}</span>
                  <span>{count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-black/5">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="mt-6 overflow-x-auto p-5">
        <p className="mb-3 text-sm font-semibold">Por cliente</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2">Cliente</th>
              <th className="pb-2">Total</th>
              <th className="pb-2">Publicados</th>
              <th className="pb-2">Agendados</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.perClient.map((c) => (
              <tr key={c.client_id}>
                <td className="py-2">{c.name}</td>
                <td className="py-2">{c.total}</td>
                <td className="py-2">{c.published}</td>
                <td className="py-2">{c.scheduled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
