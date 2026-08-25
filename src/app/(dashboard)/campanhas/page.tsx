'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input, Label, Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDate } from '@/lib/utils'
import type { Campaign, Client } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}
const STATUS_TONE: Record<string, 'brand' | 'warning' | 'success' | 'default'> = {
  planejada: 'default',
  em_andamento: 'brand',
  concluida: 'success',
  cancelada: 'warning',
}

export default function CampanhasPage() {
  const { permissions } = usePermissions()
  const canManage = permissions?.manageContent ?? false

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    const [campaignsRes, clientsRes] = await Promise.all([fetch('/api/campanhas'), fetch('/api/clientes')])
    if (campaignsRes.ok) setCampaigns((await campaignsRes.json()).campaigns)
    if (clientsRes.ok) setClients((await clientsRes.json()).clients)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas</h1>
          <p className="text-sm text-muted">Agrupe conteúdos por período e acompanhe o progresso.</p>
        </div>
        {canManage && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Nova campanha
          </Button>
        )}
      </div>

      {campaigns === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-8" />} title="Nenhuma campanha ainda" description="Crie uma campanha pra agrupar conteúdos de um período." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campanhas/${c.id}`}>
              <Card className="h-full p-5 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{clientsById[c.client_id]?.name ?? 'Cliente removido'}</p>
                {(c.start_date || c.end_date) && (
                  <p className="mt-2 text-xs text-muted">
                    {c.start_date ? formatDate(c.start_date) : '…'} — {c.end_date ? formatDate(c.end_date) : '…'}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clients={clients}
        onCreated={() => {
          setModalOpen(false)
          load()
        }}
      />
    </div>
  )
}

function NewCampaignModal({
  open,
  onClose,
  clients,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  clients: Client[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setClientId('')
    setDescription('')
    setStartDate('')
    setEndDate('')
    setError(null)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/campanhas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        client_id: clientId,
        description: description || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar a campanha.')
      return
    }
    reset()
    onCreated()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Nova campanha">
      <div className="space-y-4">
        <div>
          <Label htmlFor="campaign-name">Nome</Label>
          <Input id="campaign-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campaign-client">Cliente</Label>
          <select
            id="campaign-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
          >
            <option value="">Selecione…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="campaign-start">Início</Label>
            <Input id="campaign-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="campaign-end">Fim</Label>
            <Input id="campaign-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="campaign-desc">Descrição</Label>
          <Textarea id="campaign-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { reset(); onClose() }}>
            Cancelar
          </Button>
          <Button loading={loading} disabled={!name.trim() || !clientId} onClick={handleSubmit}>
            Criar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
