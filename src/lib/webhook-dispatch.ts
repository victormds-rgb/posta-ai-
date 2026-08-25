import 'server-only'
import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/crypto'
import type { WebhookEventType } from '@/lib/types'

const MAX_ATTEMPTS = 5
const TIMEOUT_MS = 10_000

/** Assinatura HMAC-SHA256 do payload — o destinatário valida com o mesmo secret. */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
}

/** Backoff exponencial simples: 1min, 5min, 30min, 2h, 6h. */
function backoffMinutes(attempt: number): number {
  const table = [1, 5, 30, 120, 360]
  return table[Math.min(attempt, table.length - 1)]
}

async function deliver(url: string, secret: string, eventType: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({ event: eventType, data: payload, sent_at: new Date().toISOString() })
  const signature = signWebhookPayload(secret, body)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Posta-Event': eventType,
        'X-Posta-Signature': `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` }
    return { ok: true as const }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

/**
 * Dispara um evento pra todos os webhooks ativos da org inscritos nele.
 * Faz a 1a tentativa de entrega de forma síncrona (best-effort — não
 * bloqueia a resposta da rota chamadora por muito tempo, timeout de 10s);
 * falhas ficam na fila (`webhook_events`) pro cron de retry tentar de novo
 * com backoff exponencial.
 */
export async function dispatchWebhookEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: { orgId: string; eventType: WebhookEventType; payload: Record<string, unknown> },
): Promise<void> {
  const { data: configs } = await supabase.from('webhook_configs').select('*').eq('org_id', params.orgId).eq('active', true)
  const subscribed = (configs ?? []).filter((c) => (c.events as string[]).includes(params.eventType))
  if (subscribed.length === 0) return

  for (const config of subscribed) {
    const secret = decryptSecret(config.secret)
    const { data: eventRow } = await supabase
      .from('webhook_events')
      .insert({
        org_id: params.orgId,
        webhook_config_id: config.id,
        event_type: params.eventType,
        payload: params.payload,
        status: 'pending',
        attempts: 1,
      })
      .select('id')
      .single()

    const result = await deliver(config.url, secret, params.eventType, params.payload)
    await supabase
      .from('webhook_events')
      .update(
        result.ok
          ? { status: 'success', delivered_at: new Date().toISOString() }
          : { status: 'failed', last_error: result.error, next_attempt_at: new Date(Date.now() + backoffMinutes(1) * 60_000).toISOString() },
      )
      .eq('id', eventRow!.id)
  }
}

/** Reprocessa eventos pendentes/falhos que já passaram do próximo horário de tentativa. Uso: cron. */
export async function retryFailedWebhookEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<{ retried: number; succeeded: number }> {
  const nowIso = new Date().toISOString()
  const { data: pending } = await supabase
    .from('webhook_events')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', nowIso)
    .lt('attempts', MAX_ATTEMPTS)

  let succeeded = 0
  for (const event of pending ?? []) {
    const { data: config } = await supabase.from('webhook_configs').select('*').eq('id', event.webhook_config_id).maybeSingle()
    if (!config || !config.active) {
      await supabase.from('webhook_events').update({ status: 'failed', last_error: 'webhook desativado' }).eq('id', event.id)
      continue
    }

    const secret = decryptSecret(config.secret)
    const result = await deliver(config.url, secret, event.event_type, event.payload)
    const nextAttempts = event.attempts + 1

    if (result.ok) {
      succeeded++
      await supabase.from('webhook_events').update({ status: 'success', attempts: nextAttempts, delivered_at: new Date().toISOString() }).eq('id', event.id)
    } else {
      const exhausted = nextAttempts >= MAX_ATTEMPTS
      await supabase
        .from('webhook_events')
        .update({
          status: 'failed',
          attempts: nextAttempts,
          last_error: result.error,
          next_attempt_at: exhausted ? event.next_attempt_at : new Date(Date.now() + backoffMinutes(nextAttempts) * 60_000).toISOString(),
        })
        .eq('id', event.id)
    }
  }

  return { retried: (pending ?? []).length, succeeded }
}
