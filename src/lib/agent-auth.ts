import 'server-only'
import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const TOKEN_PREFIX = 'pai_'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Gera um novo token de agente. O valor em texto puro só existe aqui — nunca é salvo, só o hash. */
export function generateAgentToken(): { token: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(24).toString('hex')
  const token = `${TOKEN_PREFIX}${raw}`
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) }
}

/**
 * Resolve o org_id a partir do header `Authorization: Bearer <token>`.
 * Usa o client admin (bypassa RLS) porque esta é uma via de autenticação
 * própria (token de API), não uma sessão Supabase Auth.
 */
export async function getAgentOrgId(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: SupabaseClient<any>,
): Promise<string | null> {
  const auth = request.headers.get('authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1].trim()
  if (!token.startsWith(TOKEN_PREFIX)) return null

  const hash = hashToken(token)
  const { data } = await adminSupabase.from('org_agent_tokens').select('id, org_id').eq('token_hash', hash).maybeSingle()
  if (!data) return null

  await adminSupabase.from('org_agent_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return data.org_id as string
}
