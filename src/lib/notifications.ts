import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType =
  | 'internal_approval_requested'
  | 'internal_approval_approved'
  | 'internal_approval_changes_requested'
  | 'external_approval_approved'
  | 'external_approval_changes_requested'
  | 'team_member_joined'
  | 'permissions_changed'

interface NotifyParams {
  orgId: string
  userId: string
  type: NotificationType
  title: string
  body?: string
  referenceId?: string
  referenceType?: string
}

/**
 * Cria uma notificação in-app. Usa o cliente autenticado do request atual
 * (respeita RLS — a policy `notifications_insert_org` permite notificar
 * qualquer membro ativo da mesma organização, não só a si mesmo).
 */
export async function notify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cliente sem generic de Database, ver lib/supabase/server.ts
  supabase: SupabaseClient<any>,
  { orgId, userId, type, title, body, referenceId, referenceType }: NotifyParams,
) {
  await supabase.from('notifications').insert({
    org_id: orgId,
    user_id: userId,
    type,
    title,
    body: body || null,
    reference_id: referenceId || null,
    reference_type: referenceType || null,
  })
}

/** Notifica vários usuários de uma vez (ex.: todo mundo que pode aprovar). */
export async function notifyMany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userIds: string[],
  params: Omit<NotifyParams, 'userId'>,
) {
  if (userIds.length === 0) return
  const rows = userIds.map((userId) => ({
    org_id: params.orgId,
    user_id: userId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    reference_id: params.referenceId || null,
    reference_type: params.referenceType || null,
  }))
  await supabase.from('notifications').insert(rows)
}
