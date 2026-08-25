import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { publishPost } from '@/lib/upload-post'
import { getOrgUploadPostKey } from '@/lib/org-upload-post'
import { assertContentIsPublishable } from '@/lib/approvals'
import type { ClientSocialProfile, ContentItem, Organization } from '@/lib/types'

/**
 * Publica todo conteúdo com status='agendado' cujo scheduled_at já passou.
 * Chamado pelo cron do Vercel (ver vercel.json) — protegido por CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  const { data: dueItems } = await supabase
    .from('content_items')
    .select('*')
    .eq('status', 'agendado')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const item of (dueItems ?? []) as ContentItem[]) {
    const { data: org } = await supabase.from('organizations').select('*').eq('id', item.org_id).single()
    const apiKey = org ? getOrgUploadPostKey(org as Organization) : null
    if (!apiKey) {
      results.push({ id: item.id, ok: false, error: 'sem chave Upload-Post configurada' })
      continue
    }

    const { data: profile } = await supabase
      .from('client_social_profiles')
      .select('*')
      .eq('client_id', item.client_id)
      .maybeSingle()
    if (!profile || item.media_urls.length === 0 || item.channels.length === 0) {
      results.push({ id: item.id, ok: false, error: 'faltam mídia, canais ou redes conectadas' })
      continue
    }

    const approvalCheck = await assertContentIsPublishable(supabase, item.id)
    if (!approvalCheck.ok) {
      results.push({ id: item.id, ok: false, error: approvalCheck.reason })
      continue
    }

    const publishResult = await publishPost(apiKey, {
      username: (profile as ClientSocialProfile).upload_post_username,
      platforms: item.channels,
      title: item.title,
      caption: item.caption || '',
      media_urls: item.media_urls,
    })

    if (!publishResult.success) {
      results.push({ id: item.id, ok: false, error: publishResult.error })
      continue
    }

    await supabase
      .from('content_items')
      .update({
        status: 'publicado',
        published_at: new Date().toISOString(),
        upload_post_job_id: publishResult.data?.job_id || null,
      })
      .eq('id', item.id)

    results.push({ id: item.id, ok: true })
  }

  return NextResponse.json({ processed: results.length, results })
}
