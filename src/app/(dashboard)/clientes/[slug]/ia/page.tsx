'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Plus, Trash2, Wand2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input, Label, Textarea } from '@/components/ui/input'
import { usePermissions } from '@/hooks/use-permissions'
import type { AiGeneration, Client, ContentSource } from '@/lib/types'

export default function AiContentPage() {
  const { slug } = useParams<{ slug: string }>()
  const { permissions } = usePermissions()
  const canManage = permissions?.manageContent ?? false

  const [client, setClient] = useState<Client | null>(null)
  const [sources, setSources] = useState<ContentSource[]>([])
  const [generations, setGenerations] = useState<AiGeneration[]>([])
  const [brief, setBrief] = useState('')
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const clientsRes = await fetch('/api/clientes')
    if (!clientsRes.ok) return
    const { clients } = await clientsRes.json()
    const found: Client | undefined = clients.find((c: Client) => c.slug === slug)
    setClient(found ?? null)
    if (found) {
      const [sourcesRes, draftsRes] = await Promise.all([
        fetch(`/api/clientes/${found.id}/ia/fontes`),
        fetch(`/api/clientes/${found.id}/ia/rascunhos`),
      ])
      if (sourcesRes.ok) setSources((await sourcesRes.json()).sources)
      if (draftsRes.ok) setGenerations((await draftsRes.json()).generations)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  function toggleSource(id: string) {
    setSelectedSourceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  async function handleGenerate() {
    if (!client) return
    setGenerating(true)
    setError(null)
    const res = await fetch(`/api/clientes/${client.id}/ia/gerar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, source_ids: selectedSourceIds }),
    })
    setGenerating(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível gerar o rascunho.')
      return
    }
    setBrief('')
    setGenerations((prev) => [data.generation, ...prev])
  }

  async function handleAccept(draftId: string) {
    if (!client) return
    const res = await fetch(`/api/clientes/${client.id}/ia/rascunhos/${draftId}/aceitar`, { method: 'POST' })
    if (res.ok) {
      load()
      alert('Conteúdo criado! Confira no quadro do cliente.')
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Não foi possível aceitar o rascunho.')
    }
  }

  async function handleDeleteSource(id: string) {
    if (!client || !confirm('Remover esta fonte de referência?')) return
    const res = await fetch(`/api/clientes/${client.id}/ia/fontes/${id}`, { method: 'DELETE' })
    if (res.ok) setSources((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleAnalyzeSource(id: string) {
    if (!client) return
    const res = await fetch(`/api/clientes/${client.id}/ia/fontes/${id}/analisar`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setSources((prev) => prev.map((s) => (s.id === id ? data.source : s)))
    } else {
      alert(data.error || 'Não foi possível analisar.')
    }
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>
  if (!client) return <p className="text-sm text-muted">Cliente não encontrado.</p>

  return (
    <div className="max-w-2xl">
      <Link href={`/clientes/${client.slug}`} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar para {client.name}
      </Link>

      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-brand" />
        <h1 className="text-xl font-bold">IA de conteúdo — {client.name}</h1>
      </div>
      <p className="mt-1 text-sm text-muted">
        Gere rascunhos a partir de um briefing. As fontes de referência abaixo são coladas manualmente pela equipe — o produto
        nunca coleta conteúdo de redes sociais automaticamente.
      </p>

      {canManage && (
        <Card className="mt-6 p-5">
          <p className="mb-2 text-sm font-semibold">Gerar rascunho</p>
          <Textarea
            rows={3}
            placeholder="Ex.: post de carrossel anunciando a promoção de aniversário, tom descontraído…"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          {sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    selectedSourceIds.includes(s.id) ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <Button className="mt-3" loading={generating} disabled={brief.trim().length < 10} onClick={handleGenerate}>
            <Wand2 className="size-4" />
            Gerar
          </Button>
        </Card>
      )}

      {generations.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold">Rascunhos gerados</p>
          {generations.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{g.result.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{g.result.caption}</p>
                  {g.result.carousel_slides.length > 0 && (
                    <p className="mt-1 text-xs text-muted">{g.result.carousel_slides.length} slide(s) de carrossel</p>
                  )}
                </div>
                {canManage &&
                  (g.content_item_id ? (
                    <Badge tone="success">aceito</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => handleAccept(g.id)}>
                      <Check className="size-3.5" />
                      Aceitar
                    </Button>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm font-semibold">Fontes de referência</p>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setSourceModalOpen(true)}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {sources.length === 0 && <p className="text-sm text-muted">Nenhuma fonte cadastrada — cole um texto de referência acima.</p>}
        {sources.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{s.raw_text}</p>
                {s.analysis && (
                  <div className="mt-2 rounded-lg bg-brand-soft p-2 text-xs">
                    <p>
                      <strong>Nota:</strong> {s.analysis.score}/10 — {s.analysis.summary}
                    </p>
                    {s.analysis.angle_suggestions.length > 0 && (
                      <p className="mt-1">Ângulos: {s.analysis.angle_suggestions.join(' · ')}</p>
                    )}
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleAnalyzeSource(s.id)} title="Analisar com IA">
                    <Sparkles className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteSource(s.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <NewSourceModal
        open={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        clientId={client.id}
        onCreated={(source) => {
          setSources((prev) => [source, ...prev])
          setSourceModalOpen(false)
        }}
      />
    </div>
  )
}

function NewSourceModal({
  open,
  onClose,
  clientId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  clientId: string
  onCreated: (source: ContentSource) => void
}) {
  const [title, setTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/clientes/${clientId}/ia/fontes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, source_url: sourceUrl || undefined, raw_text: rawText }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível adicionar.')
      return
    }
    setTitle('')
    setSourceUrl('')
    setRawText('')
    onCreated(data.source)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova fonte de referência">
      <div className="space-y-4">
        <div>
          <Label htmlFor="source-title">Título</Label>
          <Input id="source-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="source-url">Link (opcional)</Label>
          <Input id="source-url" placeholder="https://…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="source-text">Texto de referência</Label>
          <Textarea id="source-text" rows={6} value={rawText} onChange={(e) => setRawText(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} disabled={!title.trim() || !rawText.trim()} onClick={handleSubmit}>
            Adicionar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
