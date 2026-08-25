process.env.CREDENTIALS_ENCRYPTION_KEY ||= 'e'.repeat(64)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import { encryptSecret } from '@/lib/crypto'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ webhook_configs: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '10.0.0.1', family: 4 }]), // resolve pra IP privado de propósito
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

describe('POST /api/webhooks/[id]/testar', () => {
  beforeEach(() => {
    fakeSupabase.__store.webhook_configs = [
      { id: 'wh1', org_id: 'org-1', url: 'https://dominio-que-resolve-pra-dentro.com/hook', secret: encryptSecret('s'), events: ['content.created'], active: true, created_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
  })

  it('403 sem manageIntegrations', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../[id]/testar/route')
    const res = await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'wh1' }) })
    expect(res.status).toBe(403)
  })

  it('não entrega (SSRF bloqueado) quando a URL resolve pra rede interna', async () => {
    const { POST } = await import('../[id]/testar/route')
    const res = await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'wh1' }) })
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeTruthy()
  })
})
