import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({
  content_items: [],
  internal_approvals: [],
  client_members: [],
  members: [],
  activity_log: [],
  notifications: [],
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

let currentContext: Awaited<ReturnType<typeof import('@/lib/org').getCurrentContext>> | null = null

vi.mock('@/lib/org', () => ({
  getCurrentContext: vi.fn(async () => currentContext),
}))

function makeContext(role: Member['role'], memberId = 'member-1') {
  const member: Member = {
    id: memberId,
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

const CLIENT_A = '123e4567-e89b-12d3-a456-426614174000'
const CLIENT_B = '223e4567-e89b-12d3-a456-426614174000'

describe('GET /api/conteudos/[id]/internal-approval — isolamento do Portal', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      { id: 'ct-a', org_id: 'org-1', client_id: CLIENT_A, title: 'Do cliente A', status: 'aprovacao_interna', media_urls: [], channels: [], created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.internal_approvals = [
      { id: 'ia-1', org_id: 'org-1', content_id: 'ct-a', status: 'pendente', requested_by: 'user-staff', reviewed_by: null, comment: 'comentário interno sensível', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.client_members = []
    currentContext = null
  })

  it('401 sem sessão', async () => {
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'ct-a' }) })
    expect(res.status).toBe(401)
  })

  it('403 pra membro role=cliente sem vínculo com o cliente dono do conteúdo', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'ct-a' }) })
    expect(res.status).toBe(403)
  })

  it('403 pra membro role=cliente vinculado a OUTRO cliente do mesmo org (o vazamento original)', async () => {
    fakeSupabase.__store.client_members = [{ id: 'cm1', member_id: 'member-1', client_id: CLIENT_B, created_at: '2026-01-01' }]
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'ct-a' }) })
    expect(res.status).toBe(403)
  })

  it('200 pra membro role=cliente vinculado ao cliente certo', async () => {
    fakeSupabase.__store.client_members = [{ id: 'cm1', member_id: 'member-1', client_id: CLIENT_A, created_at: '2026-01-01' }]
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'ct-a' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.approvals).toHaveLength(1)
  })

  it('staff (designer) continua vendo o histórico normalmente, sem precisar de client_members', async () => {
    currentContext = makeContext('designer')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'ct-a' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.approvals).toHaveLength(1)
  })

  it('404 pra conteúdo de outra organização', async () => {
    currentContext = { ...makeContext('admin'), organization: { ...makeContext('admin').organization, id: 'org-OUTRA' } }
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'ct-a' }) })
    expect(res.status).toBe(404)
  })
})
