import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getClientWordPressConfig } from '@/lib/org-wordpress'
import { wpCreatePost } from '@/lib/wordpress'
import type { ContentItem } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Espelha este conteúdo como um post no WordPress do cliente (se conectado). */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'publish')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: contentData } = await supabase.from('content_items').select('*').eq('id', id).eq('org_id', ctx.organization.id).maybeSingle()
  const content = contentData as ContentItem | null
  if (!content) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const wpConfig = await getClientWordPressConfig(supabase, content.client_id)
  if (!wpConfig) {
    return NextResponse.json({ error: 'Este cliente não tem WordPress conectado (Configurações → Integrações).' }, { status: 400 })
  }

  const result = await wpCreatePost(wpConfig.siteUrl, wpConfig.username, wpConfig.appPassword, {
    title: content.title,
    content: content.caption || content.description || content.title,
  })
  if (!result.success) {
    return NextResponse.json({ error: `Falha ao publicar no WordPress: ${result.error}` }, { status: 502 })
  }

  await supabase.from('content_items').update({ wordpress_post_url: result.data!.link }).eq('id', id)

  await supabase.from('activity_log').insert({
    org_id: ctx.organization.id,
    user_id: ctx.userId,
    action: 'content.mirrored_wordpress',
    entity_type: 'content_item',
    entity_id: id,
    details: { url: result.data!.link },
  })

  return NextResponse.json({ url: result.data!.link })
}
