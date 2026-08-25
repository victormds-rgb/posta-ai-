import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { can } from '@/lib/permissions'
import { notify } from '@/lib/notifications'
import { getAppUrl } from '@/lib/get-app-url'
import { internalApprovalDecidedEmail } from '@/lib/email/templates'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { ApprovalStatus, ContentItem, InternalApproval, Member } from '@/lib/types'

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

type DecisionResult =
  | { ok: true; approval: InternalApproval; content: ContentItem }
  | { ok: false; error: string; status: number }

/**
 * Aplica uma decisão (aprovar/pedir ajuste) na aprovação interna pendente de
 * um conteúdo. Compartilhada entre a rota HTTP
 * (`/api/conteudos/[id]/internal-approval/decision`) e o webhook do Telegram
 * (clique em botão inline) — mesma regra de negócio, duas origens.
 */
export async function applyInternalApprovalDecision(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: { contentId: string; orgId: string; decision: ApprovalStatus; comment?: string; reviewedBy: string | null },
): Promise<DecisionResult> {
  const { contentId, orgId, decision, comment, reviewedBy } = params

  const { data: content } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', contentId)
    .eq('org_id', orgId)
    .maybeSingle<ContentItem>()
  if (!content) return { ok: false, error: 'Conteúdo não encontrado', status: 404 }

  const { data: pending } = await supabase
    .from('internal_approvals')
    .select('*')
    .eq('content_id', contentId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<InternalApproval>()
  if (!pending) return { ok: false, error: 'Não há aprovação interna pendente para este conteúdo.', status: 404 }

  const { data: approval, error } = await supabase
    .from('internal_approvals')
    .update({ status: decision, reviewed_by: reviewedBy, comment: comment || null, reviewed_at: new Date().toISOString() })
    .eq('id', pending.id)
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message, status: 500 }

  await supabase
    .from('content_items')
    .update({ status: decision === 'aprovado' ? 'aprovacao_cliente' : 'producao' })
    .eq('id', contentId)
    .eq('org_id', orgId)

  await supabase.from('activity_log').insert({
    org_id: orgId,
    user_id: reviewedBy,
    action: decision === 'aprovado' ? 'content.internal_approved' : 'content.internal_changes_requested',
    entity_type: 'content_item',
    entity_id: contentId,
    details: { comment: comment || null },
  })

  if (pending.requested_by) {
    await notify(supabase, {
      orgId,
      userId: pending.requested_by,
      type: decision === 'aprovado' ? 'internal_approval_approved' : 'internal_approval_changes_requested',
      title: decision === 'aprovado' ? 'Conteúdo aprovado internamente' : 'Ajuste solicitado no seu conteúdo',
      body: comment || content.title,
      referenceId: contentId,
      referenceType: 'content_item',
      email: internalApprovalDecidedEmail({
        contentTitle: content.title,
        approved: decision === 'aprovado',
        comment: comment || undefined,
        link: `${getAppUrl()}/clientes`,
      }),
    })
  }

  await dispatchWebhookEvent(supabase, {
    orgId,
    eventType: decision === 'aprovado' ? 'approval.approved' : 'approval.changes_requested',
    payload: { content, approval, kind: 'internal' },
  })

  return { ok: true, approval: approval as InternalApproval, content }
}
