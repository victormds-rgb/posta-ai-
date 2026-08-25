'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Palette } from 'lucide-react'
import type { BrandAsset, Client } from '@/lib/types'

export default function PortalBrandPage() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandAsset | null | undefined>(undefined)

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/clientes')
    if (!res.ok) return
    const data = await res.json()
    setClients(data.clients)
    if (data.clients.length > 0) setSelectedClient(data.clients[0].id)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!selectedClient) return
    let cancelled = false
    fetch(`/api/clientes/${selectedClient}/brand`)
      .then((res) => (res.ok ? res.json() : { brand: null }))
      .then((data) => {
        if (!cancelled) setBrand(data.brand)
      })
    return () => {
      cancelled = true
    }
  }, [selectedClient])

  if (clients === null) return <p className="text-sm text-muted">Carregando…</p>
  if (clients.length === 0) {
    return <EmptyState icon={<Palette className="size-8" />} title="Nenhum acesso configurado" />
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Brand book</h1>
      <p className="mt-1 text-sm text-muted">Diretrizes de marca definidas pela sua agência.</p>

      {clients.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClient(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selectedClient === c.id ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {brand === undefined && <p className="mt-6 text-sm text-muted">Carregando…</p>}
      {brand === null && (
        <div className="mt-6">
          <EmptyState icon={<Palette className="size-8" />} title="Ainda sem brand book" description="A agência ainda não cadastrou diretrizes de marca para este cliente." />
        </div>
      )}
      {brand && (
        <Card className="mt-6 space-y-4 p-5">
          {brand.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo_url} alt="Logo" className="max-h-24" />
          )}
          <div className="flex gap-3">
            {[brand.primary_color, brand.secondary_color, brand.accent_color].filter(Boolean).map((color) => (
              <div key={color} className="flex flex-col items-center gap-1">
                <div className="size-12 rounded-full border border-border" style={{ backgroundColor: color! }} />
                <span className="text-xs text-muted">{color}</span>
              </div>
            ))}
          </div>
          {brand.fonts && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Fontes</p>
              <p className="text-sm">{brand.fonts}</p>
            </div>
          )}
          {brand.guidelines && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Diretrizes</p>
              <p className="whitespace-pre-wrap text-sm">{brand.guidelines}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
