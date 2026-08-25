import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { getStripe } from '@/lib/stripe'
import { getAppUrl } from '@/lib/get-app-url'

/** Cria uma sessão do Customer Portal do Stripe (gerenciar assinatura/faturas). */
export async function POST() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageBilling')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!ctx.organization.stripe_customer_id) {
    return NextResponse.json({ error: 'Esta organização ainda não tem assinatura.' }, { status: 400 })
  }

  let stripe
  try {
    stripe = getStripe()
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Billing não configurado.' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: ctx.organization.stripe_customer_id,
    return_url: `${getAppUrl()}/configuracoes/assinatura`,
  })

  return NextResponse.json({ url: session.url })
}
