import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/server'
import { rateLimit, rateLimitedResponse, getClientIp } from '@/lib/rate-limit'
import type { MediaFile, MediaFolder, Client } from '@/lib/types'

type Params = { params: Promise<{ token: string }> }

/** Endpoint público (sem login) usado pra visualizar uma pasta do acervo compartilhada por link. */
export async function GET(request: Request, { params }: Params) {
  const limit = rateLimit(`acervo:publico:${getClientIp(request)}`, 60, 5 * 60_000)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds)

  const { token } = await params
  const supabase = createAdminSupabase()

  const { data: folderData } = await supabase.from('media_folders').select('*').eq('public_token', token).maybeSingle()
  const folder = folderData as MediaFolder | null
  if (!folder) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, logo_url, brand_primary_color')
    .eq('id', folder.client_id)
    .single()

  const { data: filesData } = await supabase
    .from('media_files')
    .select('*')
    .eq('folder_id', folder.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    folder: { id: folder.id, name: folder.name },
    client: client as Pick<Client, 'id' | 'name' | 'logo_url' | 'brand_primary_color'> | null,
    files: (filesData ?? []) as MediaFile[],
  })
}
