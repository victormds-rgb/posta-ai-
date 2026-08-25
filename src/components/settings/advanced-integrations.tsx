'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { CheckCircle2, HardDrive, Megaphone, Unplug } from 'lucide-react'
import type { OrgGoogleDriveConfig, OrgMetaAdsConfig } from '@/lib/types'

export function AdvancedIntegrations({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-6">
      <MetaAdsSection canEdit={canEdit} />
      <GoogleDriveSection canEdit={canEdit} />
    </div>
  )
}

function MetaAdsSection({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<OrgMetaAdsConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [adAccountId, setAdAccountId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/integracoes/meta-ads')
    if (res.ok) setConfig((await res.json()).config)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    const res = await fetch('/api/integracoes/meta-ads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, ad_account_id: adAccountId }),
    })
    setConnecting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível conectar.')
      return
    }
    setConfig(data.config)
    setToken('')
  }

  async function handleDisconnect() {
    const res = await fetch('/api/integracoes/meta-ads', { method: 'DELETE' })
    if (res.ok) setConfig(null)
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-brand" />
        <p className="font-medium">Meta Ads</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Lê métricas de anúncios (gasto, impressões, cliques) da conta conectada. Gere um token de longa duração no Meta Business
        Suite (Configurações do negócio → Usuários do sistema) e cole abaixo — não é necessário revisar um app com a Meta pra isso.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Carregando…</p>
      ) : config ? (
        <div className="mt-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            Conta <strong>{config.ad_account_id}</strong> conectada
          </p>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={handleDisconnect}>
              <Unplug className="size-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      ) : canEdit ? (
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="meta-token">Access token</Label>
            <Input id="meta-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="meta-account">ID da conta de anúncios</Label>
            <Input id="meta-account" placeholder="123456789" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="sm" loading={connecting} disabled={!token || !adAccountId} onClick={handleConnect}>
            Conectar
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Não conectado.</p>
      )}
    </Card>
  )
}

function GoogleDriveSection({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<OrgGoogleDriveConfig | null>(null)
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/google-drive/status')
    if (res.ok) {
      const data = await res.json()
      setConfig(data.config)
      setConfigured(data.configured)
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
    const res = await fetch('/api/google-drive/connect')
    setConnecting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível iniciar a conexão.')
      return
    }
    window.location.assign(data.url)
  }

  async function handleDisconnect() {
    const res = await fetch('/api/google-drive/status', { method: 'DELETE' })
    if (res.ok) setConfig(null)
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <HardDrive className="size-4 text-brand" />
        <p className="font-medium">Google Drive</p>
      </div>
      <p className="mt-1 text-sm text-muted">Importa arquivos do Google Drive direto pro Acervo digital de um cliente.</p>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Carregando…</p>
      ) : !configured ? (
        <p className="mt-3 text-sm text-muted">
          Não disponível neste ambiente — faltam as credenciais <code>GOOGLE_DRIVE_CLIENT_ID</code>/
          <code>GOOGLE_DRIVE_CLIENT_SECRET</code> (ver <code>.env.example</code>).
        </p>
      ) : config ? (
        <div className="mt-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            Conectado
          </p>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={handleDisconnect}>
              <Unplug className="size-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      ) : canEdit ? (
        <div className="mt-3">
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <Button size="sm" loading={connecting} onClick={handleConnect}>
            Conectar com Google
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Não conectado.</p>
      )}
    </Card>
  )
}
