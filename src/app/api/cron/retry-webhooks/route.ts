import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { retryFailedWebhookEvents } from '@/lib/webhook-dispatch'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Reprocessa webhooks pendentes/falhos com backoff.
 * Mantido para compatibilidade/emergência — protegido por CRON_SECRET.
 * Usa a mesma lógica concurrency-safe das Edge Functions (claim_due_webhook_events / complete_webhook_event).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  
  // Fail closed if CRON_SECRET is not configured
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  
  // Timing-safe comparison
  if (!auth || !auth.startsWith('Bearer ') || !timingSafeEqual(auth.slice(7), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()

  try {
    // Use the new concurrency-safe RPC
    const claimId = `${crypto.randomUUID()}-${Date.now()}`
    const { data: claimedEvents, error: claimError } = await supabase.rpc('claim_due_webhook_events', {
      p_batch_size: 50,
      p_claim_id: claimId,
    })

    if (claimError) {
      console.error('claim_due_webhook_events error:', claimError)
      return NextResponse.json({ error: 'claim_failed', details: claimError.message }, { status: 500 })
    }

    let succeeded = 0

    for (const event of claimedEvents ?? []) {
      const { data: config } = await supabase.from('webhook_configs').select('*').eq('id', event.webhook_config_id).maybeSingle()
      if (!config || !config.active) {
        await supabase.rpc('complete_webhook_event', {
          p_event_id: event.id,
          p_claim_id: claimId,
          p_success: false,
          p_error: 'webhook desativado',
        })
        continue
      }

      // We need to decrypt the secret - for now call the existing logic
      // In the Edge Function we have Web Crypto, here we have Node crypto
      const { decryptSecret } = await import('@/lib/crypto')
      const secret = decryptSecret(config.secret)

      const result = await supabase.rpc('complete_webhook_event', {
        p_event_id: event.id,
        p_claim_id: claimId,
        p_success: false, // We'll update after delivery
        p_error: '',
      })

      // Actually deliver the webhook
      const { deliver } = await import('@/lib/webhook-dispatch')
      const deliveryResult = await deliver(config.url, secret, event.event_type, event.payload as Record<string, unknown>)

      const success = await supabase.rpc('complete_webhook_event', {
        p_event_id: event.id,
        p_claim_id: claimId,
        p_success: deliveryResult.ok,
        p_error: deliveryResult.error,
      })

      if (success.data === true && deliveryResult.ok) {
        succeeded++
      }
    }

    return NextResponse.json({ retried: (claimedEvents ?? []).length, succeeded })
  } catch (err) {
    console.error('retry-webhooks error:', err)
    return NextResponse.json({ error: 'internal_error', details: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}