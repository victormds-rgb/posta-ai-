process.env.CREDENTIALS_ENCRYPTION_KEY ||= 'd'.repeat(64)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ webhook_configs: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

let currentContext: Awaited<ReturnType<typeof import('@/lib/org').getCurrentContext>> | null = null

vi.mock('@/lib/org', () => ({
  getCurrentContext: vi.fn(async () => currentContext),
}))

function makeContext(role: Member['role']) {
  const member: Member = {
    id: 'member-1',
    user_id: 'user-1',
    org_id: 'org-1',
    role,
    display_name: 'Fulano',
    avatar_url: null,
    status: 'active',
    created_at: new Date().toISOString(),
    custom_permissions: null,
  }
  const organization: Organization = {
    id: 'org-1',
    name: 'Org',
    slug: 'org',
    logo_url: null,
    plan: 'free',
    brand_color: '#000',
    upload_post_api_key: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    current_period_end: null,
    cancel_at_period_end: false,
    trial_end: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { userId: 'user-1', email: 'a@b.com', member, organization, permissions: getEffectivePermissions(member) }
}

describe('GET/POST /api/webhooks', () => {
  beforeEach(() => {
    fakeSupabase.__store.webhook_configs = []
    currentContext = null
  })

  it('403 pra quem não tem manageIntegrations (designer)', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ url: 'https://x.com', events: ['content.created'] }) }),
    )
    expect(res.status).toBe(403)
  })

  it('rejeita sem nenhum evento selecionado', async () => {
    currentContext = makeContext('admin')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ url: 'https://x.com', events: [] }) }))
    expect(res.status).toBe(400)
  })

  it('cria o webhook, devolve o secret uma vez e cifra no banco', async () => {
    currentContext = makeContext('gestor')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ url: 'https://x.com/hook', events: ['content.published'] }) }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(typeof body.secret).toBe('string')
    expect(body.secret.length).toBeGreaterThan(10)
    expect(fakeSupabase.__store.webhook_configs[0].secret).not.toBe(body.secret) // cifrado
  })

  it('isola webhooks por organização', async () => {
    fakeSupabase.__store.webhook_configs = [
      { id: 'w1', org_id: 'org-1', url: 'https://a.com', secret: 'x', events: ['content.created'], active: true, created_at: '2026-01-01' },
      { id: 'w2', org_id: 'org-OUTRA', url: 'https://b.com', secret: 'x', events: ['content.created'], active: true, created_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET()
    const body = await res.json()
    expect(body.webhooks).toHaveLength(1)
    expect(body.webhooks[0].id).toBe('w1')
  })
})
