'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Check, Copy, MessageCircle, Send, QrCode, RefreshCw, Unplug } from 'lucide-react'

interface WhatsAppConfig {
  id: string
  instance_id: string
  phone?: string | null
  status: string
  webhookUrl?: string
  error?: string
}

interface TelegramConfig {
  id: string
  bot_username: string | null
  approval_chat_id: string | null
  status: string
}

export function CommunicationSettings({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-6">
      <WhatsAppSection canEdit={canEdit} />
      <TelegramSection canEdit={canEdit} />
    </div>
  )
}

function WhatsAppSection({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/whatsapp/status')
    if (res.ok) {
      const data = await res.json()
      setConfig(data.config)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    const res = await fetch('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId, token }),
    })
    setConnecting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível conectar.')
      return
    }
    setInstanceId('')
    setToken('')
    load()
  }

  async function handleShowQr() {
    setLoadingQr(true)
    setError(null)
    const res = await fetch('/api/whatsapp/qr')
    setLoadingQr(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível obter o QR code.')
      return
    }
    if (data.connected) {
      setQrCode(null)
      load()
      return
    }
    setQrCode(data.qrCode || null)
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp desta organização?')) return
    await fetch('/api/whatsapp/disconnect', { method: 'POST' })
    setQrCode(null)
    load()
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-5 text-success" />
        <p className="font-medium">WhatsApp (Z-API)</p>
      </div>
      <p className="text-sm text-muted">
        Cada organização conecta sua própria instância na{' '}
        <a href="https://z-api.io" target="_blank" rel="noreferrer" className="text-brand hover:underline">
          Z-API
        </a>{' '}
        (serviço pago e não-oficial — cria risco de banimento do número, veja os termos deles antes de conectar).
      </p>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : config ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              Instância <strong>{config.instance_id}</strong>
              {config.phone && ` · ${config.phone}`}
            </span>
            <span
              className={
                config.status === 'connected' ? 'text-success' : config.status === 'error' ? 'text-danger' : 'text-warning'
              }
            >
              {config.status}
            </span>
          </div>
          {config.error && <p className="text-xs text-danger">{config.error}</p>}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handleShowQr} loading={loadingQr}>
                <QrCode className="size-4" />
                Ver QR code
              </Button>
              <Button size="sm" variant="secondary" onClick={load}>
                <RefreshCw className="size-4" />
                Atualizar status
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={handleDisconnect}>
                <Unplug className="size-4" />
                Desconectar
              </Button>
            </div>
          )}
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="QR code do WhatsApp" className="mx-auto w-48 rounded-lg border border-border" />
          )}
          {config.webhookUrl && (
            <div>
              <Label className="text-xs">URL de webhook (cole no painel da Z-API)</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={config.webhookUrl} className="text-xs" onFocus={(e) => e.target.select()} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(config.webhookUrl!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor="zapi-instance">Instance ID</Label>
            <Input id="zapi-instance" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="zapi-token">Token</Label>
            <Input id="zapi-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button size="sm" onClick={handleConnect} loading={connecting} disabled={!instanceId || !token}>
            Conectar
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Não conectado.</p>
      )}
    </Card>
  )
}

function TelegramSection({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<TelegramConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/telegram/status')
    if (res.ok) {
      const data = await res.json()
      setConfig(data.config)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    const res = await fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token: botToken, approval_chat_id: chatId || undefined }),
    })
    setConnecting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível conectar.')
      return
    }
    setConfig(data.config)
    setBotToken('')
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Send className="size-5 text-brand" />
        <p className="font-medium">Telegram</p>
      </div>
      <p className="text-sm text-muted">
        Crie um bot com o{' '}
        <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-brand hover:underline">
          @BotFather
        </a>
        , cole o token abaixo e informe o chat/grupo onde os pedidos de aprovação interna devem chegar (com botões de
        aprovar/ajustar direto na mensagem).
      </p>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : config ? (
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <p>
            Bot <strong>@{config.bot_username}</strong> — {config.status}
          </p>
          {config.approval_chat_id && <p className="text-muted">Chat de aprovação: {config.approval_chat_id}</p>}
        </div>
      ) : canEdit ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor="tg-token">Token do bot</Label>
            <Input id="tg-token" type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tg-chat">Chat ID de aprovação (opcional)</Label>
            <Input id="tg-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-100123456789" />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button size="sm" onClick={handleConnect} loading={connecting} disabled={!botToken}>
            Conectar
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Não conectado.</p>
      )}
    </Card>
  )
}
