import 'server-only'
import { createServerSupabase } from '@/lib/supabase/server'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Member, Organization, RolePermissions } from '@/lib/types'

export interface CurrentContext {
  userId: string
  email: string | null
  member: Member
  organization: Organization
  /** Permissões efetivas (role + override) — já resolvidas, prontas pra checar/renderizar. */
  permissions: RolePermissions
}

/**
 * Resolve o usuário logado, a membership ativa e a organização atual.
 * Retorna null se não houver sessão ou membership ativa — quem chama decide
 * se redireciona para /login ou responde 401/403.
 */
export async function getCurrentContext(): Promise<CurrentContext | null> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<Member>()
  if (!member) return null

  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', member.org_id)
    .single<Organization>()
  if (!organization) return null

  return {
    userId: user.id,
    email: user.email ?? null,
    member,
    organization,
    permissions: getEffectivePermissions(member),
  }
}

