import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { notify } from '@/lib/notifications'
import type { ApprovalStatus, ContentItem } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Aprova ou pede ajuste na aprovação interna pendente do conteúdo. */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'approveInternal')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const decision: ApprovalStatus = body.decision
  if (decision !== 'aprovado' && decision !== 'ajuste') {
    return NextResponse.json({ error: 'decision precisa ser "aprovado" ou "ajuste"' }, { status: 400 })
  }
  if (decision === 'ajuste' && !body.comment?.trim()) {
    return NextResponse.json({ error: 'Informe o motivo do ajuste.' }, { status: 400 })
  }

  const supabase = await createServerSupabase()

  const { data: content } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .maybeSingle<ContentItem>()
  if (!content) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  const { data: pending } = await supabase
    .from('internal_approvals')
    .select('*')
    .eq('content_id', id)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!pending) {
    return NextResponse.json({ error: 'Não há aprovação interna pendente para este conteúdo.' }, { status: 404 })
  }

  const { data: approval, error } = await supabase
    .from('internal_approvals')
    .update({
      status: decision,
      reviewed_by: ctx.userId,
      comment: body.comment || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', pending.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'internal-approval.decision')

  await supabase
    .from('content_items')
    .update({ status: decision === 'aprovado' ? 'aprovacao_cliente' : 'producao' })
    .eq('id', id)
    .eq('org_id', ctx.organization.id)

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: decision === 'aprovado' ? 'content.internal_approved' : 'content.internal_changes_requested',
    entity_type: 'content_item',
    entity_id: id,
    details: { comment: body.comment || null },
  })

  if (pending.requested_by) {
    await notify(supabase, {
      orgId: ctx.organization.id,
      userId: pending.requested_by,
      type: decision === 'aprovado' ? 'internal_approval_approved' : 'internal_approval_changes_requested',
      title: decision === 'aprovado' ? 'Conteúdo aprovado internamente' : 'Ajuste solicitado no seu conteúdo',
      body: body.comment || content.title,
      referenceId: id,
      referenceType: 'content_item',
    })
  }

  return NextResponse.json({ approval })
}
