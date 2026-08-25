import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, wordpressConnectSchema } from '@/lib/validation'
import { encryptSecret } from '@/lib/crypto'
import { wpTestConnection } from '@/lib/wordpress'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import type { ClientWordPressConfig } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id: clientId } = await params
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('client_wordpress_config')
    .select('id, org_id, client_id, site_url, username, connected_at, created_at')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) return serverError(error, 'wordpress.get')
  return NextResponse.json({ config: (data ?? null) as ClientWordPressConfig | null })
}

/** Conecta (ou reconecta) o WordPress do cliente — testa as credenciais antes de salvar. */
export async function PUT(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Cada tentativa faz um fetch de verdade na URL informada — sem limite,
  // vira uma ferramenta de varredura de rede interna (SSRF), mesmo com a
  // proteção de assertPublicUrl já bloqueando os alvos óbvios.
  const limit = rateLimit(`wordpress:connect:${ctx.organization.id}`, 10, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { id: clientId } = await params
  const { data: body, error: validationError } = await parseBody(request, wordpressConnectSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const test = await wpTestConnection(body.site_url, body.username, body.app_password)
  if (!test.success) {
    return NextResponse.json({ error: `Não foi possível conectar ao WordPress: ${test.error}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_wordpress_config')
    .upsert(
      {
        org_id: ctx.organization.id,
        client_id: clientId,
        site_url: body.site_url,
        username: body.username,
        app_password: encryptSecret(body.app_password),
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    )
    .select('id, org_id, client_id, site_url, username, connected_at, created_at')
    .single()

  if (error) return serverError(error, 'wordpress.connect')
  return NextResponse.json({ config: data as ClientWordPressConfig })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('client_wordpress_config').delete().eq('client_id', clientId).eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'wordpress.disconnect')
  return NextResponse.json({ success: true })
}
