import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { googleDriveRefreshToken } from '@/lib/google-drive'

/**
 * Resolve um access_token válido do Google Drive pra organização,
 * renovando via refresh_token quando expirado. Retorna null se a org
 * nunca conectou o Drive.
 */
export async function getValidGoogleDriveAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase.from('org_google_drive_config').select('*').eq('org_id', orgId).maybeSingle()
  if (!data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (expiresAt > Date.now() + 60_000) {
    return decryptSecret(data.access_token)
  }

  // Expirado (ou perto disso) — renova com o refresh_token.
  const refreshToken = decryptSecret(data.refresh_token)
  const refreshed = await googleDriveRefreshToken(refreshToken)
  if (!refreshed.success) return null

  const newExpiresAt = new Date(Date.now() + refreshed.data.expires_in * 1000).toISOString()
  await supabase
    .from('org_google_drive_config')
    .update({ access_token: encryptSecret(refreshed.data.access_token), expires_at: newExpiresAt })
    .eq('org_id', orgId)

  return refreshed.data.access_token
}
