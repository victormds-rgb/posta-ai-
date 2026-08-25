'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Send, Copy, Check, Key, Webhook as WebhookIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input, Label } from '@/components/ui/input'
import { usePermissions } from '@/hooks/use-permissions'
import type { OrgAgentToken, WebhookConfig, WebhookEvent, WebhookEventType } from '@/lib/types'

const EVENT_OPTIONS: { value: WebhookEventType; label: string }[] = [
  { value: 'content.created', label: 'Conteúdo criado' },
  { value: 'content.status_changed', label: 'Status do conteúdo mudou' },
  { value: 'content.published', label: 'Conteúdo publicado' },
  { value: 'approval.approved', label: 'Aprovação aprovada' },
  { value: 'approval.changes_requested', label: 'Ajuste solicitado' },
]

export default function DeveloperSettingsPage() {
  const { permissions } = usePermissions()
  const canEdit = permissions?.manageIntegrations ?? false

  return (
    <div className="max-w-2xl">
      <Link href="/configuracoes" className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <h1 className="text-2xl font-bold">Webhooks e API de agente</h1>
      <p className="mt-1 text-sm text-muted">Integre sistemas externos com eventos em tempo real e uma API programática.</p>

      <div className="mt-8 space-y-8">
        <WebhooksSection canEdit={canEdit} />
        <AgentTokensSection canEdit={canEdit} />
      </div>
    </div>
  )
}

function WebhooksSection({ canEdit }: { canEdit: boolean }) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [logFor, setLogFor] = useState<WebhookConfig | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/webhooks')
    if (res.ok) setWebhooks((await res.json()).webhooks)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleToggleActive(webhook: WebhookConfig) {
    const res = await fetch(`/api/webhooks/${webhook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !webhook.active }),
    })
    if (res.ok) load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este webhook?')) return
    const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  async function handleTest(id: string) {
    await fetch(`/api/webhooks/${id}/testar`, { method: 'POST' })
    alert('Evento de teste enviado — confira o log de entrega.')
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WebhookIcon className="size-4 text-brand" />
          <p className="font-medium">Webhooks de saída</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Novo webhook
          </Button>
        )}
      </div>

      {webhooks.length === 0 && <p className="text-sm text-muted">Nenhum webhook cadastrado.</p>}
      <div className="space-y-2">
        {webhooks.map((w) => (
          <Card key={w.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{w.url}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.events.map((e) => (
                    <Badge key={e}>{e}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge tone={w.active ? 'success' : 'default'}>{w.active ? 'ativo' : 'pausado'}</Badge>
                {canEdit && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setLogFor(w)} title="Ver log">
                      Log
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleTest(w.id)} title="Testar">
                      <Send className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleActive(w)}>
                      {w.active ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(w.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <NewWebhookModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(secret) => {
          setNewSecret(secret)
          setModalOpen(false)
          load()
        }}
      />

      <Modal open={!!newSecret} onClose={() => setNewSecret(null)} title="Webhook criado">
        <p className="text-sm text-muted">
          Guarde este secret — ele não será mostrado de novo. Use-o pra validar a assinatura HMAC-SHA256 no header{' '}
          <code>X-Posta-Signature</code>.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input readOnly value={newSecret ?? ''} className="text-xs" onFocus={(e) => e.target.select()} />
        </div>
        <Button className="mt-4 w-full" onClick={() => setNewSecret(null)}>
          Entendi
        </Button>
      </Modal>

      <Modal open={!!logFor} onClose={() => setLogFor(null)} title="Log de entrega" className="max-w-lg">
        {logFor && <WebhookLog webhookId={logFor.id} />}
      </Modal>
    </div>
  )
}

function WebhookLog({ webhookId }: { webhookId: string }) {
  const [events, setEvents] = useState<WebhookEvent[] | null>(null)

  useEffect(() => {
    fetch(`/api/webhooks/${webhookId}/eventos`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events))
  }, [webhookId])

  if (!events) return <p className="text-sm text-muted">Carregando…</p>
  if (events.length === 0) return <p className="text-sm text-muted">Nenhum evento entregue ainda.</p>

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {events.map((e) => (
        <div key={e.id} className="rounded-lg border border-border p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">{e.event_type}</span>
            <Badge tone={e.status === 'success' ? 'success' : e.status === 'failed' ? 'danger' : 'warning'}>{e.status}</Badge>
          </div>
          <p className="mt-1 text-muted">{new Date(e.created_at).toLocaleString('pt-BR')} · {e.attempts} tentativa(s)</p>
          {e.last_error && <p className="mt-1 text-danger">{e.last_error}</p>}
        </div>
      ))}
    </div>
  )
}

function NewWebhookModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (secret: string) => void }) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(event: WebhookEventType) {
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar o webhook.')
      return
    }
    setUrl('')
    setEvents([])
    onCreated(data.secret)
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo webhook">
      <div className="space-y-4">
        <div>
          <Label htmlFor="webhook-url">URL</Label>
          <Input id="webhook-url" placeholder="https://seu-sistema.com/webhooks/posta" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <Label>Eventos</Label>
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            {EVENT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center justify-between gap-2 text-sm">
                {opt.label}
                <input type="checkbox" checked={events.includes(opt.value)} onChange={() => toggle(opt.value)} className="size-4 accent-brand" />
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} disabled={!url || events.length === 0} onClick={handleSubmit}>
            Criar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AgentTokensSection({ canEdit }: { canEdit: boolean }) {
  const [tokens, setTokens] = useState<OrgAgentToken[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/agent/tokens')
    if (res.ok) setTokens((await res.json()).tokens)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleRevoke(id: string) {
    if (!confirm('Revogar este token? Qualquer integração usando-o vai parar de funcionar.')) return
    const res = await fetch(`/api/agent/tokens/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="size-4 text-brand" />
          <p className="font-medium">API de agente</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Novo token
          </Button>
        )}
      </div>
      <p className="mb-3 text-sm text-muted">
        Um token bearer dá acesso programático a clientes e conteúdos desta organização (<code>Authorization: Bearer &lt;token&gt;</code>).
      </p>

      {tokens.length === 0 && <p className="text-sm text-muted">Nenhum token gerado.</p>}
      <div className="space-y-2">
        {tokens.map((t) => (
          <Card key={t.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted">
                {t.token_prefix}… · {t.last_used_at ? `usado em ${new Date(t.last_used_at).toLocaleDateString('pt-BR')}` : 'nunca usado'}
              </p>
            </div>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => handleRevoke(t.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </Card>
        ))}
      </div>

      <NewTokenModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(secret) => {
          setNewToken(secret)
          setModalOpen(false)
          load()
        }}
      />

      <Modal open={!!newToken} onClose={() => setNewToken(null)} title="Token criado">
        <p className="text-sm text-muted">Guarde este token — ele não será mostrado de novo.</p>
        <div className="mt-3 flex items-center gap-2">
          <Input readOnly value={newToken ?? ''} className="text-xs" onFocus={(e) => e.target.select()} />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(newToken ?? '')
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <Button className="mt-4 w-full" onClick={() => setNewToken(null)}>
          Entendi
        </Button>
      </Modal>
    </div>
  )
}

function NewTokenModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (secret: string) => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/agent/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar o token.')
      return
    }
    setName('')
    onCreated(data.secret)
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo token de agente">
      <div className="space-y-4">
        <div>
          <Label htmlFor="token-name">Nome</Label>
          <Input id="token-name" placeholder="Ex.: Zapier, script interno…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} disabled={!name.trim()} onClick={handleSubmit}>
            Gerar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
