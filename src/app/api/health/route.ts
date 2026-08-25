import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'

/**
 * Health check pra load balancer / uptime monitor (UptimeRobot, o próprio
 * healthcheck da plataforma de deploy, etc.). Público de propósito — sem
 * auth, porque é chamado antes de qualquer sessão existir — mas não vaza
 * nada sensível: nenhum dado de tenant, nenhuma contagem, só se o processo
 * está de pé e se o Supabase responde.
 *
 * Não é rate-limitado de propósito: um monitor de uptime chama isso a cada
 * poucos segundos por natureza, e a query é a mais barata possível (head,
 * sem linhas, sem RLS pra atravessar — usa o service role).
 */
export async function GET() {
  const startedAt = Date.now()
  try {
    const supabase = createAdminSupabase()
    const { error } = await supabase.from('organizations').select('id', { head: true, count: 'exact' }).limit(1)

    if (error) {
      console.error('[health] database error', error)
      return NextResponse.json({ status: 'degraded', database: 'error' }, { status: 503 })
    }

    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      latency_ms: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[health] unreachable', error)
    return NextResponse.json({ status: 'degraded', database: 'unreachable' }, { status: 503 })
  }
}
