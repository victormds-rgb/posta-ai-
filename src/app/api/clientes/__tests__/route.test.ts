import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ clients: [] })

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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { userId: 'user-1', email: 'a@b.com', member, organization, permissions: getEffectivePermissions(member) }
}

describe('POST /api/clientes', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = []
    currentContext = null
  })

  it('retorna 401 sem sessão', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Cliente X' }) }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 pra quem não tem manageClients (ex.: designer)', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Cliente X' }) }))
    expect(res.status).toBe(403)
  })

  it('retorna 400 com payload inválido (nome vazio)', async () => {
    currentContext = makeContext('admin')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: '' }) }))
    expect(res.status).toBe(400)
  })

  it('cria o cliente pra quem tem manageClients (admin) e devolve slug único', async () => {
    currentContext = makeContext('admin')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Padaria do Zé' }) }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.client.name).toBe('Padaria do Zé')
    expect(body.client.slug).toBe('padaria-do-ze')
    expect(body.client.org_id).toBe('org-1')
  })

  it('nunca deixa um cliente de outra organização vazar na listagem (isolamento multi-tenant)', async () => {
    fakeSupabase.__store.clients = [
      { id: 'c1', org_id: 'org-1', name: 'Cliente da org 1', slug: 'cliente-org-1', created_at: '2026-01-01' },
      { id: 'c2', org_id: 'org-OUTRA', name: 'Cliente de outra org', slug: 'cliente-outra', created_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET()
    const body = await res.json()
    expect(body.clients).toHaveLength(1)
    expect(body.clients[0].id).toBe('c1')
  })
})
