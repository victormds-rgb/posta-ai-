import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { publishPost } from '@/lib/upload-post'
import { getOrgUploadPostKey } from '@/lib/org-upload-post'
import { can } from '@/lib/permissions'
import { assertContentIsPublishable } from '@/lib/approvals'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit'
import type { ClientSocialProfile, ContentItem } from '@/lib/types'

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'publish')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Cada chamada bem-sucedida publica de verdade numa rede social — sem
  // limite, um script vira uma forma de estourar o uso da Upload-Post.
  const limit = rateLimit(`posts:publish-now:${ctx.organization.id}`, 30, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const apiKey = getOrgUploadPostKey(ctx.organization)
  if (!apiKey) {
    return NextResponse.json({ error: 'Upload-Post não configurada para esta organização.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const contentId: string | undefined = body?.content_id
  if (!contentId) return NextResponse.json({ error: 'content_id é obrigatório' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: content } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', contentId)
    .eq('org_id', ctx.organization.id)
    .single<ContentItem>()
  if (!content) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  if (content.media_urls.length === 0) {
    return NextResponse.json({ error: 'Adicione ao menos uma mídia antes de publicar.' }, { status: 400 })
  }
  if (content.channels.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um canal.' }, { status: 400 })
  }

  const approvalCheck = await assertContentIsPublishable(supabase, contentId)
  if (!approvalCheck.ok) {
    return NextResponse.json({ error: approvalCheck.reason }, { status: 409 })
  }

  const { data: profile } = await supabase
    .from('client_social_profiles')
    .select('*')
    .eq('client_id', content.client_id)
    .maybeSingle<ClientSocialProfile>()
  if (!profile) {
    return NextResponse.json({ error: 'Conecte as redes sociais do cliente antes de publicar.' }, { status: 400 })
  }

  const result = await publishPost(apiKey, {
    username: profile.upload_post_username,
    platforms: content.channels,
    title: content.title,
    caption: content.caption || '',
    media_urls: content.media_urls,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Falha ao publicar' }, { status: 502 })
  }

  const { data: updated } = await supabase
    .from('content_items')
    .update({
      status: 'publicado',
      published_at: new Date().toISOString(),
      upload_post_job_id: result.data?.job_id || null,
    })
    .eq('id', contentId)
    .select('*')
    .single()

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'content.published',
    entity_type: 'content_item',
    entity_id: contentId,
    details: { channels: content.channels },
  })

  await dispatchWebhookEvent(supabase, { orgId: ctx.organization.id, eventType: 'content.published', payload: { content: updated } })

  return NextResponse.json({ item: updated })
}
