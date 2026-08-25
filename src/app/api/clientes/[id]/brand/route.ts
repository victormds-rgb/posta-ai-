import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { assertPortalClientAccess } from '@/lib/portal'
import { parseBody, brandAssetSchema } from '@/lib/validation'
import type { BrandAsset } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Brand book do cliente. Staff da agência sempre pode ver; membro `cliente` só o seu. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: clientId } = await params
  const supabase = await createServerSupabase()

  if (ctx.member.role === 'cliente') {
    const allowed = await assertPortalClientAccess(supabase, ctx.member.id, clientId)
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase.from('brand_assets').select('*').eq('client_id', clientId).maybeSingle()
  if (error) return serverError(error, 'brand.get')
  return NextResponse.json({ brand: (data ?? null) as BrandAsset | null })
}

/** Cria ou atualiza (upsert) o brand book do cliente. Só a agência edita. */
export async function PUT(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageClients')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId } = await params
  const { data: body, error: validationError } = await parseBody(request, brandAssetSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('brand_assets')
    .upsert(
      {
        org_id: ctx.organization.id,
        client_id: clientId,
        primary_color: body.primary_color || null,
        secondary_color: body.secondary_color || null,
        accent_color: body.accent_color || null,
        fonts: body.fonts || null,
        logo_url: body.logo_url || null,
        guidelines: body.guidelines || null,
      },
      { onConflict: 'client_id' },
    )
    .select('*')
    .single()

  if (error) return serverError(error, 'brand.upsert')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'brand_asset.updated',
    entity_type: 'client',
    entity_id: clientId,
  })

  return NextResponse.json({ brand: data as BrandAsset })
}
