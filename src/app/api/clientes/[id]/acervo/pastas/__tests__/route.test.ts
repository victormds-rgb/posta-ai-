import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ clients: [], media_folders: [], client_members: [] })

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

describe('GET/POST /api/clientes/[id]/acervo/pastas', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [
      { id: 'c1', org_id: 'org-1', name: 'Cliente 1', slug: 'cliente-1', created_at: '2026-01-01' },
      { id: 'c2', org_id: 'org-OUTRA', name: 'Cliente de outra org', slug: 'cliente-outra', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.media_folders = [
      { id: 'f1', org_id: 'org-1', client_id: 'c1', name: 'Fotos', public_token: null, created_at: '2026-01-01' },
      { id: 'f2', org_id: 'org-OUTRA', client_id: 'c2', name: 'Vídeos', public_token: null, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.client_members = []
    currentContext = null
  })

  it('401 sem sessão', async () => {
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(401)
  })

  it('lista só as pastas do cliente pedido, isolado por org', async () => {
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    const body = await res.json()
    expect(body.folders).toHaveLength(1)
    expect(body.folders[0].id).toBe('f1')
  })

  it('403 pra role=cliente (sem manageMedia) tentando criar pasta', async () => {
    currentContext = makeContext('cliente')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Nova' }) }), {
      params: Promise.resolve({ id: 'c1' }),
    })
    expect(res.status).toBe(403)
  })

  it('gestor (tem manageMedia) cria pasta com sucesso', async () => {
    currentContext = makeContext('gestor')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Nova pasta' }) }), {
      params: Promise.resolve({ id: 'c1' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.folder.name).toBe('Nova pasta')
    expect(body.folder.client_id).toBe('c1')
  })

  it('403 pra membro role=cliente sem vínculo tentando listar pastas', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(403)
  })
})
