import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, whatsappConnectSchema } from '@/lib/validation'
import { encryptSecret } from '@/lib/crypto'
import { zapiGetStatus } from '@/lib/zapi'
import { serverError } from '@/lib/errors'

/** Conecta (ou reconfigura) a instância Z-API da organização. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, whatsappConnectSchema)
  if (validationError) return validationError

  // Valida as credenciais contra a Z-API antes de salvar.
  const statusCheck = await zapiGetStatus(body.instance_id, body.token)
  if (!statusCheck.success) {
    return NextResponse.json({ error: `Não foi possível validar a instância: ${statusCheck.error}` }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_whatsapp_config')
    .upsert(
      {
        org_id: ctx.organization.id,
        instance_id: body.instance_id,
        token_encrypted: encryptSecret(body.token),
        status: statusCheck.data?.connected ? 'connected' : 'connecting',
        phone: statusCheck.data?.phone || null,
        last_error: null,
      },
      { onConflict: 'org_id' },
    )
    .select('id, org_id, instance_id, phone, status, connected_at, created_at')
    .single()

  if (error) return serverError(error, 'whatsapp.connect')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'whatsapp.connected',
    entity_type: 'org_whatsapp_config',
    entity_id: data.id,
    details: {},
  })

  return NextResponse.json({ config: data })
}
