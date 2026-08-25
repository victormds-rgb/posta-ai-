import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, metaAdsConnectSchema } from '@/lib/validation'
import { encryptSecret } from '@/lib/crypto'
import { metaValidateToken } from '@/lib/meta-ads'
import type { OrgMetaAdsConfig } from '@/lib/types'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_meta_ads_config')
    .select('id, org_id, ad_account_id, connected_at')
    .eq('org_id', ctx.organization.id)
    .maybeSingle()

  if (error) return serverError(error, 'meta-ads.get')
  return NextResponse.json({ config: (data ?? null) as OrgMetaAdsConfig | null })
}

/** Conecta o Meta Ads — token gerado pela própria organização no Meta Business Suite. */
export async function PUT(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, metaAdsConnectSchema)
  if (validationError) return validationError

  const valid = await metaValidateToken(body.access_token)
  if (!valid.success) {
    return NextResponse.json({ error: `Token inválido: ${valid.error}` }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_meta_ads_config')
    .upsert(
      {
        org_id: ctx.organization.id,
        access_token: encryptSecret(body.access_token),
        ad_account_id: body.ad_account_id,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    )
    .select('id, org_id, ad_account_id, connected_at')
    .single()

  if (error) return serverError(error, 'meta-ads.connect')
  return NextResponse.json({ config: data as OrgMetaAdsConfig })
}

export async function DELETE() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.from('org_meta_ads_config').delete().eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'meta-ads.disconnect')
  return NextResponse.json({ success: true })
}
