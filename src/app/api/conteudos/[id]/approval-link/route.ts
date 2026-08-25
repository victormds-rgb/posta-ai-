import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { generateToken } from '@/lib/tokens'
import { getAppUrl } from '@/lib/get-app-url'
import { can } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

/** Gera (ou reaproveita) um link público de aprovação para um conteúdo. */
export async function POST(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: content } = await supabase
    .from('content_items')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.organization.id)
    .maybeSingle()
  if (!content) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  // Reaproveita um link pendente e ainda válido, se existir.
  const { data: existing } = await supabase
    .from('approval_links')
    .select('*')
    .eq('content_id', id)
    .eq('status', 'pendente')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const link = existing ?? (await createLink())

  async function createLink() {
    const { data, error } = await supabase
      .from('approval_links')
      .insert({ content_id: id, org_id: ctx!.organization.id, token: generateToken() })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  await supabase
    .from('content_items')
    .update({ status: 'aprovacao_cliente' })
    .eq('id', id)
    .eq('org_id', ctx.organization.id)

  return NextResponse.json({
    link: `${getAppUrl()}/aprovacao?token=${link.token}`,
    token: link.token,
    expires_at: link.expires_at,
  })
}
