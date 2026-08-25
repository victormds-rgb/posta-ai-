'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { MediaUploader } from '@/components/upload/media-uploader'
import { CONTENT_STATUSES, SOCIAL_PLATFORMS, type ContentItem, type ContentStatus, type ContentType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import { InternalApprovalPanel } from '@/components/content/internal-approval-panel'
import { Trash2, Link2, Check, Send } from 'lucide-react'

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'reels', label: 'Reels' },
  { value: 'story', label: 'Story' },
  { value: 'video', label: 'Vídeo' },
]

export function ContentModal({
  open,
  onClose,
  clientId,
  defaultStatus,
  item,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  clientId: string
  defaultStatus: ContentStatus
  item: ContentItem | null
  onSaved: () => void
  onDeleted?: () => void
}) {
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentType>('post')
  const [caption, setCaption] = useState('')
  const [description, setDescription] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [status, setStatus] = useState<ContentStatus>(defaultStatus)
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvalLink, setApprovalLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const { permissions } = usePermissions()
  const canManageContent = permissions?.manageContent ?? false
  const canPublish = permissions?.publish ?? false
  const canApproveInternal = permissions?.approveInternal ?? false

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o form ao abrir com um item diferente
    setTitle(item?.title ?? '')
    setContentType(item?.content_type ?? 'post')
    setCaption(item?.caption ?? '')
    setDescription(item?.description ?? '')
    setChannels(item?.channels ?? [])
    setMediaUrls(item?.media_urls ?? [])
    setStatus(item?.status ?? defaultStatus)
    setScheduledAt(item?.scheduled_at ? item.scheduled_at.slice(0, 16) : '')
    setError(null)
    setApprovalLink(null)
    setCopied(false)
    setPublishError(null)
    setPublished(false)
  }, [open, item, defaultStatus])

  function toggleChannel(platform: string) {
    setChannels((prev) => (prev.includes(platform) ? prev.filter((c) => c !== platform) : [...prev, platform]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      client_id: clientId,
      title,
      content_type: contentType,
      caption,
      description,
      channels,
      media_urls: mediaUrls,
      cover_url: mediaUrls[0] || null,
      status,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    }

    const res = item
      ? await fetch(`/api/conteudos/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/conteudos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não foi possível salvar.')
      return
    }
    onSaved()
    onClose()
  }

  async function handleGenerateLink() {
    if (!item) return
    setGeneratingLink(true)
    const res = await fetch(`/api/conteudos/${item.id}/approval-link`, { method: 'POST' })
    setGeneratingLink(false)
    if (res.ok) {
      const data = await res.json()
      setApprovalLink(data.link)
      setStatus('aprovacao_cliente')
      onSaved()
    }
  }

  async function handleCopyLink() {
    if (!approvalLink) return
    await navigator.clipboard.writeText(approvalLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handlePublishNow() {
    if (!item) return
    setPublishing(true)
    setPublishError(null)
    const res = await fetch('/api/posts/publish-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: item.id }),
    })
    setPublishing(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPublishError(data.error || 'Falha ao publicar.')
      return
    }
    setPublished(true)
    setStatus('publicado')
    onSaved()
  }

  async function handleDelete() {
    if (!item || !confirm('Excluir este conteúdo?')) return
    const res = await fetch(`/api/conteudos/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDeleted?.()
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Editar conteúdo' : 'Novo conteúdo'} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={!canManageContent} className="space-y-4 disabled:opacity-60">
        <div>
          <Label htmlFor="content-title">Título</Label>
          <Input id="content-title" required value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="content-type">Tipo</Label>
            <select
              id="content-type"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="content-status">Status</Label>
            <select
              id="content-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
            >
              {CONTENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Canais</Label>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                type="button"
                key={platform}
                onClick={() => toggleChannel(platform)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  channels.includes(platform)
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-border text-muted hover:border-brand',
                )}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="content-caption">Legenda</Label>
          <Textarea id="content-caption" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="content-description">Descrição / observações internas</Label>
          <Textarea
            id="content-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <Label>Mídia</Label>
          <MediaUploader urls={mediaUrls} onChange={setMediaUrls} />
        </div>

        <div>
          <Label htmlFor="content-scheduled">Agendar publicação para</Label>
          <Input
            id="content-scheduled"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        </fieldset>

        {item && (canManageContent || canApproveInternal) && (
          <InternalApprovalPanel
            contentId={item.id}
            canRequest={canManageContent}
            canDecide={canApproveInternal}
            onChanged={() => {
              onSaved()
            }}
          />
        )}

        {item && canManageContent && (
          <div className="rounded-lg border border-border bg-black/[0.02] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Aprovação do cliente</p>
              <Button type="button" size="sm" variant="secondary" loading={generatingLink} onClick={handleGenerateLink}>
                <Link2 className="size-3.5" />
                Gerar link
              </Button>
            </div>
            {approvalLink && (
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={approvalLink} className="text-xs" onFocus={(e) => e.target.select()} />
                <Button type="button" size="sm" variant="ghost" onClick={handleCopyLink}>
                  {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                </Button>
              </div>
            )}
          </div>
        )}

        {item && canPublish && (
          <div className="rounded-lg border border-border bg-black/[0.02] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Publicação</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={publishing}
                disabled={published || item.status === 'publicado'}
                onClick={handlePublishNow}
              >
                <Send className="size-3.5" />
                {item.status === 'publicado' || published ? 'Publicado' : 'Publicar agora'}
              </Button>
            </div>
            {publishError && <p className="mt-2 text-xs text-danger">{publishError}</p>}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {item && canManageContent ? (
            <Button type="button" variant="ghost" onClick={handleDelete} className="text-danger">
              <Trash2 className="size-4" />
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {canManageContent ? 'Cancelar' : 'Fechar'}
            </Button>
            {canManageContent && (
              <Button type="submit" loading={saving}>
                Salvar
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}
