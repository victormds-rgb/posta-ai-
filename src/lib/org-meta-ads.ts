import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/crypto'

export interface ResolvedMetaAdsConfig {
  accessToken: string
  adAccountId: string
}

/** Config do Meta Ads da organização, já decifrada. null se não conectado. */
export async function getOrgMetaAdsConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
): Promise<ResolvedMetaAdsConfig | null> {
  const { data } = await supabase.from('org_meta_ads_config').select('*').eq('org_id', orgId).maybeSingle()
  if (!data) return null
  return { accessToken: decryptSecret(data.access_token), adAccountId: data.ad_account_id }
}
