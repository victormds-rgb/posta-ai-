import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { googleDriveExchangeCode } from '@/lib/google-drive'
import { encryptSecret } from '@/lib/crypto'
import { getAppUrl } from '@/lib/get-app-url'

/** Callback do OAuth do Google Drive — troca o code por tokens e salva cifrado. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const redirectBase = `${getAppUrl()}/configuracoes`

  if (oauthError || !code) {
    return NextResponse.redirect(`${redirectBase}?google_drive=error`)
  }

  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.redirect(`${getAppUrl()}/login`)

  const exchanged = await googleDriveExchangeCode(code)
  if (!exchanged.success || !exchanged.data.refresh_token) {
    return NextResponse.redirect(`${redirectBase}?google_drive=error`)
  }

  const supabase = await createServerSupabase()
  await supabase.from('org_google_drive_config').upsert(
    {
      org_id: ctx.organization.id,
      access_token: encryptSecret(exchanged.data.access_token),
      refresh_token: encryptSecret(exchanged.data.refresh_token),
      expires_at: new Date(Date.now() + exchanged.data.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'org_id' },
  )

  return NextResponse.redirect(`${redirectBase}?google_drive=connected`)
}
