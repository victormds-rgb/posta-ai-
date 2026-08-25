import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/crypto'

export interface ResolvedWordPressConfig {
  siteUrl: string
  username: string
  appPassword: string
}

/** Config do WordPress do cliente, já decifrada. null se não conectado. */
export async function getClientWordPressConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  clientId: string,
): Promise<ResolvedWordPressConfig | null> {
  const { data } = await supabase.from('client_wordpress_config').select('*').eq('client_id', clientId).maybeSingle()
  if (!data) return null
  return { siteUrl: data.site_url, username: data.username, appPassword: decryptSecret(data.app_password) }
}
