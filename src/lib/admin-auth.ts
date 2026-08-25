import 'server-only'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Super-admin do sistema: autorização por e-mail (`ADMIN_EMAILS`), nunca
 * por role de organização — um admin de uma org não é super-admin do
 * produto. Usado só pelo painel administrativo (`/admin`, `/api/admin/*`).
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}

export interface SuperAdminContext {
  userId: string
  email: string
}

/** Resolve o usuário logado e confirma que o e-mail está em ADMIN_EMAILS. null se não for. */
export async function requireSuperAdmin(): Promise<SuperAdminContext | null> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isSuperAdminEmail(user.email)) return null
  return { userId: user.id, email: user.email }
}
