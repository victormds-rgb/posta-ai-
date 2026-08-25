import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ campaigns: [], clients: [], activity_log: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

let currentContext: Awaited<ReturnType<typeof import('@/lib/org').getCurrentContext>> | null = null

vi.mock('@/lib/org', () => ({
  getCurrentContext: vi.fn(async () => currentContext),
}))

function makeContext(role: Member['role'], orgId = 'org-1') {
  const member: Member = {
    id: 'member-1',
    user_id: 'user-1',
    org_id: orgId,
    role,
    display_name: 'Fulano',
    avatar_url: null,
    status: 'active',
    created_at: new Date().toISOString(),
    custom_permissions: null,
  }
  const organization: Organization = {
    id: orgId,
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

const CLIENT_UUID = '123e4567-e89b-12d3-a456-426614174000'

describe('GET/POST /api/campanhas', () => {
  beforeEach(() => {
    fakeSupabase.__store.campaigns = []
    fakeSupabase.__store.clients = [{ id: CLIENT_UUID, org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.activity_log = []
    currentContext = null
  })

  it('401 sem sessão', async () => {
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(401)
  })

  it('403 pra role=cliente (Portal não usa campanhas)', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(403)
  })

  it('cria campanha com manageContent (designer)', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Lançamento', client_id: CLIENT_UUID }) }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.campaign.status).toBe('planejada')
  })

  it('isola por organização na listagem', async () => {
    fakeSupabase.__store.campaigns = [
      { id: 'camp-1', org_id: 'org-1', client_id: CLIENT_UUID, name: 'Da org 1', status: 'planejada', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'camp-2', org_id: 'org-OUTRA', client_id: CLIENT_UUID, name: 'De outra org', status: 'planejada', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    const body = await res.json()
    expect(body.campaigns).toHaveLength(1)
    expect(body.campaigns[0].id).toBe('camp-1')
  })
})
