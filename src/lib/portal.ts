import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * IDs de cliente que um membro `role: cliente` pode enxergar no Portal
 * (via `client_members`). Membros de outros papéis (staff da agência) não
 * usam esta função — eles continuam vendo todos os clientes da org.
 */
export async function getPortalClientIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  memberId: string,
): Promise<string[]> {
  const { data } = await supabase.from('client_members').select('client_id').eq('member_id', memberId)
  return (data ?? []).map((row) => row.client_id as string)
}

/** true se o `clientId` está entre os clientes que este membro-cliente pode ver. */
export async function assertPortalClientAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  memberId: string,
  clientId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('client_members')
    .select('id')
    .eq('member_id', memberId)
    .eq('client_id', clientId)
    .maybeSingle()
  return !!data
}
