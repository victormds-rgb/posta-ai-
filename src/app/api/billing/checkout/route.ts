import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, checkoutSchema } from '@/lib/validation'
import { getStripe, getPriceId } from '@/lib/stripe'
import { getAppUrl } from '@/lib/get-app-url'

/** Cria uma sessão de Checkout do Stripe pro plano/intervalo escolhido. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageBilling')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, checkoutSchema)
  if (validationError) return validationError

  let stripe
  let priceId
  try {
    stripe = getStripe()
    priceId = getPriceId(body.plan, body.interval)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Billing não configurado nesta instância.' },
      { status: 400 },
    )
  }

  const supabase = await createServerSupabase()
  let customerId = ctx.organization.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: ctx.organization.name,
      email: ctx.email || undefined,
      metadata: { org_id: ctx.organization.id },
    })
    customerId = customer.id
    await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', ctx.organization.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getAppUrl()}/configuracoes/assinatura?checkout=success`,
    cancel_url: `${getAppUrl()}/configuracoes/assinatura?checkout=canceled`,
    metadata: { org_id: ctx.organization.id },
    subscription_data: { metadata: { org_id: ctx.organization.id } },
  })

  return NextResponse.json({ url: session.url })
}
