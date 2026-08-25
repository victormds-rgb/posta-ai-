import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

export async function GET() {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('org_telegram_config')
    .select('id, bot_username, approval_chat_id, status')
    .eq('org_id', ctx.organization.id)
    .maybeSingle()

  return NextResponse.json({ config: data })
}
