'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { usePermissions } from '@/hooks/use-permissions'
import type { Client, ClientSocialProfile } from '@/lib/types'

export default function RedesSociaisPage() {
  const { slug } = useParams<{ slug: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const { permissions } = usePermissions()
  const canManageIntegrations = permissions?.manageIntegrations ?? false
  const [profile, setProfile] = useState<ClientSocialProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const clientsRes = await fetch('/api/clientes')
    if (!clientsRes.ok) return
    const { clients } = await clientsRes.json()
    const found: Client | undefined = clients.find((c: Client) => c.slug === slug)
    setClient(found ?? null)
    if (found) {
      const statusRes = await fetch(`/api/social/status?client_id=${found.id}`)
      if (statusRes.ok) {
        const data = await statusRes.json()
        setProfile(data.profile)
      }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleConnect() {
    if (!client) return
    setConnecting(true)
    setError(null)
    const res = await fetch('/api/social/connect-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id }),
    })
    setConnecting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível gerar o link de conexão.')
      return
    }
    window.open(data.access_url, '_blank', 'noopener,noreferrer')
  }

  async function handleSync() {
    if (!client) return
    setSyncing(true)
    const res = await fetch(`/api/social/status?client_id=${client.id}&sync=1`)
    setSyncing(false)
    if (res.ok) {
      const data = await res.json()
      setProfile(data.profile)
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

      <h1 className="text-xl font-bold">Redes sociais — {client.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Conecte as redes do cliente via Upload-Post para publicar direto pela plataforma.
      </p>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Conexão</p>
            <p className="text-sm text-muted">
              {profile ? `Perfil: ${profile.upload_post_username}` : 'Nenhuma conexão iniciada ainda.'}
            </p>
          </div>
          {canManageIntegrations && (
            <div className="flex gap-2">
              {profile && (
                <Button variant="secondary" size="sm" onClick={handleSync} loading={syncing}>
                  <RefreshCw className="size-4" />
                  Sincronizar
                </Button>
              )}
              <Button size="sm" onClick={handleConnect} loading={connecting}>
                <ExternalLink className="size-4" />
                {profile ? 'Gerenciar conexões' : 'Conectar redes'}
              </Button>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {profile && profile.connected_platforms.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {profile.connected_platforms.map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize">
                  <CheckCircle2 className="size-4 text-success" />
                  {p.platform}
                </span>
                <Badge>{p.display_name || p.username || 'conectado'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
