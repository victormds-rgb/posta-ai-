import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { applyInternalApprovalDecision } from '@/lib/approvals'
import type { ApprovalStatus } from '@/lib/types'

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
  const result = await applyInternalApprovalDecision(supabase, {
    contentId: id,
    orgId: ctx.organization.id,
    decision,
    comment: body.comment,
    reviewedBy: ctx.userId,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ approval: result.approval })
}
