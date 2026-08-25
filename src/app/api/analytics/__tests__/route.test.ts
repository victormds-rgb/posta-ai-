import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ content_items: [], clients: [], internal_approvals: [], approval_links: [] })

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

describe('GET /api/analytics', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [{ id: 'c1', org_id: 'org-1', name: 'Cliente', slug: 'cliente', created_at: '2026-01-01' }]
    fakeSupabase.__store.content_items = [
      { id: 'i1', org_id: 'org-1', client_id: 'c1', title: 'A', status: 'publicado', published_at: new Date().toISOString(), media_urls: [], channels: [], created_at: '2026-01-01' },
      { id: 'i2', org_id: 'org-1', client_id: 'c1', title: 'B', status: 'ideia', media_urls: [], channels: [], created_at: '2026-01-01' },
      { id: 'i3', org_id: 'org-OUTRA', client_id: 'c-outra', title: 'De outra org', status: 'publicado', media_urls: [], channels: [], created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.internal_approvals = [
      { id: 'ia1', org_id: 'org-1', content_id: 'i1', status: 'aprovado', created_at: '2026-01-01T00:00:00Z', reviewed_at: '2026-01-01T02:00:00Z' },
    ]
    fakeSupabase.__store.approval_links = []
    currentContext = null
  })

  it('401 sem sessão', async () => {
    const { GET } = await import('../route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('403 pra role=cliente', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('calcula totais isolados por organização e tempo médio de aprovação', async () => {
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totals.total).toBe(2) // só org-1
    expect(body.totals.byStatus.publicado).toBe(1)
    expect(body.perClient).toHaveLength(1)
    expect(body.perClient[0].published).toBe(1)
    expect(body.approvalTurnaroundHours.internal).toBe(2) // 2h entre created_at e reviewed_at
  })
})
