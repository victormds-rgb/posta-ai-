process.env.CREDENTIALS_ENCRYPTION_KEY ||= 'b'.repeat(64)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ org_meta_ads_config: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

const metaValidateTokenMock = vi.fn()
vi.mock('@/lib/meta-ads', () => ({
  metaValidateToken: (...args: unknown[]) => metaValidateTokenMock(...args),
  metaGetAdAccountInsights: vi.fn(),
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

describe('GET/PUT/DELETE /api/integracoes/meta-ads', () => {
  beforeEach(() => {
    fakeSupabase.__store.org_meta_ads_config = []
    metaValidateTokenMock.mockReset()
    currentContext = null
  })

  it('403 pra role=cliente', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('rejeita token inválido', async () => {
    metaValidateTokenMock.mockResolvedValue({ success: false, error: 'token expirado' })
    currentContext = makeContext('admin')
    const { PUT } = await import('../route')
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ access_token: 'x', ad_account_id: '123' }) }))
    expect(res.status).toBe(400)
  })

  it('conecta com token válido', async () => {
    metaValidateTokenMock.mockResolvedValue({ success: true, data: { id: 'u1' } })
    currentContext = makeContext('gestor')
    const { PUT } = await import('../route')
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ access_token: 'tok-valido', ad_account_id: '123456' }) }))
    expect(res.status).toBe(200)
    expect(fakeSupabase.__store.org_meta_ads_config[0].access_token).not.toBe('tok-valido') // cifrado
  })

  it('desconecta', async () => {
    fakeSupabase.__store.org_meta_ads_config = [{ id: 'm1', org_id: 'org-1', access_token: 'cifrado', ad_account_id: '123', connected_at: '2026-01-01' }]
    currentContext = makeContext('admin')
    const { DELETE } = await import('../route')
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(fakeSupabase.__store.org_meta_ads_config).toHaveLength(0)
  })
})
