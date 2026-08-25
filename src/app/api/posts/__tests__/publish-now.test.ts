import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({
  content_items: [],
  client_social_profiles: [],
  internal_approvals: [],
  approval_links: [],
  activity_log: [],
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

const publishPostMock = vi.fn(async () => ({ success: true, data: { job_id: 'job-123' } }))
vi.mock('@/lib/upload-post', () => ({
  publishPost: publishPostMock,
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
    upload_post_api_key: 'fake-key',
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

describe('POST /api/posts/publish-now', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      {
        id: 'content-1',
        org_id: 'org-1',
        client_id: 'client-1',
        title: 'Post pronto',
        media_urls: ['https://x.test/foto.jpg'],
        channels: ['instagram'],
        status: 'agendado',
        caption: 'Legenda',
        created_at: '2026-01-01',
      },
    ]
    fakeSupabase.__store.client_social_profiles = [
      { id: 'profile-1', org_id: 'org-1', client_id: 'client-1', upload_post_username: 'org-cliente', connected_platforms: [] },
    ]
    fakeSupabase.__store.internal_approvals = []
    fakeSupabase.__store.approval_links = []
    fakeSupabase.__store.activity_log = []
    publishPostMock.mockClear()
    currentContext = makeContext('admin')
  })

  it('bloqueia publicação quando há aprovação interna pendente, sem chamar a Upload-Post', async () => {
    fakeSupabase.__store.internal_approvals = [
      { id: 'a1', content_id: 'content-1', status: 'pendente', created_at: '2026-01-01' },
    ]
    const { POST } = await import('../publish-now/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'content-1' }) }))
    expect(res.status).toBe(409)
    expect(publishPostMock).not.toHaveBeenCalled()
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('agendado') // não mudou pra "publicado"
  })

  it('bloqueia publicação quando o cliente pediu ajuste no link externo', async () => {
    fakeSupabase.__store.approval_links = [
      { id: 'l1', content_id: 'content-1', status: 'ajuste', expires_at: new Date(Date.now() + 100_000).toISOString(), created_at: '2026-01-01' },
    ]
    const { POST } = await import('../publish-now/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'content-1' }) }))
    expect(res.status).toBe(409)
    expect(publishPostMock).not.toHaveBeenCalled()
  })

  it('publica normalmente quando não há aprovação pendente', async () => {
    const { POST } = await import('../publish-now/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'content-1' }) }))
    expect(res.status).toBe(200)
    expect(publishPostMock).toHaveBeenCalledOnce()
    const content = fakeSupabase.__store.content_items.find((c) => c.id === 'content-1')
    expect(content?.status).toBe('publicado')
  })

  it('bloqueia quem não tem a permissão publish (ex.: designer)', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../publish-now/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'content-1' }) }))
    expect(res.status).toBe(403)
    expect(publishPostMock).not.toHaveBeenCalled()
  })

  it('aplica rate limit por organização — publicar chama uma API paga a cada request', async () => {
    const { POST } = await import('../publish-now/route')
    let last429 = false
    for (let i = 0; i < 31; i++) {
      const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'inexistente' }) }))
      last429 = res.status === 429
    }
    expect(last429).toBe(true)
  })
})
