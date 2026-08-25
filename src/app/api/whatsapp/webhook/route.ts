import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'

/**
 * Recebe eventos da Z-API (mensagem recebida, status de conexão). Configure
 * a URL do webhook no painel da Z-API como:
 *   https://SEU-DOMINIO/api/whatsapp/webhook?secret=<webhook_secret da org>
 * (o secret é gerado automaticamente ao conectar — ver GET .../status).
 *
 * Hoje isso só REGISTRA a mensagem recebida (whatsapp_messages). Interpretar
 * automaticamente uma resposta como "aprovar"/"pedir ajuste" exigiria uma
 * decisão de produto sobre como mapear telefone → aprovação pendente, que
 * não estava determinada pela arquitetura existente — ver ROADMAP.md.
 */
export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (!secret) return NextResponse.json({ error: 'secret ausente' }, { status: 401 })

  const admin = createAdminSupabase()
  const { data: config } = await admin
    .from('org_whatsapp_config')
    .select('org_id')
    .eq('webhook_secret', secret)
    .maybeSingle()
  if (!config) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const payload = await request.json().catch(() => null)
  if (!payload) return NextResponse.json({ success: true }) // evento sem corpo reconhecível — ignora

  // Formato de payload da Z-API varia por tipo de evento; extrai o que dá pra extrair.
  const phone: string | undefined = payload.phone || payload.chatId?.replace(/\D/g, '')
  const message: string | undefined = payload.text?.message || payload.message || undefined
  const providerMessageId: string | undefined = payload.messageId || payload.zaapId

  if (phone) {
    await admin.from('whatsapp_messages').insert({
      org_id: config.org_id,
      direction: 'inbound',
      phone,
      message: message || JSON.stringify(payload).slice(0, 2000),
      status: 'received',
      provider_message_id: providerMessageId || null,
    })
  }

  return NextResponse.json({ success: true })
}
