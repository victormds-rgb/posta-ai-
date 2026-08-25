import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { getValidGoogleDriveAccessToken } from '@/lib/org-google-drive'
import { googleDriveListFiles } from '@/lib/google-drive'

/** Lista arquivos do Google Drive conectado (opcionalmente dentro de uma pasta do Drive). */
export async function GET(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.member.role === 'cliente') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const driveFolderId = searchParams.get('drive_folder_id') || undefined

  const supabase = await createServerSupabase()
  const accessToken = await getValidGoogleDriveAccessToken(supabase, ctx.organization.id)
  if (!accessToken) return NextResponse.json({ error: 'Google Drive não conectado.' }, { status: 400 })

  const result = await googleDriveListFiles(accessToken, driveFolderId)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 })

  return NextResponse.json({ files: result.data.files })
}
