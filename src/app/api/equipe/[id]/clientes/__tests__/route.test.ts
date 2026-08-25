import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ members: [], clients: [], client_members: [] })

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
    id: 'admin-1',
    user_id: 'user-admin',
    org_id: 'org-1',
    role,
    display_name: 'Admin',
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
  return { userId: 'user-admin', email: 'a@b.com', member, organization, permissions: getEffectivePermissions(member) }
}

const CLIENT_A = '123e4567-e89b-12d3-a456-426614174000'
const CLIENT_B = '223e4567-e89b-12d3-a456-426614174000'
const CLIENT_OUTRA_ORG = '323e4567-e89b-12d3-a456-426614174000'

describe('GET/PUT /api/equipe/[id]/clientes', () => {
  beforeEach(() => {
    fakeSupabase.__store.members = [
      { id: 'member-cliente', org_id: 'org-1', user_id: 'user-cliente', role: 'cliente', status: 'active', display_name: 'Cliente Final', created_at: '2026-01-01', custom_permissions: null },
    ]
    fakeSupabase.__store.clients = [
      { id: CLIENT_A, org_id: 'org-1', name: 'Cliente A', slug: 'cliente-a', created_at: '2026-01-01' },
      { id: CLIENT_B, org_id: 'org-1', name: 'Cliente B', slug: 'cliente-b', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.client_members = []
    currentContext = null
  })

  it('403 pra quem não tem manageTeam (ex.: designer)', async () => {
    currentContext = makeContext('designer')
    const { PUT } = await import('../route')
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ client_ids: [CLIENT_A] }) }), {
      params: Promise.resolve({ id: 'member-cliente' }),
    })
    expect(res.status).toBe(403)
  })

  it('admin vincula clientes ao membro cliente e a leitura reflete', async () => {
    currentContext = makeContext('admin')
    const { PUT, GET } = await import('../route')

    const putRes = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ client_ids: [CLIENT_A, CLIENT_B] }) }),
      { params: Promise.resolve({ id: 'member-cliente' }) },
    )
    expect(putRes.status).toBe(200)

    const getRes = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'member-cliente' }) })
    const body = await getRes.json()
    expect(body.client_ids.sort()).toEqual([CLIENT_A, CLIENT_B].sort())
  })

  it('rejeita client_id de outra organização', async () => {
    fakeSupabase.__store.clients.push({ id: CLIENT_OUTRA_ORG, org_id: 'org-OUTRA', name: 'Alheio', slug: 'alheio', created_at: '2026-01-01' })
    currentContext = makeContext('admin')
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ client_ids: [CLIENT_OUTRA_ORG] }) }),
      { params: Promise.resolve({ id: 'member-cliente' }) },
    )
    expect(res.status).toBe(400)
  })

  it('substituir com lista vazia remove todos os vínculos', async () => {
    fakeSupabase.__store.client_members = [{ id: 'cm1', member_id: 'member-cliente', client_id: CLIENT_A, created_at: '2026-01-01' }]
    currentContext = makeContext('admin')
    const { PUT, GET } = await import('../route')
    await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ client_ids: [] }) }), {
      params: Promise.resolve({ id: 'member-cliente' }),
    })
    const getRes = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'member-cliente' }) })
    const body = await getRes.json()
    expect(body.client_ids).toEqual([])
  })
})
