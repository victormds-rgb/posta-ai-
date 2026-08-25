'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { Card, Badge } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface BillingStatus {
  plan: string
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEnd: string | null
  hasStripeCustomer: boolean
  canManageBilling: boolean
  plans: {
    names: Record<string, string>
    features: Record<string, string[]>
    pricesBRL: Record<string, { monthly: number; annual: number }>
  }
}

export default function AssinaturaPage() {
  return (
    <Suspense>
      <AssinaturaView />
    </Suspense>
  )
}

function AssinaturaView() {
  const checkoutResult = useSearchParams().get('checkout')
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/billing/status')
    if (res.ok) setStatus(await res.json())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
  }, [load])

  async function handleSubscribe(plan: string) {
    setLoadingPlan(plan)
    setError(null)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, interval }),
    })
    const data = await res.json().catch(() => ({}))
    setLoadingPlan(null)
    if (!res.ok) {
      setError(data.error || 'Não foi possível iniciar o checkout.')
      return
    }
    if (data.url) window.location.assign(data.url)
  }

  async function handlePortal() {
    setError(null)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível abrir o portal de assinatura.')
      return
    }
    if (data.url) window.location.assign(data.url)
  }

  if (!status) return <p className="text-sm text-muted">Carregando…</p>

  const plans = ['starter', 'pro', 'agency']

  return (
    <div className="max-w-3xl">
      <Link href="/configuracoes" className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Voltar
      </Link>

      <h1 className="text-2xl font-bold">Assinatura</h1>
      <p className="mt-1 text-sm text-muted">
        Plano atual: <strong>{status.plans.names[status.plan] || status.plan}</strong>
        {status.subscriptionStatus && ` · ${status.subscriptionStatus}`}
        {status.cancelAtPeriodEnd && status.currentPeriodEnd && ` · cancela em ${formatDate(status.currentPeriodEnd)}`}
      </p>

      {checkoutResult === 'success' && <p className="mt-3 text-sm text-success">Assinatura ativada! Pode levar alguns segundos pra atualizar.</p>}
      {checkoutResult === 'canceled' && <p className="mt-3 text-sm text-muted">Checkout cancelado.</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {status.hasStripeCustomer && status.canManageBilling && (
        <Button variant="secondary" className="mt-4" onClick={handlePortal}>
          Gerenciar assinatura / faturas
        </Button>
      )}

      <div className="mt-6 flex items-center gap-2 text-sm">
        <button
          onClick={() => setInterval('month')}
          className={interval === 'month' ? 'font-semibold text-brand' : 'text-muted'}
        >
          Mensal
        </button>
        <span className="text-muted">/</span>
        <button
          onClick={() => setInterval('year')}
          className={interval === 'year' ? 'font-semibold text-brand' : 'text-muted'}
        >
          Anual
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const price = status.plans.pricesBRL[plan]
          const isCurrent = status.plan === plan
          return (
            <Card key={plan} className={`p-5 ${isCurrent ? 'border-brand' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{status.plans.names[plan]}</h3>
                {isCurrent && <Badge tone="brand">atual</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold">
                R$ {interval === 'month' ? price.monthly : Math.round(price.annual / 12)}
                <span className="text-sm font-normal text-muted">/mês</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {status.plans.features[plan].map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              {status.canManageBilling && !isCurrent && (
                <Button size="sm" className="mt-4 w-full" loading={loadingPlan === plan} onClick={() => handleSubscribe(plan)}>
                  Assinar
                </Button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
