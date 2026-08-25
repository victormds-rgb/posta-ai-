import type { UserRole } from '@/lib/types'

/**
 * Permissões por papel. Simplificado em relação a uma matriz por-membro
 * (ver ROADMAP.md) — cada role tem um conjunto fixo de capacidades.
 */
export interface RolePermissions {
  manageClients: boolean
  manageContent: boolean
  approveInternal: boolean
  manageTeam: boolean
  manageSettings: boolean
  manageSocial: boolean
  publish: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    manageClients: true,
    manageContent: true,
    approveInternal: true,
    manageTeam: true,
    manageSettings: true,
    manageSocial: true,
    publish: true,
  },
  gestor: {
    manageClients: true,
    manageContent: true,
    approveInternal: true,
    manageTeam: false,
    manageSettings: false,
    manageSocial: true,
    publish: true,
  },
  designer: {
    manageClients: false,
    manageContent: true,
    approveInternal: false,
    manageTeam: false,
    manageSettings: false,
    manageSocial: false,
    publish: false,
  },
  cliente: {
    manageClients: false,
    manageContent: false,
    approveInternal: false,
    manageTeam: false,
    manageSettings: false,
    manageSocial: false,
    publish: false,
  },
}

export function can(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission]
}
