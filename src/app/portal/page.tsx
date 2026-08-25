'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Badge } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Building2, Image as ImageIcon } from 'lucide-react'
import type { Client, ContentItem } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  ideia: 'Ideia',
  producao: 'Em produção',
  aprovacao_interna: 'Aprovação interna',
  aprovacao_cliente: 'Aguardando sua aprovação',
  agendado: 'Agendado',
  publicado: 'Publicado',
}

const STATUS_TONE: Record<string, 'brand' | 'warning' | 'success' | 'default'> = {
  ideia: 'default',
  producao: 'default',
  aprovacao_interna: 'warning',
  aprovacao_cliente: 'warning',
  agendado: 'brand',
  publicado: 'success',
}

export default function PortalDashboardPage() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [items, setItems] = useState<ContentItem[] | null>(null)

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/clientes')
    if (!res.ok) return
    const data = await res.json()
    setClients(data.clients)
    if (data.clients.length > 0) setSelectedClient(data.clients[0].id)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!selectedClient) return
    let cancelled = false
    fetch(`/api/conteudos?client_id=${selectedClient}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setItems(data.items)
      })
    return () => {
      cancelled = true
    }
  }, [selectedClient])

  if (clients === null) return <p className="text-sm text-muted">Carregando…</p>

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="size-8" />}
        title="Nenhum acesso configurado"
        description="Peça para a agência vincular seu usuário a um cliente em Equipe."
      />
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Seu conteúdo</h1>
      <p className="mt-1 text-sm text-muted">Acompanhe o status do que está sendo produzido para você.</p>

      {clients.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClient(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selectedClient === c.id ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {items === null && <p className="text-sm text-muted">Carregando conteúdo…</p>}
        {items !== null && items.length === 0 && (
          <EmptyState icon={<ImageIcon className="size-8" />} title="Nenhum conteúdo ainda" description="Assim que a equipe criar algo, vai aparecer aqui." />
        )}
        {items?.map((item) => (
          <Card key={item.id} className="flex items-center gap-4 p-4">
            {item.cover_url || item.media_urls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.cover_url || item.media_urls[0]} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <ImageIcon className="size-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              {item.scheduled_at && (
                <p className="text-xs text-muted">Agendado para {new Date(item.scheduled_at).toLocaleString('pt-BR')}</p>
              )}
            </div>
            <Badge tone={STATUS_TONE[item.status] ?? 'default'}>{STATUS_LABELS[item.status] ?? item.status}</Badge>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted">
        Recebeu um link de aprovação por e-mail ou WhatsApp?{' '}
        <Link href="/aprovacao" className="text-brand underline">
          Abra por aqui
        </Link>
        .
      </p>
    </div>
  )
}
