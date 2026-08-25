import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'
import { rateLimit, rateLimitedResponse, getClientIp } from '@/lib/rate-limit'
import { parseBody, approvalDecisionSchema } from '@/lib/validation'
import { serverError } from '@/lib/errors'
import { getAppUrl } from '@/lib/get-app-url'
import { externalApprovalDecidedEmail } from '@/lib/email/templates'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { ApprovalLink, Client, ContentItem } from '@/lib/types'

type Params = { params: Promise<{ token: string }> }

/** Endpoint público (sem login) usado pela página /aprovacao. */
export async function GET(request: Request, { params }: Params) {
  const limit = rateLimit(`aprovacao:get:${getClientIp(request)}`, 60, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { token } = await params
  const supabase = createAdminSupabase()

  const { data: linkData } = await supabase.from('approval_links').select('*').eq('token', token).maybeSingle()
  const link = linkData as ApprovalLink | null
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  const { data: contentData } = await supabase.from('content_items').select('*').eq('id', link.content_id).single()
  const content = contentData as ContentItem | null
  if (!content) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, logo_url, brand_primary_color')
    .eq('id', content.client_id)
    .single()

  return NextResponse.json({ link, content, client: client as Pick<Client, 'id' | 'name' | 'logo_url' | 'brand_primary_color'> | null })
}

/** Cliente final aprova ou pede ajuste. */
export async function POST(request: Request, { params }: Params) {
  const limit = rateLimit(`aprovacao:post:${getClientIp(request)}`, 20, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { token } = await params
  const { data: body, error: validationError } = await parseBody(request, approvalDecisionSchema)
  if (validationError) return validationError
  const action = body.action

  const supabase = createAdminSupabase()
  const { data: linkData } = await supabase.from('approval_links').select('*').eq('token', token).maybeSingle()
  const link = linkData as ApprovalLink | null
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  const { error: updateError } = await supabase
    .from('approval_links')
    .update({
      status: action,
      reviewer_name: body.reviewer_name || null,
      comment: body.comment || null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', link.id)
  if (updateError) return serverError(updateError, 'aprovacao.decision')

  const { data: contentData } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', link.content_id)
    .single()
  const content = contentData as ContentItem | null

  await supabase
    .from('content_items')
    .update({ status: action === 'aprovado' ? 'agendado' : 'producao' })
    .eq('id', link.content_id)

  await supabase.from('activity_log').insert({
    org_id: link.org_id,
    user_id: null,
    action: action === 'aprovado' ? 'approval.approved' : 'approval.adjustment_requested',
    entity_type: 'content_item',
    entity_id: link.content_id,
    details: { reviewer_name: body.reviewer_name || null, comment: body.comment || null },
  })

  const notifyUserIds = [...new Set([content?.created_by, content?.assigned_to].filter(Boolean))] as string[]
  for (const userId of notifyUserIds) {
    await notify(supabase, {
      orgId: link.org_id,
      userId,
      type: action === 'aprovado' ? 'external_approval_approved' : 'external_approval_changes_requested',
      title: action === 'aprovado' ? 'Cliente aprovou o conteúdo' : 'Cliente pediu ajuste no conteúdo',
      body: body.comment || content?.title || undefined,
      referenceId: link.content_id,
      referenceType: 'content_item',
      email: content
        ? externalApprovalDecidedEmail({
            contentTitle: content.title,
            approved: action === 'aprovado',
            comment: body.comment || undefined,
            link: `${getAppUrl()}/clientes`,
          })
        : undefined,
    })
  }

  await dispatchWebhookEvent(supabase, {
    orgId: link.org_id,
    eventType: action === 'aprovado' ? 'approval.approved' : 'approval.changes_requested',
    payload: { content, kind: 'external', comment: body.comment || null },
  })

  return NextResponse.json({ success: true })
}
