import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, mediaFolderUpdateSchema } from '@/lib/validation'
import { generateToken } from '@/lib/tokens'
import type { MediaFolder } from '@/lib/types'

type Params = { params: Promise<{ id: string; folderId: string }> }

/** Renomeia a pasta e/ou liga/desliga o link público de compartilhamento (sem login). */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageMedia')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId, folderId } = await params
  const { data: body, error: validationError } = await parseBody(request, mediaFolderUpdateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const updates: Record<string, unknown> = {}
  if (body.name) updates.name = body.name
  if ('public' in body) updates.public_token = body.public ? generateToken(20) : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('media_folders')
    .update(updates)
    .eq('id', folderId)
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)
    .select('*')
    .single()

  if (error) return serverError(error, 'acervo.pastas.update')
  return NextResponse.json({ folder: data as MediaFolder })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageMedia')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId, folderId } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('media_folders')
    .delete()
    .eq('id', folderId)
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'acervo.pastas.delete')
  return NextResponse.json({ success: true })
}
