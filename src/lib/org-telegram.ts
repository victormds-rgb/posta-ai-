import 'server-only'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'

export interface OrgTelegramConfig {
  id: string
  org_id: string
  bot_token: string // já decifrado
  bot_username: string | null
  approval_chat_id: string | null
  status: 'disconnected' | 'connected' | 'error'
}

/** Busca e decifra a config de Telegram da organização, se existir (via cliente da sessão — respeita RLS). */
export async function getOrgTelegramConfig(orgId: string): Promise<OrgTelegramConfig | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('org_telegram_config').select('*').eq('org_id', orgId).maybeSingle()
  return mapRow(data)
}

/** Igual, mas via service role (usado no webhook, que não tem sessão de usuário). */
export async function getOrgTelegramConfigByOrgIdAdmin(orgId: string): Promise<OrgTelegramConfig | null> {
  const admin = createAdminSupabase()
  const { data } = await admin.from('org_telegram_config').select('*').eq('org_id', orgId).maybeSingle()
  return mapRow(data)
}

function mapRow(data: Record<string, unknown> | null): OrgTelegramConfig | null {
  if (!data) return null
  return {
    id: data.id as string,
    org_id: data.org_id as string,
    bot_token: decryptSecret(data.bot_token_encrypted as string),
    bot_username: (data.bot_username as string) || null,
    approval_chat_id: (data.approval_chat_id as string) || null,
    status: data.status as OrgTelegramConfig['status'],
  }
}
