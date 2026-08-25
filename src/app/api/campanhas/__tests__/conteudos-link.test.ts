import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ campaigns: [], content_items: [], campaign_content_items: [] })

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

const CLIENT_A = '123e4567-e89b-12d3-a456-426614174000'
const CLIENT_B = '223e4567-e89b-12d3-a456-426614174000'
const CONTENT_A = '323e4567-e89b-12d3-a456-426614174000'
const CONTENT_B = '423e4567-e89b-12d3-a456-426614174000'

describe('POST/DELETE /api/campanhas/[id]/conteudos', () => {
  beforeEach(() => {
    fakeSupabase.__store.campaigns = [{ id: 'camp-1', org_id: 'org-1', client_id: CLIENT_A, name: 'Campanha', status: 'planejada', created_at: '2026-01-01', updated_at: '2026-01-01' }]
    fakeSupabase.__store.content_items = [
      { id: CONTENT_A, org_id: 'org-1', client_id: CLIENT_A, title: 'Do mesmo cliente', status: 'ideia', media_urls: [], channels: [], created_at: '2026-01-01' },
      { id: CONTENT_B, org_id: 'org-1', client_id: CLIENT_B, title: 'De outro cliente', status: 'ideia', media_urls: [], channels: [], created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.campaign_content_items = []
    currentContext = makeContext('admin')
  })

  it('vincula conteúdo do mesmo cliente da campanha', async () => {
    const { POST } = await import('../[id]/conteudos/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_item_id: CONTENT_A }) }), {
      params: Promise.resolve({ id: 'camp-1' }),
    })
    expect(res.status).toBe(201)
    expect(fakeSupabase.__store.campaign_content_items).toHaveLength(1)
  })

  it('rejeita vincular conteúdo de outro cliente', async () => {
    const { POST } = await import('../[id]/conteudos/route')
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ content_item_id: CONTENT_B }) }), {
      params: Promise.resolve({ id: 'camp-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('desvincula um conteúdo já vinculado', async () => {
    fakeSupabase.__store.campaign_content_items = [{ id: 'link-1', campaign_id: 'camp-1', content_item_id: 'content-a', created_at: '2026-01-01' }]
    const { DELETE } = await import('../[id]/conteudos/route')
    const res = await DELETE(new Request('http://x?content_item_id=content-a', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'camp-1' }),
    })
    expect(res.status).toBe(200)
    expect(fakeSupabase.__store.campaign_content_items).toHaveLength(0)
  })
})
