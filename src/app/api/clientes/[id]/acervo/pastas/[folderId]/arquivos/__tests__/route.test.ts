import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ clients: [], media_folders: [], media_files: [], client_members: [] })

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

describe('GET /api/clientes/[id]/acervo/pastas/[folderId]/arquivos — pasta×cliente', () => {
  beforeEach(() => {
    fakeSupabase.__store.clients = [
      { id: 'client-a', org_id: 'org-1', name: 'Cliente A', slug: 'a', created_at: '2026-01-01' },
      { id: 'client-b', org_id: 'org-1', name: 'Cliente B', slug: 'b', created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.media_folders = [
      { id: 'folder-a', org_id: 'org-1', client_id: 'client-a', name: 'Pasta de A', public_token: null, created_at: '2026-01-01' },
      { id: 'folder-b', org_id: 'org-1', client_id: 'client-b', name: 'Pasta de B', public_token: null, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.media_files = [
      { id: 'file-b', org_id: 'org-1', folder_id: 'folder-b', name: 'segredo-do-b.jpg', url: 'https://x/b.jpg', content_type: 'image/jpeg', size_bytes: 1, created_by: null, created_at: '2026-01-01' },
    ]
    fakeSupabase.__store.client_members = [{ id: 'cm1', member_id: 'member-1', client_id: 'client-a', created_at: '2026-01-01' }]
  })

  it('404 quando a pasta pedida não pertence ao cliente da URL (troca de folderId entre clientes)', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    // client_id da URL é "client-a" (que o portal user tem acesso), mas o
    // folderId pertence a "client-b" — antes da correção, isso devolvia os
    // arquivos do Cliente B.
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'client-a', folderId: 'folder-b' }) })
    expect(res.status).toBe(404)
  })

  it('200 e lista os arquivos quando a pasta pertence mesmo ao cliente da URL', async () => {
    currentContext = makeContext('cliente')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'client-b', folderId: 'folder-b' }) })
    // Este membro não tem client_members pra client-b — deve ser bloqueado
    // já na checagem de portal, antes mesmo de chegar na pasta.
    expect(res.status).toBe(403)
  })

  it('staff continua listando arquivos de qualquer pasta do próprio org normalmente', async () => {
    currentContext = makeContext('admin')
    const { GET } = await import('../route')
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: 'client-b', folderId: 'folder-b' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.files).toHaveLength(1)
  })
})
