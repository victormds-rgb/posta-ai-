import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

const fakeSupabase = createFakeSupabase({ organizations: [], stripe_webhook_events: [] })

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
  createServerSupabase: vi.fn(async () => fakeSupabase),
}))

const constructEventMock = vi.fn()
const retrieveSubscriptionMock = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: retrieveSubscriptionMock },
  })),
  planFromPriceId: vi.fn((priceId: string) => (priceId === 'price_pro_month' ? 'pro' : null)),
}))

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

describe('POST /api/billing/webhook', () => {
  beforeEach(() => {
    fakeSupabase.__store.organizations = [
      { id: 'org-1', stripe_customer_id: 'cus_123', plan: 'free', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.stripe_webhook_events = []
    constructEventMock.mockReset()
    retrieveSubscriptionMock.mockReset()
  })

  it('rejeita sem header de assinatura', async () => {
    const { POST } = await import('../webhook/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('rejeita quando a verificação de assinatura falha', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('assinatura inválida de propósito')
    })
    const { POST } = await import('../webhook/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig_falsa' } }),
    )
    expect(res.status).toBe(400)
  })

  it('checkout.session.completed ativa o plano correto na organização', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { org_id: 'org-1' }, subscription: 'sub_123' } },
    })
    retrieveSubscriptionMock.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ price: { id: 'price_pro_month' }, current_period_end: 1893456000 }] },
    })

    const { POST } = await import('../webhook/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig_valida' } }),
    )
    expect(res.status).toBe(200)

    const org = fakeSupabase.__store.organizations.find((o) => o.id === 'org-1')
    expect(org?.plan).toBe('pro')
    expect(org?.stripe_subscription_id).toBe('sub_123')
    expect(org?.subscription_status).toBe('active')
  })

  it('não processa o mesmo evento duas vezes (idempotência)', async () => {
    fakeSupabase.__store.stripe_webhook_events = [{ id: 'evt_repetido', type: 'checkout.session.completed', created_at: '2026-01-01' }]
    constructEventMock.mockReturnValue({
      id: 'evt_repetido',
      type: 'checkout.session.completed',
      data: { object: { metadata: { org_id: 'org-1' }, subscription: 'sub_123' } },
    })

    const { POST } = await import('../webhook/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig_valida' } }),
    )
    expect(res.status).toBe(200)
    expect(retrieveSubscriptionMock).not.toHaveBeenCalled()
    const org = fakeSupabase.__store.organizations.find((o) => o.id === 'org-1')
    expect(org?.plan).toBe('free') // não mudou
  })

  it('customer.subscription.deleted reverte a organização pro plano free', async () => {
    fakeSupabase.__store.organizations = [
      { id: 'org-1', stripe_customer_id: 'cus_123', plan: 'pro', stripe_subscription_id: 'sub_123', created_at: '2026-01-01' },
    ]
    constructEventMock.mockReturnValue({
      id: 'evt_del',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_123', metadata: {} } },
    })

    const { POST } = await import('../webhook/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig_valida' } }),
    )
    expect(res.status).toBe(200)
    const org = fakeSupabase.__store.organizations.find((o) => o.id === 'org-1')
    expect(org?.plan).toBe('free')
    expect(org?.stripe_subscription_id).toBeNull()
  })
})
