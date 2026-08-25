import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { assertPortalClientAccess } from '@/lib/portal'
import { parseBody, mediaFileCreateSchema } from '@/lib/validation'
import type { MediaFile } from '@/lib/types'

type Params = { params: Promise<{ id: string; folderId: string }> }

/** Lista os arquivos de uma pasta do acervo. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: clientId, folderId } = await params
  const supabase = await createServerSupabase()

  if (ctx.member.role === 'cliente') {
    const allowed = await assertPortalClientAccess(supabase, ctx.member.id, clientId)
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('media_files')
    .select('*')
    .eq('org_id', ctx.organization.id)
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false })

  if (error) return serverError(error, 'acervo.arquivos')
  return NextResponse.json({ files: (data ?? []) as MediaFile[] })
}

/**
 * Registra um arquivo já enviado ao bucket (`POST /api/media/upload`) dentro
 * de uma pasta do acervo. Reaproveita o mesmo bucket/rota de upload usada
 * pelo conteúdo — este endpoint só grava a referência (nome, url, tipo).
 */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageMedia')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId, folderId } = await params
  const { data: body, error: validationError } = await parseBody(request, mediaFileCreateSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()
  const { data: folder } = await supabase
    .from('media_folders')
    .select('id')
    .eq('id', folderId)
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)
    .maybeSingle()
  if (!folder) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('media_files')
    .insert({
      org_id: ctx.organization.id,
      folder_id: folderId,
      name: body.name,
      url: body.url,
      content_type: body.content_type || null,
      size_bytes: body.size_bytes ?? null,
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'acervo.arquivos.create')
  return NextResponse.json({ file: data as MediaFile }, { status: 201 })
}
