import { NextResponse } from 'next/server'
import { serverError } from '@/lib/errors'
import { getCurrentContext } from '@/lib/org'
import { createServerSupabase } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

type Params = { params: Promise<{ id: string; sourceId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getCurrentContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!can(ctx.member, 'manageContent')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: clientId, sourceId } = await params
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('content_sources')
    .delete()
    .eq('id', sourceId)
    .eq('client_id', clientId)
    .eq('org_id', ctx.organization.id)

  if (error) return serverError(error, 'ia.fontes.delete')
  return NextResponse.json({ success: true })
}
