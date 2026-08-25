import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getOrgWhatsAppConfig } from '@/lib/org-whatsapp'
import { zapiSendText } from '@/lib/zapi'
import { parseBody, whatsappSendSchema } from '@/lib/validation'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'

/** Envia uma mensagem de texto (ex.: link de aprovação) via WhatsApp da organização. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const limit = rateLimit(`whatsapp:send:${ctx.organization.id}`, 60, 60 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { data: body, error: validationError } = await parseBody(request, whatsappSendSchema)
  if (validationError) return validationError

  const config = await getOrgWhatsAppConfig(ctx.organization.id)
  if (!config) {
    return NextResponse.json({ error: 'Conecte o WhatsApp da organização em Configurações antes de enviar.' }, { status: 400 })
  }

  const result = await zapiSendText(config.instance_id, config.token, body.phone, body.message)
  const supabase = await createServerSupabase()

  await supabase.from('whatsapp_messages').insert({
    org_id: ctx.organization.id,
    direction: 'outbound',
    phone: body.phone,
    message: body.message,
    status: result.success ? 'sent' : 'failed',
    provider_message_id: result.data?.zaapId || result.data?.messageId || result.data?.id || null,
    error: result.success ? null : result.error,
    reference_id: body.reference_id || null,
    reference_type: body.reference_type || null,
  })

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ success: true })
}
