import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

process.env.CREDENTIALS_ENCRYPTION_KEY ||= 'a'.repeat(64)

const fakeSupabase = createFakeSupabase({ clients: [], client_wordpress_config: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

const wpTestConnectionMock = vi.fn()
vi.mock('@/lib/wordpress', () => ({
  wpTestConnection: (...args: unknown[]) => wpTestConnectionMock(...args),
  wpCreatePost: vi.fn(),
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

describe('GET/PUT/DELETE /api/clientes/[id]/wordpress', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [{ id: 'c1', org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.client_wordpress_config = []
    wpTestConnectionMock.mockReset()
    currentContext = null
  })

  it('403 pra quem não tem manageIntegrations (designer)', async () => {
    currentContext = makeContext('designer')
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ site_url: 'https://x.com', username: 'a', app_password: 'b' }) }),
      { params: Promise.resolve({ id: 'c1' }) },
    )
    expect(res.status).toBe(403)
  })

  it('rejeita quando o teste de conexão falha', async () => {
    wpTestConnectionMock.mockResolvedValue({ success: false, error: 'credenciais inválidas' })
    currentContext = makeContext('admin')
    const { PUT } = await import('../route')
    const res = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ site_url: 'https://x.com', username: 'a', app_password: 'b' }) }),
      { params: Promise.resolve({ id: 'c1' }) },
    )
    expect(res.status).toBe(400)
    expect(fakeSupabase.__store.client_wordpress_config).toHaveLength(0)
  })

  it('conecta com sucesso e grava a senha de aplicativo cifrada (nunca em texto puro)', async () => {
    wpTestConnectionMock.mockResolvedValue({ success: true, data: { id: 1, name: 'Admin' } })
    currentContext = makeContext('admin')
    const { PUT, GET } = await import('../route')
    const putRes = await PUT(
      new Request('http://x', { method: 'PUT', body: JSON.stringify({ site_url: 'https://blog.cliente.com', username: 'admin', app_password: 'segredo' }) }),
      { params: Promise.resolve({ id: 'c1' }) },
    )
    expect(putRes.status).toBe(200)
    const putBody = await putRes.json()
    expect(putBody.config.site_url).toBe('https://blog.cliente.com')
    expect(fakeSupabase.__store.client_wordpress_config[0].app_password).not.toBe('segredo') // cifrado

    const getRes = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(getRes.status).toBe(200)
  })

  it('desconecta removendo a config', async () => {
    fakeSupabase.__store.client_wordpress_config = [
      { id: 'wp1', org_id: 'org-1', client_id: 'c1', site_url: 'https://x.com', username: 'a', app_password: 'cifrado', connected_at: '2026-01-01', created_at: '2026-01-01' },
    ]
    currentContext = makeContext('admin')
    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://x'), { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(200)
    expect(fakeSupabase.__store.client_wordpress_config).toHaveLength(0)
  })

  it('aplica rate limit por organização — cada tentativa faz um fetch de verdade na URL informada', async () => {
    wpTestConnectionMock.mockResolvedValue({ success: false, error: 'credenciais inválidas' })
    currentContext = makeContext('admin')
    const { PUT } = await import('../route')
    let last429 = false
    for (let i = 0; i < 11; i++) {
      const res = await PUT(
        new Request('http://x', { method: 'PUT', body: JSON.stringify({ site_url: 'https://x.com', username: 'a', app_password: 'b' }) }),
        { params: Promise.resolve({ id: 'c1' }) },
      )
      last429 = res.status === 429
    }
    expect(last429).toBe(true)
  })
})
