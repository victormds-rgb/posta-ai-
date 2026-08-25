import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PLAN_LIMITS } from '@/lib/stripe'

/** Checa se a organização ainda pode criar mais um cliente, dado o plano atual. */
export async function assertWithinClientLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  plan: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const limit = PLAN_LIMITS[plan]?.clients ?? PLAN_LIMITS.free.clients
  if (limit === Infinity) return { ok: true }

  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Seu plano permite até ${limit} cliente(s). Faça upgrade pra adicionar mais.` }
  }
  return { ok: true }
}

/** Checa se a organização ainda pode criar mais um conteúdo neste mês, dado o plano atual. */
export async function assertWithinContentLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  plan: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const limit = PLAN_LIMITS[plan]?.contentPerMonth ?? PLAN_LIMITS.free.contentPerMonth
  if (limit === Infinity) return { ok: true }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', startOfMonth.toISOString())
  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Seu plano permite até ${limit} conteúdo(s) por mês. Faça upgrade pra criar mais.` }
  }
  return { ok: true }
}
