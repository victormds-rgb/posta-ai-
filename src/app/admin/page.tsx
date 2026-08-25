'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'

interface Metrics {
  totalOrganizations: number
  newOrgsLast30d: number
  byPlan: Record<string, number>
  mrrBRL: number
  totalMembers: number
  totalClients: number
  totalContent: number
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/metrics')
    if (res.ok) setMetrics(await res.json())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  if (!metrics) return <p className="text-sm text-muted">Carregando…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold">Visão geral</h1>
      <p className="mt-1 text-sm text-muted">Métricas globais de todas as organizações do produto.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-muted">Organizações</p>
          <p className="mt-1 text-2xl font-bold">{metrics.totalOrganizations}</p>
          <p className="text-xs text-muted">+{metrics.newOrgsLast30d} nos últimos 30 dias</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">MRR estimado</p>
          <p className="mt-1 text-2xl font-bold">R$ {metrics.mrrBRL.toLocaleString('pt-BR')}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Membros (todas as orgs)</p>
          <p className="mt-1 text-2xl font-bold">{metrics.totalMembers}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Clientes cadastrados</p>
          <p className="mt-1 text-2xl font-bold">{metrics.totalClients}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Conteúdos criados</p>
          <p className="mt-1 text-2xl font-bold">{metrics.totalContent}</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="mb-3 text-sm font-semibold">Distribuição por plano</p>
        <div className="space-y-2">
          {Object.entries(metrics.byPlan).map(([plan, count]) => {
            const pct = metrics.totalOrganizations > 0 ? (count / metrics.totalOrganizations) * 100 : 0
            return (
              <div key={plan}>
                <div className="flex justify-between text-xs text-muted">
                  <span className="capitalize">{plan}</span>
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
    </div>
  )
}
