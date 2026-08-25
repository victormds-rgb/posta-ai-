import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * Webhook do Stripe. Configure no Dashboard → Developers → Webhooks:
 *   URL: https://SEU-DOMINIO/api/billing/webhook
 *   Eventos: checkout.session.completed, customer.subscription.*, invoice.payment_failed
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook não configurado' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Assinatura inválida: ${err instanceof Error ? err.message : err}` }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Idempotência — Stripe pode reenviar o mesmo evento.
  const { data: already } = await admin.from('stripe_webhook_events').select('id').eq('id', event.id).maybeSingle()
  if (already) return NextResponse.json({ received: true })
  await admin.from('stripe_webhook_events').insert({ id: event.id, type: event.type })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        if (orgId && session.subscription) {
          await syncSubscription(orgId, session.subscription as string)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id || (await orgIdFromCustomer(subscription.customer as string))
        if (orgId) await applySubscription(orgId, subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id || (await orgIdFromCustomer(subscription.customer as string))
        if (orgId) {
          await admin
            .from('organizations')
            .update({
              plan: 'free',
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              cancel_at_period_end: false,
            })
            .eq('id', orgId)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = await orgIdFromCustomer(invoice.customer as string)
        if (orgId) {
          await admin.from('organizations').update({ subscription_status: 'past_due' }).eq('id', orgId)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[billing.webhook]', event.type, err)
    // Já registramos o evento como processado — devolve 200 pra evitar retry
    // infinito do Stripe; o erro fica no log do servidor pra investigação.
  }

  return NextResponse.json({ received: true })

  async function orgIdFromCustomer(customerId: string): Promise<string | null> {
    const { data } = await admin.from('organizations').select('id').eq('stripe_customer_id', customerId).maybeSingle()
    return data?.id || null
  }

  async function syncSubscription(orgId: string, subscriptionId: string) {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await applySubscription(orgId, subscription)
  }

  async function applySubscription(orgId: string, subscription: Stripe.Subscription) {
    const priceId = subscription.items.data[0]?.price.id
    const plan = priceId ? planFromPriceId(priceId) : null
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end

    await admin
      .from('organizations')
      .update({
        plan: plan || 'free',
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      })
      .eq('id', orgId)
  }
}
