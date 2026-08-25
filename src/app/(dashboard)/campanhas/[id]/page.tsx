'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDate } from '@/lib/utils'
import type { Campaign, CampaignStatus, ContentItem } from '@/lib/types'

const STATUS_LABELS: Record<CampaignStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { permissions } = usePermissions()
  const canManage = permissions?.manageContent ?? false

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [items, setItems] = useState<ContentItem[]>([])
  const [availableItems, setAvailableItems] = useState<ContentItem[]>([])
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/campanhas/${id}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setCampaign(data.campaign)
    setItems(data.items)
    setLoading(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function loadAvailableItems() {
    if (!campaign) return
    const res = await fetch(`/api/conteudos?client_id=${campaign.client_id}`)
    if (res.ok) {
      const data = await res.json()
      const linkedIds = new Set(items.map((i) => i.id))
      setAvailableItems((data.items as ContentItem[]).filter((i) => !linkedIds.has(i.id)))
    }
    setLinkModalOpen(true)
  }

  async function linkContent(contentItemId: string) {
    const res = await fetch(`/api/campanhas/${id}/conteudos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_item_id: contentItemId }),
    })
    if (res.ok) {
      setLinkModalOpen(false)
      load()
    }
  }

  async function unlinkContent(contentItemId: string) {
    const res = await fetch(`/api/campanhas/${id}/conteudos?content_item_id=${contentItemId}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  async function updateStatus(status: CampaignStatus) {
    const res = await fetch(`/api/campanhas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) load()
  }

  async function handleDelete() {
    if (!confirm('Excluir esta campanha? Os conteúdos vinculados não são apagados.')) return
    const res = await fetch(`/api/campanhas/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/campanhas')
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>
  if (!campaign) return <p className="text-sm text-muted">Campanha não encontrada.</p>

  const publishedCount = items.filter((i) => i.status === 'publicado').length

  return (
    <div className="max-w-3xl">
      <Link href="/campanhas" className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{campaign.name}</h1>
          {(campaign.start_date || campaign.end_date) && (
            <p className="mt-1 text-sm text-muted">
              {campaign.start_date ? formatDate(campaign.start_date) : '…'} — {campaign.end_date ? formatDate(campaign.end_date) : '…'}
            </p>
          )}
        </div>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {campaign.description && <p className="mt-3 text-sm">{campaign.description}</p>}

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as CampaignStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                campaign.status === s ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold">
          Conteúdos ({publishedCount}/{items.length} publicados)
        </p>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={loadAvailableItems}>
            <Plus className="size-4" />
            Vincular conteúdo
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {items.length === 0 && <p className="text-sm text-muted">Nenhum conteúdo vinculado ainda.</p>}
        {items.map((item) => (
          <Card key={item.id} className="flex items-center gap-3 p-3">
            {item.cover_url || item.media_urls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.cover_url || item.media_urls[0]} alt="" className="size-10 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                <ImageIcon className="size-4" />
              </div>
            )}
            <span className="flex-1 truncate text-sm">{item.title}</span>
            <Badge tone={item.status === 'publicado' ? 'success' : 'default'}>{item.status}</Badge>
            {canManage && (
              <button onClick={() => unlinkContent(item.id)} className="text-muted hover:text-danger">
                <X className="size-4" />
              </button>
            )}
          </Card>
        ))}
      </div>

      <Modal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} title="Vincular conteúdo">
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {availableItems.length === 0 && <p className="text-sm text-muted">Nenhum conteúdo disponível deste cliente.</p>}
          {availableItems.map((item) => (
            <button
              key={item.id}
              onClick={() => linkContent(item.id)}
              className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left text-sm hover:bg-brand-soft"
            >
              {item.title}
              <Plus className="size-4 text-muted" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
