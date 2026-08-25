'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge, Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'
import type { Campaign, Client, ContentItem } from '@/lib/types'

export default function CalendarioPage() {
  const [items, setItems] = useState<ContentItem[] | null>(null)
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/conteudos').then((r) => r.json()),
      fetch('/api/clientes').then((r) => r.json()),
      fetch('/api/campanhas').then((r) => (r.ok ? r.json() : { campaigns: [] })),
    ]).then(([contentData, clientsData, campaignsData]) => {
      const scheduled = (contentData.items as ContentItem[])
        .filter((i) => i.scheduled_at)
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      setItems(scheduled)
      setClients(Object.fromEntries((clientsData.clients as Client[]).map((c) => [c.id, c])))
      const activeCampaigns = (campaignsData.campaigns as Campaign[]).filter((c) => c.status !== 'cancelada')
      setCampaigns(activeCampaigns)
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold">Calendário</h1>
      <p className="mt-1 text-sm text-muted">Conteúdo agendado ou publicado, de todos os clientes.</p>

      {campaigns.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">Campanhas ativas</h2>
          <div className="flex flex-wrap gap-2">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campanhas/${c.id}`}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-brand-soft"
              >
                {c.name}
                {c.start_date && c.end_date && ` · ${formatDate(c.start_date)}–${formatDate(c.end_date)}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {items === null ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-8" />}
            title="Nada agendado"
            description="Agende uma data de publicação em algum conteúdo para vê-lo aqui."
          />
        ) : (
          <Card className="divide-y divide-border">
            {items.map((item) => {
              const client = clients[item.client_id]
              return (
                <Link
                  key={item.id}
                  href={client ? `/clientes/${client.slug}` : '#'}
                  className="flex items-center justify-between p-4 hover:bg-brand-soft/40"
                >
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted">{client?.name || 'Cliente removido'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={item.status === 'publicado' ? 'success' : 'brand'}>
                      {formatDate(item.scheduled_at!, { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  </div>
                </Link>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
