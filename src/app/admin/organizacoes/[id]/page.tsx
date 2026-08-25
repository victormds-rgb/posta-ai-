'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, Badge } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { Client, Member, Organization } from '@/lib/types'

const PLANS = ['free', 'starter', 'pro', 'agency'] as const

export default function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [contentCount, setContentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/organizacoes/${id}`)
    if (res.ok) {
      const data = await res.json()
      setOrg(data.organization)
      setMembers(data.members)
      setClients(data.clients)
      setContentCount(data.contentCount)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleChangePlan(plan: string) {
    if (!confirm(`Mudar o plano desta organização pra "${plan}"?`)) return
    setChangingPlan(true)
    const res = await fetch(`/api/admin/organizacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    setChangingPlan(false)
    if (res.ok) load()
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>
  if (!org) return <p className="text-sm text-muted">Organização não encontrada.</p>

  return (
    <div className="max-w-2xl">
      <Link href="/admin/organizacoes" className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <h1 className="text-xl font-bold">{org.name}</h1>
      <p className="text-sm text-muted">
        {org.slug} · criada em {formatDate(org.created_at)}
      </p>

      <Card className="mt-6 p-5">
        <p className="mb-2 text-sm font-semibold">Plano</p>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((plan) => (
            <button
              key={plan}
              disabled={changingPlan}
              onClick={() => handleChangePlan(plan)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                org.plan === plan ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
        {org.subscription_status && (
          <p className="mt-2 text-xs text-muted">
            Status Stripe: {org.subscription_status}
            {org.cancel_at_period_end && ' · cancela ao fim do período'}
          </p>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Clientes</p>
          <p className="text-xl font-bold">{clients.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Conteúdos</p>
          <p className="text-xl font-bold">{contentCount}</p>
        </Card>
      </div>

      <p className="mt-6 mb-2 text-sm font-semibold">Equipe ({members.length})</p>
      <Card className="divide-y divide-border">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 text-sm">
            <span>{m.display_name || m.user_id}</span>
            <Badge>{m.role}</Badge>
          </div>
        ))}
      </Card>
    </div>
  )
}
