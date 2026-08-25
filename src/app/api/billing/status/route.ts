import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { PLAN_NAMES, PLAN_FEATURES, PLAN_PRICES_BRL } from '@/lib/stripe'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  return NextResponse.json({
    plan: ctx.organization.plan,
    subscriptionStatus: ctx.organization.subscription_status,
    currentPeriodEnd: ctx.organization.current_period_end,
    cancelAtPeriodEnd: ctx.organization.cancel_at_period_end,
    trialEnd: ctx.organization.trial_end,
    hasStripeCustomer: !!ctx.organization.stripe_customer_id,
    canManageBilling: ctx.permissions.manageBilling,
    plans: { names: PLAN_NAMES, features: PLAN_FEATURES, pricesBRL: PLAN_PRICES_BRL },
  })
}
