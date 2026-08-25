import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { applyInternalApprovalDecision } from '@/lib/approvals'
import { getOrgTelegramConfigByOrgIdAdmin } from '@/lib/org-telegram'
import { telegramAnswerCallbackQuery, telegramEditMessageText } from '@/lib/telegram'

/**
 * Recebe updates do bot do Telegram da organização. Configurado
 * automaticamente ao conectar (ver POST /api/telegram/connect).
 *
 * Trata cliques nos botões inline "Aprovar"/"Ajustar" enviados junto do
 * pedido de aprovação interna (callback_data no formato
 * `ia:{approvalId ignorado}:{contentId}:{decisao}` — decide direto pelo
 * content_id, sem precisar re-consultar qual aprovação está pendente).
 * "Ajustar" pelo Telegram usa um motivo genérico (botão não coleta texto
 * livre) — pedir ajuste com motivo detalhado continua disponível no painel.
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  const orgId = url.searchParams.get('org')
  if (!secret || !orgId) return NextResponse.json({ error: 'parâmetros ausentes' }, { status: 401 })

  const admin = createAdminSupabase()
  const { data: config } = await admin
    .from('org_telegram_config')
    .select('webhook_secret')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!config || config.webhook_secret !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const update = await request.json().catch(() => null)
  const callbackQuery = update?.callback_query
  if (!callbackQuery) return NextResponse.json({ success: true }) // update sem ação (ex.: mensagem de texto solta)

  const telegramConfig = await getOrgTelegramConfigByOrgIdAdmin(orgId)
  if (!telegramConfig) return NextResponse.json({ success: true })

  const [prefix, contentId, decisionRaw] = String(callbackQuery.data || '').split(':')
  if (prefix !== 'ia' || !contentId || (decisionRaw !== 'aprovado' && decisionRaw !== 'ajuste')) {
    await telegramAnswerCallbackQuery(telegramConfig.bot_token, callbackQuery.id, 'Ação não reconhecida.')
    return NextResponse.json({ success: true })
  }

  const result = await applyInternalApprovalDecision(admin, {
    contentId,
    orgId,
    decision: decisionRaw,
    comment: decisionRaw === 'ajuste' ? 'Ajuste solicitado via Telegram' : undefined,
    reviewedBy: null,
  })

  const ackText = result.ok
    ? decisionRaw === 'aprovado'
      ? '✅ Aprovado!'
      : '↩️ Ajuste solicitado.'
    : `Não foi possível: ${result.error}`
  await telegramAnswerCallbackQuery(telegramConfig.bot_token, callbackQuery.id, ackText)

  if (result.ok && callbackQuery.message?.chat?.id && callbackQuery.message?.message_id) {
    await telegramEditMessageText(
      telegramConfig.bot_token,
      String(callbackQuery.message.chat.id),
      callbackQuery.message.message_id,
      `${callbackQuery.message.text || ''}\n\n${ackText}`,
    )
  }

  return NextResponse.json({ success: true })
}
