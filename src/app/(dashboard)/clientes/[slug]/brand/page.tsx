'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { usePermissions } from '@/hooks/use-permissions'
import type { BrandAsset, Client } from '@/lib/types'

export default function BrandBookPage() {
  const { slug } = useParams<{ slug: string }>()
  const { permissions } = usePermissions()
  const canEdit = permissions?.manageClients ?? false

  const [client, setClient] = useState<Client | null>(null)
  const [form, setForm] = useState({
    primary_color: '',
    secondary_color: '',
    accent_color: '',
    fonts: '',
    logo_url: '',
    guidelines: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const clientsRes = await fetch('/api/clientes')
    if (!clientsRes.ok) return
    const { clients } = await clientsRes.json()
    const found: Client | undefined = clients.find((c: Client) => c.slug === slug)
    setClient(found ?? null)
    if (found) {
      const brandRes = await fetch(`/api/clientes/${found.id}/brand`)
      if (brandRes.ok) {
        const { brand } = (await brandRes.json()) as { brand: BrandAsset | null }
        if (brand) {
          setForm({
            primary_color: brand.primary_color ?? '',
            secondary_color: brand.secondary_color ?? '',
            accent_color: brand.accent_color ?? '',
            fonts: brand.fonts ?? '',
            logo_url: brand.logo_url ?? '',
            guidelines: brand.guidelines ?? '',
          })
        }
      }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleSave() {
    if (!client) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await fetch(`/api/clientes/${client.id}/brand`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível salvar.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>
  if (!client) return <p className="text-sm text-muted">Cliente não encontrado.</p>

  return (
    <div className="max-w-2xl">
      <Link href={`/clientes/${client.slug}`} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar para {client.name}
      </Link>

      <h1 className="text-xl font-bold">Brand book — {client.name}</h1>
      <p className="mt-1 text-sm text-muted">Diretrizes de marca visíveis pra este cliente no Portal.</p>

      <Card className="mt-6 space-y-4 p-5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="primary">Cor primária</Label>
            <Input id="primary" placeholder="#6366F1" disabled={!canEdit} value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="secondary">Cor secundária</Label>
            <Input id="secondary" placeholder="#111827" disabled={!canEdit} value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="accent">Cor de destaque</Label>
            <Input id="accent" placeholder="#F59E0B" disabled={!canEdit} value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="fonts">Fontes</Label>
          <Input id="fonts" placeholder="Ex.: Inter (títulos), Georgia (corpo)" disabled={!canEdit} value={form.fonts} onChange={(e) => setForm({ ...form, fonts: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="logo">URL do logo</Label>
          <Input id="logo" placeholder="https://…" disabled={!canEdit} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="guidelines">Diretrizes</Label>
          <Textarea id="guidelines" rows={6} disabled={!canEdit} value={form.guidelines} onChange={(e) => setForm({ ...form, guidelines: e.target.value })} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-success">Salvo!</p>}

        {canEdit && (
          <div className="flex justify-end">
            <Button loading={saving} onClick={handleSave}>
              Salvar
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
