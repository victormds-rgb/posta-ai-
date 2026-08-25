import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getOrgWhatsAppConfig } from '@/lib/org-whatsapp'
import { zapiGetStatus } from '@/lib/zapi'
import { getAppUrl } from '@/lib/get-app-url'

/** Consulta e sincroniza o status de conexão da instância Z-API da organização. */
export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const config = await getOrgWhatsAppConfig(ctx.organization.id)
  if (!config) return NextResponse.json({ config: null })

  const webhookUrl = `${getAppUrl()}/api/whatsapp/webhook?secret=${config.webhook_secret}`
  const result = await zapiGetStatus(config.instance_id, config.token)
  const supabase = await createServerSupabase()

  if (!result.success) {
    await supabase
      .from('org_whatsapp_config')
      .update({ status: 'error', last_error: result.error })
      .eq('org_id', ctx.organization.id)
    return NextResponse.json({
      config: { id: config.id, instance_id: config.instance_id, status: 'error', error: result.error, webhookUrl },
    })
  }

  const connected = !!result.data?.connected
  await supabase
    .from('org_whatsapp_config')
    .update({
      status: connected ? 'connected' : 'connecting',
      phone: result.data?.phone || config.phone,
      connected_at: connected ? new Date().toISOString() : null,
      last_error: null,
    })
    .eq('org_id', ctx.organization.id)

  return NextResponse.json({
    config: {
      id: config.id,
      instance_id: config.instance_id,
      phone: result.data?.phone || config.phone,
      status: connected ? 'connected' : 'connecting',
      webhookUrl,
    },
  })
}
