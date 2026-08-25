'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { usePermissions } from '@/hooks/use-permissions'
import type { Client, ClientWordPressConfig } from '@/lib/types'

export default function WordPressConfigPage() {
  const { slug } = useParams<{ slug: string }>()
  const { permissions } = usePermissions()
  const canManage = permissions?.manageIntegrations ?? false

  const [client, setClient] = useState<Client | null>(null)
  const [config, setConfig] = useState<ClientWordPressConfig | null>(null)
  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const clientsRes = await fetch('/api/clientes')
    if (!clientsRes.ok) return
    const { clients } = await clientsRes.json()
    const found: Client | undefined = clients.find((c: Client) => c.slug === slug)
    setClient(found ?? null)
    if (found) {
      const res = await fetch(`/api/clientes/${found.id}/wordpress`)
      if (res.ok) setConfig((await res.json()).config)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleConnect() {
    if (!client) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/clientes/${client.id}/wordpress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_url: siteUrl, username, app_password: appPassword }),
    })
    setSaving(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível conectar.')
      return
    }
    setConfig(data.config)
    setAppPassword('')
  }

  async function handleDisconnect() {
    if (!client) return
    const res = await fetch(`/api/clientes/${client.id}/wordpress`, { method: 'DELETE' })
    if (res.ok) setConfig(null)
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>
  if (!client) return <p className="text-sm text-muted">Cliente não encontrado.</p>

  return (
    <div className="max-w-lg">
      <Link href={`/clientes/${client.slug}`} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar para {client.name}
      </Link>

      <h1 className="text-xl font-bold">WordPress — {client.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Espelhe conteúdos publicados no blog do cliente, via Application Password (Usuários → Perfil → Senhas de Aplicativo, no WP dele).
      </p>

      <Card className="mt-6 p-5">
        {config ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-success" />
              Conectado a <strong>{config.site_url}</strong> ({config.username})
            </div>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={handleDisconnect}>
                Desconectar
              </Button>
            )}
          </div>
        ) : canManage ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="wp-url">URL do site</Label>
              <Input id="wp-url" placeholder="https://blog.cliente.com" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wp-user">Usuário</Label>
              <Input id="wp-user" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wp-pass">Senha de aplicativo</Label>
              <Input id="wp-pass" type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button loading={saving} disabled={!siteUrl || !username || !appPassword} onClick={handleConnect}>
              Conectar e testar
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum WordPress conectado.</p>
        )}
      </Card>
    </div>
  )
}
