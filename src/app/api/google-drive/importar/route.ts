import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { parseBody, googleDriveImportSchema } from '@/lib/validation'
import { getValidGoogleDriveAccessToken } from '@/lib/org-google-drive'
import { googleDriveDownloadFile, googleDriveListFiles } from '@/lib/google-drive'
import type { MediaFile } from '@/lib/types'

/** Baixa um arquivo do Google Drive e importa pra uma pasta do Acervo digital. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageMedia')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: body, error: validationError } = await parseBody(request, googleDriveImportSchema)
  if (validationError) return validationError

  const supabase = await createServerSupabase()

  const { data: folder } = await supabase.from('media_folders').select('id').eq('id', body.folder_id).eq('org_id', ctx.organization.id).maybeSingle()
  if (!folder) return NextResponse.json({ error: 'Pasta do acervo inválida' }, { status: 400 })

  const accessToken = await getValidGoogleDriveAccessToken(supabase, ctx.organization.id)
  if (!accessToken) return NextResponse.json({ error: 'Google Drive não conectado.' }, { status: 400 })

  // Metadado do arquivo (nome/tipo) — reaproveita a listagem, filtrando pelo id.
  const listed = await googleDriveListFiles(accessToken)
  const meta = listed.success ? listed.data.files.find((f) => f.id === body.file_id) : undefined

  const download = await googleDriveDownloadFile(accessToken, body.file_id)
  if (!download.success) return NextResponse.json({ error: `Falha ao baixar do Drive: ${download.error}` }, { status: 502 })

  const name = meta?.name || `drive-${body.file_id}`
  const contentType = meta?.mimeType || 'application/octet-stream'
  const ext = name.includes('.') ? name.split('.').pop() : 'bin'
  const path = `${ctx.organization.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('media').upload(path, download.blob, { contentType, upsert: false })
  if (uploadError) return serverError(uploadError, 'google-drive.import.upload')

  const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(path)

  const { data, error } = await supabase
    .from('media_files')
    .insert({
      org_id: ctx.organization.id,
      folder_id: body.folder_id,
      name,
      url: publicUrl.publicUrl,
      content_type: contentType,
      size_bytes: download.blob.size,
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (error) return serverError(error, 'google-drive.import.create')
  return NextResponse.json({ file: data as MediaFile }, { status: 201 })
}
