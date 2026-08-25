import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'

const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

/** Recebe um arquivo (multipart/form-data) e sobe para o bucket "media" do Supabase Storage. */
export async function POST(request: Request) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo ausente' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo excede 50MB' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Tipo de arquivo não suportado: ${file.type}` }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${ctx.organization.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl.publicUrl, path })
}
