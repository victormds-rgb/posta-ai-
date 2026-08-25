import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import type { WebhookEvent } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Log de entrega (últimos eventos) de um webhook — pra depuração pelo usuário. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: webhookId } = await params
  const supabase = await createServerSupabase()

  const { data: config } = await supabase.from('webhook_configs').select('id').eq('id', webhookId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!config) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('webhook_config_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return serverError(error, 'webhooks.eventos')
  return NextResponse.json({ events: (data ?? []) as WebhookEvent[] })
}
