import { describe, it, expect } from 'vitest'
import { can, getEffectivePermissions, isOrgAdmin, ROLE_PERMISSIONS } from '@/lib/permissions'
import type { Member } from '@/lib/types'

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    user_id: 'u1',
    org_id: 'org1',
    role: 'designer',
    display_name: 'Test',
    avatar_url: null,
    status: 'active',
    created_at: new Date().toISOString(),
    custom_permissions: null,
    ...overrides,
  }
}

describe('getEffectivePermissions / can', () => {
  it('usa o padrão do role quando não há override', () => {
    const member = makeMember({ role: 'designer' })
    expect(getEffectivePermissions(member)).toEqual(ROLE_PERMISSIONS.designer)
    expect(can(member, 'manageContent')).toBe(true)
    expect(can(member, 'manageTeam')).toBe(false)
  })

  it('admin tem todas as permissões por padrão', () => {
    const member = makeMember({ role: 'admin' })
    for (const key of Object.keys(ROLE_PERMISSIONS.admin) as (keyof typeof ROLE_PERMISSIONS.admin)[]) {
      expect(can(member, key)).toBe(true)
    }
  })

  it('cliente não tem nenhuma permissão de gestão por padrão', () => {
    const member = makeMember({ role: 'cliente' })
    expect(can(member, 'manageContent')).toBe(false)
    expect(can(member, 'manageClients')).toBe(false)
    expect(can(member, 'publish')).toBe(false)
    expect(can(member, 'viewDashboard')).toBe(true)
  })

  it('override parcial concede uma permissão além do padrão do role', () => {
    // designer normalmente não pode aprovar internamente
    const member = makeMember({ role: 'designer', custom_permissions: { approveInternal: true } })
    expect(can(member, 'approveInternal')).toBe(true)
    // as demais permissões continuam vindo do padrão do role
    expect(can(member, 'manageTeam')).toBe(false)
    expect(can(member, 'manageContent')).toBe(true)
  })

  it('override parcial também pode revogar uma permissão do padrão do role', () => {
    // gestor normalmente pode publicar
    const member = makeMember({ role: 'gestor', custom_permissions: { publish: false } })
    expect(can(member, 'publish')).toBe(false)
    expect(can(member, 'manageClients')).toBe(true)
  })

  it('custom_permissions vazio ({}) não altera nada', () => {
    const member = makeMember({ role: 'designer', custom_permissions: {} })
    expect(getEffectivePermissions(member)).toEqual(ROLE_PERMISSIONS.designer)
  })
})

describe('isOrgAdmin', () => {
  it('só é true para role admin, independente de custom_permissions', () => {
    expect(isOrgAdmin(makeMember({ role: 'admin' }))).toBe(true)
    // mesmo com manageTeam concedido via override, gestor não é "org admin"
    expect(isOrgAdmin(makeMember({ role: 'gestor', custom_permissions: { manageTeam: true } }))).toBe(false)
    expect(isOrgAdmin(makeMember({ role: 'designer' }))).toBe(false)
    expect(isOrgAdmin(makeMember({ role: 'cliente' }))).toBe(false)
  })
})
