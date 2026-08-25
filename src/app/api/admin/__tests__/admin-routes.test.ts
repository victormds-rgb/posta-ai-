import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

const fakeSupabase = createFakeSupabase({ organizations: [], members: [], clients: [], content_items: [], activity_log: [] })

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
  createServerSupabase: vi.fn(async () => fakeSupabase),
}))

let mockAdmin: { userId: string; email: string } | null = null
vi.mock('@/lib/admin-auth', () => ({
  requireSuperAdmin: vi.fn(async () => mockAdmin),
  isSuperAdminEmail: vi.fn(),
}))

describe('GET /api/admin/organizacoes', () => {
  beforeEach(() => {
    fakeSupabase.__store.organizations = [
      { id: 'org-1', name: 'Org A', slug: 'org-a', plan: 'pro', upload_post_api_key: 'segredo-real-1', created_at: '2026-01-01' },
      { id: 'org-2', name: 'Org B', slug: 'org-b', plan: 'free', upload_post_api_key: 'segredo-real-2', created_at: '2026-01-02' },
    ]
    mockAdmin = null
  })

  it('403 pra quem não é super-admin', async () => {
    const { GET } = await import('../organizacoes/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('lista TODAS as organizações (cross-tenant, só pra super-admin)', async () => {
    mockAdmin = { userId: 'u1', email: 'admin@produto.com' }
    const { GET } = await import('../organizacoes/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organizations).toHaveLength(2)
  })

  it('nunca devolve upload_post_api_key (texto puro) em nenhuma organização', async () => {
    mockAdmin = { userId: 'u1', email: 'admin@produto.com' }
    const { GET } = await import('../organizacoes/route')
    const res = await GET()
    const body = await res.json()
    for (const org of body.organizations) {
      expect(org.upload_post_api_key).toBeUndefined()
    }
  })
})

describe('GET/PATCH /api/admin/organizacoes/[id]', () => {
  beforeEach(() => {
    fakeSupabase.__store.organizations = [
      { id: 'org-1', name: 'Org A', slug: 'org-a', plan: 'free', upload_post_api_key: 'segredo-real', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.members = [{ id: 'm1', org_id: 'org-1', user_id: 'u2', role: 'admin', display_name: 'Dono', created_at: '2026-01-01' }]
    fakeSupabase.__store.clients = []
    fakeSupabase.__store.content_items = []
    fakeSupabase.__store.activity_log = []
    mockAdmin = { userId: 'u1', email: 'admin@produto.com' }
  })

  it('403 sem autorização de super-admin', async () => {
    mockAdmin = null
    const { GET } = await import('../organizacoes/[id]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'org-1' }) })
    expect(res.status).toBe(403)
  })

  it('retorna o detalhe da organização com equipe e clientes', async () => {
    const { GET } = await import('../organizacoes/[id]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'org-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organization.name).toBe('Org A')
    expect(body.members).toHaveLength(1)
  })

  it('nunca devolve upload_post_api_key no detalhe da organização', async () => {
    const { GET } = await import('../organizacoes/[id]/route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'org-1' }) })
    const body = await res.json()
    expect(body.organization.upload_post_api_key).toBeUndefined()
  })

  it('muda o plano manualmente, registra em activity_log e não devolve a chave', async () => {
    const { PATCH } = await import('../organizacoes/[id]/route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ plan: 'agency' }) }), {
      params: Promise.resolve({ id: 'org-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organization.plan).toBe('agency')
    expect(body.organization.upload_post_api_key).toBeUndefined()
    expect(fakeSupabase.__store.activity_log).toHaveLength(1)
    expect(fakeSupabase.__store.activity_log[0].action).toBe('admin.plan_changed')
  })
})

describe('GET /api/admin/metrics', () => {
  beforeEach(() => {
    fakeSupabase.__store.organizations = [
      { id: 'org-1', name: 'A', slug: 'a', plan: 'pro', subscription_status: 'active', created_at: new Date().toISOString() },
      { id: 'org-2', name: 'B', slug: 'b', plan: 'free', created_at: '2020-01-01' },
    ]
    fakeSupabase.__store.members = [{ id: 'm1', org_id: 'org-1' }]
    fakeSupabase.__store.content_items = []
    fakeSupabase.__store.clients = []
    mockAdmin = { userId: 'u1', email: 'admin@produto.com' }
  })

  it('403 sem autorização', async () => {
    mockAdmin = null
    const { GET } = await import('../metrics/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('calcula métricas globais', async () => {
    const { GET } = await import('../metrics/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalOrganizations).toBe(2)
    expect(body.byPlan.pro).toBe(1)
    expect(body.byPlan.free).toBe(1)
    expect(body.mrrBRL).toBeGreaterThan(0) // org-1 é pro + active
  })
})
