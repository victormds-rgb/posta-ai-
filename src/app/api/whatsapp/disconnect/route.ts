import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getOrgWhatsAppConfig } from '@/lib/org-whatsapp'
import { zapiDisconnect } from '@/lib/zapi'

export async function POST() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const config = await getOrgWhatsAppConfig(ctx.organization.id)
  if (!config) return NextResponse.json({ success: true })

  await zapiDisconnect(config.instance_id, config.token)

  const supabase = await createServerSupabase()
  await supabase
    .from('org_whatsapp_config')
    .update({ status: 'disconnected', connected_at: null })
    .eq('org_id', ctx.organization.id)

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'whatsapp.disconnected',
    entity_type: 'org_whatsapp_config',
    entity_id: config.id,
    details: {},
  })

  return NextResponse.json({ success: true })
}
