import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { assertContentIsPublishable } from '@/lib/approvals'

/**
 * Agendamento "local": grava scheduled_at + status='agendado'. Um cron
 * (/api/cron/process-scheduled) publica de fato quando a data chega — ver
 * ROADMAP.md para a alternativa de agendamento nativo da Upload-Post.
 */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'publish')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const contentId: string | undefined = body?.content_id
  const scheduledAt: string | undefined = body?.scheduled_at
  if (!contentId || !scheduledAt) {
    return NextResponse.json({ error: 'content_id e scheduled_at são obrigatórios' }, { status: 400 })
  }
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'A data agendada precisa ser no futuro.' }, { status: 400 })
  }

  const supabase = await createServerSupabase()

  const approvalCheck = await assertContentIsPublishable(supabase, contentId)
  if (!approvalCheck.ok) {
    return NextResponse.json({ error: approvalCheck.reason }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('content_items')
    .update({ scheduled_at: scheduledAt, status: 'agendado' })
    .eq('id', contentId)
    .eq('org_id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'posts.schedule')
  return NextResponse.json({ item: data })
}
