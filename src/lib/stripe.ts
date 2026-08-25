import 'server-only'
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

/** Cliente Stripe, criado sob demanda (evita quebrar o build sem a env var). */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')
    stripeInstance = new Stripe(key)
  }
  return stripeInstance
}

export type PlanName = 'starter' | 'pro' | 'agency'
export type PlanInterval = 'month' | 'year'

export function getPriceId(plan: PlanName, interval: PlanInterval): string {
  const key = `NEXT_PUBLIC_STRIPE_${plan.toUpperCase()}_${interval === 'month' ? 'MONTHLY' : 'ANNUAL'}`
  const id = process.env[key]
  if (!id) throw new Error(`Variável de ambiente ausente: ${key}`)
  return id
}

/** Plano correspondente a um price ID do Stripe — usado pelo webhook pra saber o que ativar. */
export function planFromPriceId(priceId: string): PlanName | null {
  const plans: PlanName[] = ['starter', 'pro', 'agency']
  const intervals: PlanInterval[] = ['month', 'year']
  for (const plan of plans) {
    for (const interval of intervals) {
      try {
        if (getPriceId(plan, interval) === priceId) return plan
      } catch {
        // price id não configurado — ignora
      }
    }
  }
  return null
}

export const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

export const PLAN_PRICES_BRL: Record<PlanName, { monthly: number; annual: number }> = {
  starter: { monthly: 97, annual: 924 },
  pro: { monthly: 197, annual: 1884 },
  agency: { monthly: 397, annual: 3804 },
}

export const PLAN_FEATURES: Record<string, string[]> = {
  free: ['1 cliente', '5 conteúdos/mês', 'Workflow básico'],
  starter: ['5 clientes', '50 conteúdos/mês', 'WhatsApp/Telegram', 'Suporte por e-mail'],
  pro: ['20 clientes', '200 conteúdos/mês', 'Tudo do Starter', 'Aprovação interna', 'Publicação e agendamento'],
  agency: ['Clientes ilimitados', 'Conteúdos ilimitados', 'Tudo do Pro', 'Suporte prioritário'],
}

/** Limites de uso por plano — Infinity = sem limite. Aplicado em src/lib/plan-limits.ts. */
export const PLAN_LIMITS: Record<string, { clients: number; contentPerMonth: number }> = {
  free: { clients: 1, contentPerMonth: 5 },
  starter: { clients: 5, contentPerMonth: 50 },
  pro: { clients: 20, contentPerMonth: 200 },
  agency: { clients: Infinity, contentPerMonth: Infinity },
}
