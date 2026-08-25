import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

export async function PATCH(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member.role, 'manageSettings')) {
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ organization: data })
}
