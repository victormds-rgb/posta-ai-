import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase } from '@tests/helpers/fake-supabase'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization } from '@/lib/types'

const fakeSupabase = createFakeSupabase({ members: [], activity_log: [], notifications: [] })

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => fakeSupabase),
  createAdminSupabase: vi.fn(() => fakeSupabase),
}))

let currentContext: Awaited<ReturnType<typeof import('@/lib/org').getCurrentContext>> | null = null

vi.mock('@/lib/org', () => ({
  getCurrentContext: vi.fn(async () => currentContext),
}))

function makeContext(member: Member): NonNullable<typeof currentContext> {
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
  return { userId: member.user_id, email: 'a@b.com', member, organization, permissions: getEffectivePermissions(member) }
}

describe('PATCH /api/equipe/[id]', () => {
  beforeEach(() => {
    fakeSupabase.__store.members = [
      {
        id: 'member-target',
        user_id: 'user-target',
        org_id: 'org-1',
        role: 'designer',
        display_name: 'Alvo',
        status: 'active',
        custom_permissions: null,
        created_at: '2026-01-01',
      },
    ]
    fakeSupabase.__store.activity_log = []
    fakeSupabase.__store.notifications = []
    currentContext = null
  })

  it('um gestor com manageTeam concedido via override NÃO pode alterar role de outro membro (só admin de verdade pode)', async () => {
    const gestorComOverride: Member = {
      id: 'member-gestor',
      user_id: 'user-gestor',
      org_id: 'org-1',
      role: 'gestor',
      display_name: 'Gestor',
      avatar_url: null,
      status: 'active',
      custom_permissions: { manageTeam: true },
      created_at: '2026-01-01',
    }
    currentContext = makeContext(gestorComOverride)

    const { PATCH } = await import('../route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }), {
      params: Promise.resolve({ id: 'member-target' }),
    })
    expect(res.status).toBe(403)
    const target = fakeSupabase.__store.members.find((m) => m.id === 'member-target')
    expect(target?.role).toBe('designer')
  })

  it('um admin de verdade pode alterar role e o membro alterado é notificado', async () => {
    const admin: Member = {
      id: 'member-admin',
      user_id: 'user-admin',
      org_id: 'org-1',
      role: 'admin',
      display_name: 'Admin',
      avatar_url: null,
      status: 'active',
      custom_permissions: null,
      created_at: '2026-01-01',
    }
    currentContext = makeContext(admin)

    const { PATCH } = await import('../route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ role: 'gestor' }) }), {
      params: Promise.resolve({ id: 'member-target' }),
    })
    expect(res.status).toBe(200)
    const target = fakeSupabase.__store.members.find((m) => m.id === 'member-target')
    expect(target?.role).toBe('gestor')
    expect(fakeSupabase.__store.notifications).toHaveLength(1)
    expect(fakeSupabase.__store.notifications[0].user_id).toBe('user-target')
  })

  it('admin não consegue remover o próprio acesso de admin por esta rota', async () => {
    fakeSupabase.__store.members.push({
      id: 'member-self',
      user_id: 'user-self',
      org_id: 'org-1',
      role: 'admin',
      display_name: 'Eu mesmo',
      status: 'active',
      custom_permissions: null,
      created_at: '2026-01-01',
    })
    const self: Member = fakeSupabase.__store.members.find((m) => m.id === 'member-self') as unknown as Member
    currentContext = makeContext(self)

    const { PATCH } = await import('../route')
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ role: 'designer' }) }), {
      params: Promise.resolve({ id: 'member-self' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejeita custom_permissions com chave desconhecida', async () => {
    const admin: Member = {
      id: 'member-admin',
      user_id: 'user-admin',
      org_id: 'org-1',
      role: 'admin',
      display_name: 'Admin',
      avatar_url: null,
      status: 'active',
      custom_permissions: null,
      created_at: '2026-01-01',
    }
    currentContext = makeContext(admin)

    const { PATCH } = await import('../route')
    const res = await PATCH(
      new Request('http://x', { method: 'PATCH', body: JSON.stringify({ custom_permissions: { chaveInventada: true } }) }),
      { params: Promise.resolve({ id: 'member-target' }) },
    )
    expect(res.status).toBe(400)
  })
})
