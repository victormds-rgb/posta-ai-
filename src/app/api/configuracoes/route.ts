import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

export async function PATCH(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageSettings')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  for (const key of ['name', 'brand_color', 'upload_post_api_key']) {
    if (key in body) updates[key] = body[key] || null
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'configuracoes')

  // Nunca devolve a chave crua no response — só se ela está configurada.
  const { upload_post_api_key, ...safeOrganization } = data
  void upload_post_api_key
  return NextResponse.json({ organization: { ...safeOrganization, hasUploadPostKey: !!data.upload_post_api_key } })
}
