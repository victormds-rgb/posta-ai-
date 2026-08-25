import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { publishPost } from '@/lib/upload-post'
import { getOrgUploadPostKey } from '@/lib/org-upload-post'
import { can } from '@/lib/permissions'
import type { ClientSocialProfile, ContentItem } from '@/lib/types'

export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member.role, 'publish')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

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

  return NextResponse.json({ item: updated })
}
