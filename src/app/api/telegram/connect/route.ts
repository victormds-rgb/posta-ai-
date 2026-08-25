import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, telegramConnectSchema } from '@/lib/validation'
import { encryptSecret } from '@/lib/crypto'
import { generateToken } from '@/lib/tokens'
import { telegramGetMe, telegramSetWebhook } from '@/lib/telegram'
import { getAppUrl } from '@/lib/get-app-url'
import { serverError } from '@/lib/errors'

/** Conecta o bot do Telegram da organização: valida o token, registra o webhook. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageIntegrations')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, telegramConnectSchema)
  if (validationError) return validationError

  const me = await telegramGetMe(body.bot_token)
  if (!me.success || !me.data) {
    return NextResponse.json({ error: `Token inválido: ${me.error}` }, { status: 400 })
  }

  const webhookSecret = generateToken(16)
  const webhookUrl = `${getAppUrl()}/api/telegram/webhook?secret=${webhookSecret}&org=${ctx.organization.id}`
  const webhookResult = await telegramSetWebhook(body.bot_token, webhookUrl)
  if (!webhookResult.success) {
    return NextResponse.json({ error: `Não foi possível registrar o webhook: ${webhookResult.error}` }, { status: 502 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('org_telegram_config')
    .upsert(
      {
        org_id: ctx.organization.id,
        bot_token_encrypted: encryptSecret(body.bot_token),
        bot_username: me.data.username,
        approval_chat_id: body.approval_chat_id || null,
        webhook_secret: webhookSecret,
        status: 'connected',
        last_error: null,
      },
      { onConflict: 'org_id' },
    )
    .select('id, org_id, bot_username, approval_chat_id, status, created_at')
    .single()

  if (error) return serverError(error, 'telegram.connect')

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'telegram.connected',
    entity_type: 'org_telegram_config',
    entity_id: data.id,
    details: { bot_username: me.data.username },
  })

  return NextResponse.json({ config: data })
}
