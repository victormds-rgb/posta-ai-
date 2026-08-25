import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({
  content_items: [],
  internal_approvals: [],
  approval_links: [],
})

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

describe('POST /api/posts/schedule', () => {
  beforeEach(() => {
    fakeSupabase.__store.content_items = [
      { id: 'content-1', org_id: 'org-1', client_id: 'client-1', title: 'Post', media_urls: [], channels: [], status: 'rascunho', caption: '', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.internal_approvals = []
    fakeSupabase.__store.approval_links = []
    currentContext = makeContext('admin')
  })

  it('bloqueia quem não tem a permissão publish', async () => {
    currentContext = makeContext('designer')
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'content-1', scheduled_at: new Date(Date.now() + 100_000).toISOString() }) }),
    )
    expect(res.status).toBe(403)
  })

  it('agenda normalmente quando não há aprovação pendente', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ content_id: 'content-1', scheduled_at: new Date(Date.now() + 100_000).toISOString() }) }),
    )
    expect(res.status).toBe(200)
  })

  it('aplica rate limit por organização', async () => {
    const { POST } = await import('../route')
    let last429 = false
    for (let i = 0; i < 61; i++) {
      const res = await POST(
        new Request('http://x', {
          method: 'POST',
          body: JSON.stringify({ content_id: 'inexistente', scheduled_at: new Date(Date.now() + 100_000).toISOString() }),
        }),
      )
      last429 = res.status === 429
    }
    expect(last429).toBe(true)
  })
})
