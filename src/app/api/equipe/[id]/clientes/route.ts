import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, clientPortalAccessSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

/** Lista os `client_id`s que este membro (role: cliente) enxerga no Portal. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageTeam')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: memberId } = await params
  const supabase = await createServerSupabase()

  const { data: target } = await supabase.from('members').select('id').eq('id', memberId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase.from('client_members').select('client_id').eq('member_id', memberId)
  if (error) return serverError(error, 'equipe.clientes')
  return NextResponse.json({ client_ids: (data ?? []).map((r) => r.client_id) })
}

/** Substitui o conjunto de clientes que este membro (role: cliente) enxerga no Portal. */
export async function PUT(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageTeam')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: memberId } = await params
  const { data: body, error: validationError } = await parseBody(request, clientPortalAccessSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: target } = await supabase.from('members').select('id').eq('id', memberId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Garante que os clientes escolhidos pertencem mesmo a esta organização.
  if (body.client_ids.length > 0) {
    const { data: validClients } = await supabase.from('clients').select('id').eq('org_id', ctx.organization.id).in('id', body.client_ids)
    const validIds = new Set((validClients ?? []).map((c) => c.id))
    if (body.client_ids.some((id) => !validIds.has(id))) {
      return NextResponse.json({ error: 'Um ou mais clientes são inválidos' }, { status: 400 })
    }
  }

  const { error: deleteError } = await supabase.from('client_members').delete().eq('member_id', memberId)
  if (deleteError) return serverError(deleteError, 'equipe.clientes.update')

  if (body.client_ids.length > 0) {
    const { error: insertError } = await supabase
      .from('client_members')
      .insert(body.client_ids.map((clientId) => ({ member_id: memberId, client_id: clientId })))
    if (insertError) return serverError(insertError, 'equipe.clientes.update')
  }

  return NextResponse.json({ success: true, client_ids: body.client_ids })
}
