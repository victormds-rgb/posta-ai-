import type { Member, RolePermissions, UserRole } from '@/lib/types'

/**
 * Permissões padrão por role. Um membro pode sobrescrever parcialmente via
 * `members.custom_permissions` (ver sql/002_granular_permissions.sql) — o
 * merge é feito em `getEffectivePermissions`.
 */
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    viewDashboard: true,
    manageClients: true,
    manageContent: true,
    manageMedia: true,
    approveInternal: true,
    publish: true,
    manageTeam: true,
    manageSettings: true,
    manageIntegrations: true,
    manageBilling: true,
    viewReports: true,
  },
  gestor: {
    viewDashboard: true,
    manageClients: true,
    manageContent: true,
    manageMedia: true,
    approveInternal: true,
    publish: true,
    manageTeam: false,
    manageSettings: false,
    manageIntegrations: true,
    manageBilling: false,
    viewReports: true,
  },
  designer: {
    viewDashboard: true,
    manageClients: false,
    manageContent: true,
    manageMedia: true,
    approveInternal: false,
    publish: false,
    manageTeam: false,
    manageSettings: false,
    manageIntegrations: false,
    manageBilling: false,
    viewReports: false,
  },
  cliente: {
    viewDashboard: true,
    manageClients: false,
    manageContent: false,
    manageMedia: false,
    approveInternal: false,
    publish: false,
    manageTeam: false,
    manageSettings: false,
    manageIntegrations: false,
    manageBilling: false,
    viewReports: false,
  },
}

/** Rótulos em pt-BR pra UI de edição de permissões. */
export const PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  viewDashboard: 'Ver painel',
  manageClients: 'Gerenciar clientes',
  manageContent: 'Gerenciar conteúdo',
  manageMedia: 'Enviar mídia',
  approveInternal: 'Aprovar internamente',
  publish: 'Publicar/agendar',
  manageTeam: 'Gerenciar equipe',
  manageSettings: 'Configurações da organização',
  manageIntegrations: 'Integrações (redes sociais)',
  manageBilling: 'Assinatura/cobrança',
  viewReports: 'Relatórios/analytics',
}

type PermissionSource = Pick<Member, 'role' | 'custom_permissions'>

/** Permissões efetivas do membro: padrão do role + override parcial. */
export function getEffectivePermissions(member: PermissionSource): RolePermissions {
  const base = ROLE_PERMISSIONS[member.role]
  if (!member.custom_permissions) return base
  return { ...base, ...member.custom_permissions }
}

/**
 * Checa uma permissão efetiva do membro (role + override). Use sempre no
 * servidor antes de qualquer operação de escrita — nunca confie apenas em
 * esconder o botão no frontend.
 */
export function can(member: PermissionSource, permission: keyof RolePermissions): boolean {
  return getEffectivePermissions(member)[permission]
}

/**
 * "Administração" da organização = role admin, não um flag independente.
 * Alterar `role` ou `custom_permissions` de outro membro exige isso — do
 * contrário, um membro com `manageTeam` concedido por override poderia se
 * autopromover a admin ou conceder permissões além do que ele deveria.
 */
export function isOrgAdmin(member: Pick<Member, 'role'>): boolean {
  return member.role === 'admin'
}
