import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ clients: [], brand_assets: [], client_members: [], activity_log: [] })

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

describe('GET/PUT /api/clientes/[id]/brand', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [{ id: 'c1', org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.brand_assets = []
    fakeSupabase.__store.client_members = []
    fakeSupabase.__store.activity_log = []
    currentContext = null
  })

  it('401 sem sessão', async () => {
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(401)
  })

  it('staff (designer) consegue ver o brand book mesmo sem manageClients', async () => {
    currentContext = makeContext('designer')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(200)
  })

  it('403 pra membro role=cliente sem vínculo com este cliente', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(403)
  })

  it('membro role=cliente com vínculo enxerga o brand book do seu cliente', async () => {
    fakeSupabase.__store.client_members = [{ id: 'cm1', member_id: 'member-1', client_id: 'c1', created_at: '2026-01-01' }]
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(200)
  })

  it('403 pra designer tentando editar (sem manageClients)', async () => {
    currentContext = makeContext('designer')
    const { PUT } = await import('../route')
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ primary_color: '#000' }) }), {
      params: Promise.resolve({ id: 'c1' }),
    })
    expect(res.status).toBe(403)
  })

  it('admin cria e depois atualiza o brand book (upsert)', async () => {
    currentContext = makeContext('admin')
    const { PUT } = await import('../route')

    const res1 = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ primary_color: '#111111', guidelines: 'v1' }) }),
      { params: Promise.resolve({ id: 'c1' }) },
    )
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.brand.primary_color).toBe('#111111')

    const res2 = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ primary_color: '#222222', guidelines: 'v2' }) }),
      { params: Promise.resolve({ id: 'c1' }) },
    )
    const body2 = await res2.json()
    expect(body2.brand.primary_color).toBe('#222222')
    expect(fakeSupabase.__store.brand_assets).toHaveLength(1) // upsert, não duplica
  })
})
