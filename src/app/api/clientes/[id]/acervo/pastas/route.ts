import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { assertPortalClientAccess } from '@/lib/portal'
import { parseBody, mediaFolderCreateSchema } from '@/lib/validation'
import type { MediaFolder } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/** Lista as pastas do acervo digital do cliente. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: clientId } = await params
  const supabase = await createServerSupabase()

  if (ctx.member.role === 'cliente') {
    const allowed = await assertPortalClientAccess(supabase, ctx.member.id, clientId)
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('media_folders')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'acervo.pastas')
  return NextResponse.json({ folders: (data ?? []) as MediaFolder[] })
}

/** Cria uma pasta no acervo digital do cliente. Só a agência organiza pastas. */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageMedia')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId } = await params
  const { data: body, error: validationError } = await parseBody(request, mediaFolderCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', ctx.organization.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('media_folders')
    .insert({ org_id: ctx.organization.id, client_id: clientId, name: body.name })
    .select('*')
    .single()

  if (error) return serverError(error, 'acervo.pastas.create')
  return NextResponse.json({ folder: data as MediaFolder }, { status: 201 })
}
