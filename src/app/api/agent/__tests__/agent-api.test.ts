import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'

const fakeSupabase = createFakeSupabase({ clients: [], content_items: [], organizations: [], webhook_configs: [], webhook_events: [] })

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: vi.fn(() => fakeSupabase),
  createServerSupabase: vi.fn(async () => fakeSupabase),
}))

const { mockOrgId } = vi.hoisted(() => ({ mockOrgId: { current: null as string | null } }))

vi.mock('@/lib/agent-auth', () => ({
  getAgentOrgId: vi.fn(async () => mockOrgId.current),
  generateAgentToken: vi.fn(),
}))

const CLIENT_UUID = '123e4567-e89b-12d3-a456-426614174000'

describe('GET /api/agent/clientes', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [
      { id: 'c1', org_id: 'org-1', name: 'Cliente A', slug: 'a', created_at: '2026-01-01' },
      { id: 'c2', org_id: 'org-OUTRA', name: 'De outra org', slug: 'b', created_at: '2026-01-01' },
    ]
    mockOrgId.current = null
  })

  it('401 sem token válido', async () => {
    const { GET } = await import('../clientes/route')
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(401)
  })

  it('lista só os clientes da organização dona do token', async () => {
    mockOrgId.current = 'org-1'
    const { GET } = await import('../clientes/route')
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clients).toHaveLength(1)
    expect(body.clients[0].id).toBe('c1')
  })
})

describe('GET/POST /api/agent/conteudos', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [{ id: CLIENT_UUID, org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.content_items = []
    fakeSupabase.__store.organizations = [{ id: 'org-1', plan: 'free', name: 'Org', created_at: '2026-01-01' }]
    fakeSupabase.__store.webhook_configs = []
    mockOrgId.current = 'org-1'
  })

  it('401 sem token', async () => {
    mockOrgId.current = null
    const { GET } = await import('../conteudos/route')
    const res = await GET(new Request('http://x'))
    expect(res.status).toBe(401)
  })

  it('cria conteúdo em rascunho pra um cliente válido', async () => {
    const { POST } = await import('../conteudos/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, title: 'Gerado pelo agente' }) }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.item.status).toBe('ideia')
    expect(body.item.title).toBe('Gerado pelo agente')
  })

  it('rejeita client_id de outra organização', async () => {
    const { POST } = await import('../conteudos/route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: '223e4567-e89b-12d3-a456-426614174000', title: 'X' }) }),
    )
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/agent/conteudos/[id]', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      { id: 'ct1', org_id: 'org-1', client_id: CLIENT_UUID, title: 'A', status: 'ideia', media_urls: [], channels: [], created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.webhook_configs = []
    mockOrgId.current = 'org-1'
  })

  it('atualiza o status e retorna o conteúdo', async () => {
    const { PATCH } = await import('../conteudos/[id]/route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ status: 'producao' }) }), {
      params: Promise.resolve({ id: 'ct1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.item.status).toBe('producao')
  })

  it('404 pra conteúdo de outra organização', async () => {
    mockOrgId.current = 'org-OUTRA'
    const { PATCH } = await import('../conteudos/[id]/route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ status: 'producao' }) }), {
      params: Promise.resolve({ id: 'ct1' }),
    })
    expect(res.status).toBe(404)
  })
})
