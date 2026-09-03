import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { publishPost } from '@/lib/upload-post'
import { getOrgUploadPostKey } from '@/lib/org-upload-post'
import { assertContentIsPublishable } from '@/lib/approvals'
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch'
import type { ClientSocialProfile, ContentItem, Organization } from '@/lib/types'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Publica todo conteúdo com status='agendado' cujo scheduled_at já passou.
 * Mantido para compatibilidade/emergência — protegido por CRON_SECRET.
 * Usa a mesma lógica concurrency-safe das Edge Functions (claim_due_content_items / complete_content_item).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  
  // Fail closed if CRON_SECRET is not configured
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  
  // Timing-safe comparison
  if (!auth || !auth.startsWith('Bearer ') || !timingSafeEqual(auth.slice(7), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabase()

  try {
    // Claim due items atomically using the new RPC
    const { data: claimedItems, error: claimError } = await supabase.rpc('claim_due_content_items', {
      p_batch_size: 20,
      p_run_id: crypto.randomUUID(),
    })

    if (claimError) {
      console.error('claim_due_content_items error:', claimError)
      return NextResponse.json({ error: 'claim_failed', details: claimError.message }, { status: 500 })
    }

    const results: { id: string; ok: boolean; error?: string }[] = []

    for (const item of (claimedItems ?? []) as ContentItem[]) {
      const { data: org } = await supabase.from('organizations').select('*').eq('id', item.org_id).single()
      const apiKey = org ? getOrgUploadPostKey(org as Organization) : null
      if (!apiKey) {
        await supabase.rpc('complete_content_item', {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: 'sem chave Upload-Post configurada',
        })
        results.push({ id: item.id, ok: false, error: 'sem chave Upload-Post configurada' })
        continue
      }

      const { data: profile } = await supabase
        .from('client_social_profiles')
        .select('*')
        .eq('client_id', item.client_id)
        .maybeSingle()
      if (!profile || item.media_urls.length === 0 || item.channels.length === 0) {
        await supabase.rpc('complete_content_item', {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: 'faltam mídia, canais ou redes conectadas',
        })
        results.push({ id: item.id, ok: false, error: 'faltam mídia, canais ou redes conectadas' })
        continue
      }

      const approvalCheck = await assertContentIsPublishable(supabase, item.id)
      if (!approvalCheck.ok) {
        await supabase.rpc('complete_content_item', {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: approvalCheck.reason,
        })
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
        await supabase.rpc('complete_content_item', {
          p_item_id: item.id,
          p_run_id: item.processing_run_id,
          p_success: false,
          p_error: publishResult.error,
        })
        results.push({ id: item.id, ok: false, error: publishResult.error })
        continue
      }

      // Success: mark as publicado
      await supabase.rpc('complete_content_item', {
        p_item_id: item.id,
        p_run_id: item.processing_run_id,
        p_success: true,
        p_upload_post_job_id: publishResult.data?.job_id || null,
      })

      // Dispatch webhook event
      await dispatchWebhookEvent(supabase, { orgId: item.org_id, eventType: 'content.published', payload: { content_id: item.id, title: item.title } })

      results.push({ id: item.id, ok: true })
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (err) {
    console.error('process-scheduled error:', err)
    return NextResponse.json({ error: 'internal_error', details: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}