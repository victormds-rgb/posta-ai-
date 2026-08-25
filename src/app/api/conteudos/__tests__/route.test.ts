import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ content_items: [], activity_log: [], client_members: [] })

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

describe('POST /api/conteudos', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = []
    fakeSupabase.__store.activity_log = []
    currentContext = null
  })

  it('bloqueia quem não tem manageContent (ex.: cliente) mesmo chamando a API diretamente', async () => {
    currentContext = makeContext('cliente')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, title: 'Post' }) }),
    )
    expect(res.status).toBe(403)
  })

  it('designer (tem manageContent) consegue criar conteúdo', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: CLIENT_UUID, title: 'Post novo' }) }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.item.status).toBe('ideia')
    expect(body.item.title).toBe('Post novo')
  })

  it('rejeita client_id que não é uuid (validação de entrada)', async () => {
    currentContext = makeContext('admin')
    const { POST } = await import('../route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ client_id: 'abc' }) }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/conteudos — escopo do Portal (role: cliente)', () => {
  const OTHER_CLIENT_UUID = '223e4567-e89b-12d3-a456-426614174000'

  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      { id: 'ct-1', org_id: 'org-1', client_id: CLIENT_UUID, title: 'Do cliente vinculado', status: 'ideia', media_urls: [], channels: [], created_at: '2026-01-01' },
      { id: 'ct-2', org_id: 'org-1', client_id: OTHER_CLIENT_UUID, title: 'De outro cliente', status: 'ideia', media_urls: [], channels: [], created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.client_members = [{ id: 'cm1', member_id: 'member-1', client_id: CLIENT_UUID, created_at: '2026-01-01' }]
    currentContext = null
  })

  it('membro role=cliente só vê conteúdo do cliente vinculado a ele', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe('ct-1')
  })

  it('membro role=cliente pedindo client_id de outro cliente não recebe nada', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request(`http://x?client_id=${OTHER_CLIENT_UUID}`))
    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('staff (designer) continua vendo tudo da organização normalmente', async () => {
    currentContext = makeContext('designer')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'))
    const body = await res.json()
    expect(body.items).toHaveLength(2)
  })
})

describe('PATCH /api/conteudos/[id] — mudança de status', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      {
        id: 'content-1',
        org_id: 'org-1',
        client_id: CLIENT_UUID,
        title: 'Existente',
        status: 'ideia',
        media_urls: [],
        channels: [],
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]
    currentContext = null
  })

  it('move o conteúdo pra "producao" quando quem tem manageContent muda o status', async () => {
    currentContext = makeContext('designer')
    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ status: 'producao' }) }), {
      params: Promise.resolve({ id: 'content-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.item.status).toBe('producao')
  })

  it('não deixa um usuário de outra organização alterar o conteúdo (isolamento multi-tenant)', async () => {
    currentContext = makeContext('admin', 'org-DE-OUTRO-TIME')
    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ status: 'producao' }) }), {
      params: Promise.resolve({ id: 'content-1' }),
    })
    // update não encontra a linha (org_id não bate) → single() falha
    expect(res.status).toBe(500)
    const original = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(original?.status).toBe('ideia')
  })
})
