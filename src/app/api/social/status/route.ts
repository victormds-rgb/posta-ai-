import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProfileStatus } from '@/lib/upload-post'
import { getOrgUploadPostKey } from '@/lib/org-upload-post'
import type { ClientSocialProfile, SocialPlatform } from '@/lib/types'

/** Lê (e opcionalmente sincroniza com a Upload-Post) as redes conectadas do cliente. */
export async function GET(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const sync = searchParams.get('sync') === '1'
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: profile } = await supabase
    .from('client_social_profiles')
    .select('*')
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)
    .maybeSingle<ClientSocialProfile>()

  if (!profile) return NextResponse.json({ profile: null })

  if (sync) {
    const apiKey = getOrgUploadPostKey(ctx.organization)
    if (apiKey) {
      const result = await getProfileStatus(apiKey, profile.upload_post_username)
      if (result.success && result.data?.profile) {
        const connected: ClientSocialProfile['connected_platforms'] = Object.entries(
          result.data.profile.social_accounts || {},
        )
          .filter(([, value]) => value)
          .map(([platform, value]) => ({
            platform: platform as SocialPlatform,
            username: typeof value === 'object' ? value?.username : undefined,
            display_name: typeof value === 'object' ? value?.display_name : undefined,
          }))

        await supabase
          .from('client_social_profiles')
          .update({ connected_platforms: connected, last_synced_at: new Date().toISOString() })
          .eq('id', profile.id)

        profile.connected_platforms = connected
        profile.last_synced_at = new Date().toISOString()
      }
    }
  }

  return NextResponse.json({ profile })
}
