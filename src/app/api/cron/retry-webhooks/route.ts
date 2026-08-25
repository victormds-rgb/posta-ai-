import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { retryFailedWebhookEvents } from '@/lib/webhook-dispatch'

/** Reprocessa webhooks pendentes/falhos com backoff. Chamado pelo cron do Vercel (ver vercel.json). */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  const result = await retryFailedWebhookEvents(supabase)
  return NextResponse.json(result)
}
