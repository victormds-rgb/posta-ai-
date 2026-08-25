import 'server-only'
import { createServerSupabase } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'

export interface OrgWhatsAppConfig {
  id: string
  org_id: string
  instance_id: string
  token: string // já decifrado
  phone: string | null
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  webhook_secret: string
}

/** Busca e decifra a config de WhatsApp da organização, se existir. */
export async function getOrgWhatsAppConfig(orgId: string): Promise<OrgWhatsAppConfig | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('org_whatsapp_config').select('*').eq('org_id', orgId).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    org_id: data.org_id,
    instance_id: data.instance_id,
    token: decryptSecret(data.token_encrypted),
    phone: data.phone,
    status: data.status,
    webhook_secret: data.webhook_secret,
  }
}
