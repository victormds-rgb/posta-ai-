import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { decryptSecret } from '@/lib/crypto'
import { signWebhookPayload } from '@/lib/webhook-dispatch'

type Params = { params: Promise<{ id: string }> }

/** Envia um evento de teste (ping) pro webhook, sem esperar por um evento real. */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: config } = await supabase.from('webhook_configs').select('*').eq('id', id).eq('org_id', ctx.organization.id).maybeSingle()
  if (!config) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = JSON.stringify({ event: 'ping', data: { message: 'Teste do Posta AI' }, sent_at: new Date().toISOString() })
  const signature = signWebhookPayload(decryptSecret(config.secret), body)

  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Posta-Event': 'ping', 'X-Posta-Signature': `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    return NextResponse.json({ success: res.ok, status: res.status })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Falha de rede' })
  }
}
