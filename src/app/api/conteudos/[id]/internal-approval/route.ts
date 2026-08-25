import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getInternalApproverUserIds } from '@/lib/approvals'
import { notifyMany } from '@/lib/notifications'
import { getAppUrl } from '@/lib/get-app-url'
import { internalApprovalRequestedEmail } from '@/lib/email/templates'
import { getOrgTelegramConfig } from '@/lib/org-telegram'
import { telegramSendMessage } from '@/lib/telegram'
import type { ContentItem, InternalApproval } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Histórico de aprovações internas do conteúdo (mais recente primeiro). */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: content } = await supabase
    .from('content_items')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .maybeSingle()
  if (!content) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('internal_approvals')
    .select('*')
    .eq('content_id', id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'internal-approval')

  const approvals = (data ?? []) as InternalApproval[]
  const userIds = [...new Set(approvals.flatMap((a) => [a.requested_by, a.reviewed_by].filter(Boolean)))] as string[]

  let membersById: Record<string, { id: string; display_name: string; email?: string }> = {}
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from('members')
      .select('id, user_id, display_name')
      .eq('org_id', ctx.organization.id)
      .in('user_id', userIds)
    membersById = Object.fromEntries((members ?? []).map((m) => [m.user_id, m]))
  }

  const enriched = approvals.map((a) => ({
    ...a,
    requester: a.requested_by ? membersById[a.requested_by] : undefined,
    reviewer: a.reviewed_by ? membersById[a.reviewed_by] : undefined,
  }))

  return NextResponse.json({ approvals: enriched })
}

/** Solicita aprovação interna: reaproveita uma pendente, ou cria uma nova. */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: content } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .maybeSingle<ContentItem>()
  if (!content) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  const { data: existing } = await supabase
    .from('internal_approvals')
    .select('*')
    .eq('content_id', id)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const approval =
    existing ??
    (
      await supabase
        .from('internal_approvals')
        .insert({ org_id: ctx.organization.id, content_id: id, requested_by: ctx.userId })
        .select('*')
        .single()
    ).data

  await supabase
    .from('content_items')
    .update({ status: 'aprovacao_interna' })
    .eq('id', id)
    .eq('org_id', ctx.organization.id)

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'content.internal_approval_requested',
    entity_type: 'content_item',
    entity_id: id,
    details: {},
  })

  const approverIds = await getInternalApproverUserIds(supabase, ctx.organization.id, ctx.userId)
  const dashboardLink = `${getAppUrl()}/clientes`
  await notifyMany(supabase, approverIds, {
    orgId: ctx.organization.id,
    type: 'internal_approval_requested',
    title: 'Conteúdo aguardando aprovação interna',
    body: content.title,
    referenceId: id,
    referenceType: 'content_item',
    email: internalApprovalRequestedEmail({ contentTitle: content.title, link: dashboardLink }),
  })

  // Best-effort: avisa também no Telegram, com botões de aprovar/ajustar direto na mensagem.
  const telegramConfig = await getOrgTelegramConfig(ctx.organization.id)
  if (telegramConfig?.approval_chat_id) {
    telegramSendMessage(
      telegramConfig.bot_token,
      telegramConfig.approval_chat_id,
      `📝 <b>${content.title}</b>\n\nAguardando aprovação interna.`,
      [
        [
          { text: '✅ Aprovar', callback_data: `ia:${id}:aprovado` },
          { text: '↩️ Pedir ajuste', callback_data: `ia:${id}:ajuste` },
        ],
      ],
    ).then((result) => {
      if (!result.success) console.error('[telegram.send]', result.error)
    })
  }

  return NextResponse.json({ approval }, { status: 201 })
}
