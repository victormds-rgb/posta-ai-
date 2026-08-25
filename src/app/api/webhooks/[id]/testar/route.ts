import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { decryptSecret } from '@/lib/crypto'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import { deliver } from '@/lib/webhook-dispatch'

type Params = { params: Promise<{ id: string }> }

/** Envia um evento de teste (ping) pro webhook, sem esperar por um evento real. */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Cada teste faz um fetch de verdade pra uma URL escolhida pelo usuário —
  // sem limite, isso vira uma ferramenta de varredura de rede interna.
  const limit = rateLimit(`webhooks:testar:${ctx.organization.id}`, 10, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: config } = await supabase.from('webhook_configs').select('*').eq('id', id).eq('org_id', ctx.organization.id).maybeSingle()
  if (!config) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Reaproveita a mesma entrega (assinatura + checagem de SSRF) usada pelos
  // eventos reais — não uma cópia da lógica.
  const result = await deliver(config.url, decryptSecret(config.secret), 'ping', { message: 'Teste do Posta AI' })
  return NextResponse.json({ success: result.ok, error: result.ok ? undefined : result.error })
}
