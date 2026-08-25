import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { can } from '@/lib/permissions'
import type { Member } from '@/lib/types'

/** IDs (user_id) de todos os membros ativos da org com permissão de aprovar internamente. */
export async function getInternalApproverUserIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  orgId: string,
  excludeUserId?: string,
): Promise<string[]> {
  const { data } = await supabase.from('members').select('*').eq('org_id', orgId).eq('status', 'active')
  const members = (data ?? []) as Member[]
  return members.filter((m) => m.user_id !== excludeUserId && can(m, 'approveInternal')).map((m) => m.user_id)
}

/**
 * Bloqueia publicação/agendamento quando existe uma aprovação (interna ou o
 * link público externo) pendente ou com ajuste solicitado para o conteúdo.
 * Se nenhuma aprovação foi solicitada, publicar continua permitido — ver
 * decisão registrada no relatório da Fase 1 / Bloco 2.
 */
export async function assertContentIsPublishable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cliente sem generic de Database, ver lib/supabase/server.ts
  supabase: SupabaseClient<any>,
  contentId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: pendingInternal } = await supabase
    .from('internal_approvals')
    .select('id, status')
    .eq('content_id', contentId)
    .in('status', ['pendente', 'ajuste'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingInternal) {
    return {
      ok: false,
      reason:
        pendingInternal.status === 'pendente'
          ? 'Este conteúdo tem uma aprovação interna pendente.'
          : 'Este conteúdo voltou pra ajuste na aprovação interna — resolva antes de publicar.',
    }
  }

  const { data: pendingExternal } = await supabase
    .from('approval_links')
    .select('id, status, expires_at')
    .eq('content_id', contentId)
    .in('status', ['pendente', 'ajuste'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingExternal && new Date(pendingExternal.expires_at) > new Date()) {
    return {
      ok: false,
      reason:
        pendingExternal.status === 'pendente'
          ? 'Este conteúdo tem uma aprovação do cliente pendente.'
          : 'O cliente pediu ajuste neste conteúdo — resolva antes de publicar.',
    }
  }

  return { ok: true }
}
