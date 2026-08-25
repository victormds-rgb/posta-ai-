'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Badge } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { Organization } from '@/lib/types'

export default function AdminOrganizacoesPage() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/organizacoes')
    if (res.ok) setOrgs((await res.json()).organizations)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  const filtered = orgs?.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase()))

  return (
    <div>
      <h1 className="text-2xl font-bold">Organizações</h1>
      <p className="mt-1 text-sm text-muted">Todas as organizações cadastradas no produto.</p>

      <input
        placeholder="Buscar por nome ou slug…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
      />

      {orgs === null ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : (
        <Card className="mt-4 divide-y divide-border">
          {filtered?.map((org) => (
            <Link key={org.id} href={`/admin/organizacoes/${org.id}`} className="flex items-center justify-between p-4 hover:bg-brand-soft/40">
              <div>
                <p className="text-sm font-medium">{org.name}</p>
                <p className="text-xs text-muted">
                  {org.slug} · criada em {formatDate(org.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="brand" className="capitalize">
                  {org.plan}
                </Badge>
                {org.subscription_status && <Badge>{org.subscription_status}</Badge>}
              </div>
            </Link>
          ))}
          {filtered?.length === 0 && <p className="p-4 text-sm text-muted">Nenhuma organização encontrada.</p>}
        </Card>
      )}
    </div>
  )
}
