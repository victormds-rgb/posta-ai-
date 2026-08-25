import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

type Params = { params: Promise<{ fileId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageMedia')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { fileId } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('media_files').delete().eq('id', fileId).eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'acervo.arquivos.delete')
  return NextResponse.json({ success: true })
}
